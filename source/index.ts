import {promisify} from 'util';
import path from 'path';
import fs from 'fs';
import EventEmitter from 'events';
import {parse as parseUrl} from 'url'; // eslint-disable-line node/no-deprecated-api
import arrayUniq from 'array-uniq';
import arrayDiffer from 'array-differ';
import easydate from 'easydate';
import getRes from 'get-res';
import logSymbols from 'log-symbols';
import mem from 'mem';
import makeDir from 'make-dir';
import captureWebsite from 'capture-website';
import viewportList from 'viewport-list';
import filenamify from 'filenamify';
import filenamifyUrl from 'filenamify-url';
import template from 'lodash.template';
import plur from 'plur';
import unusedFilename from 'unused-filename';

const writeFile = promisify(fs.writeFile);

export interface Options {
	delay?: number;
	timeout?: number;
	crop?: boolean;
	css?: string;
	script?: string;
	cookies?: (string | {[key: string]: string})[];
	filename?: string;
	incrementalName?: boolean;
	selector?: string;
	hide?: string[];
	username?: string;
	password?: string;
	scale?: number;
	format?: string;
	userAgent?: string;
	headers?: {[key: string]: string};
	transparent?: boolean;
}

export interface Source {
	url: string;
	sizes: string[];
	options?: Options;
}

export type Destination = string;

export interface Viewport {
	url: string;
	sizes: string[];
	keywords: string[];
}

interface Stats {
	urls?: number;
	sizes?: number;
	screenshots?: number;
}

export type Screenshot = Buffer & {filename: string};

const getResMem = mem(getRes);
const viewportListMem = mem(viewportList);

export default class Pageres extends EventEmitter {
	private options: Options;

	private stats: Stats;

	private items: Screenshot[];

	private sizes: string[];

	private urls: string[];

	private _source: Source[];

	private _destination: Destination;

	private _filename: string;

	constructor(options: Options = {}) {
		super();

		// Prevent false-positive `MaxListenersExceededWarning` warnings
		this.setMaxListeners(Infinity);

		this.options = {...options};
		this.options.filename = this.options.filename || '<%= url %>-<%= size %><%= crop %>';
		this.options.format = this.options.format || 'png';
		this.options.incrementalName = this.options.incrementalName || false;

		this.stats = {};
		this.items = [];
		this.sizes = [];
		this.urls = [];
		this._source = [];
		this._destination = '';
	}

	src(): Source[];

	src(url: string, sizes: string[], options?: Options): this;

	src(url?: string, sizes?: string[], options?: Options): this | Source[] {
		if (url === undefined) {
			return this._source;
		}

		if (typeof url !== 'string') {
			throw new TypeError('URL required');
		}

		if (!Array.isArray(sizes)) {
			throw new TypeError('Sizes required');
		}

		this._source.push({url, sizes, options});

		return this;
	}

	dest(): Destination;

	dest(directory: Destination): this;

	dest(directory?: Destination): this | Destination {
		if (directory === undefined) {
			return this._destination;
		}

		if (typeof directory !== 'string') {
			throw new TypeError('Directory required');
		}

		this._destination = directory;

		return this;
	}

	async run(): Promise<Screenshot[]> {
		await Promise.all(this.src().map(async (src: Source): Promise<void> => {
			if (!src.url) {
				throw new Error('URL required');
			}

			const options = {...this.options, ...src.options};
			const sizes = arrayUniq(src.sizes.filter(/./.test, /^\d{2,4}x\d{2,4}$/i));
			const keywords = arrayDiffer(src.sizes, sizes);

			this.urls.push(src.url);

			if (sizes.length === 0 && keywords.indexOf('w3counter') !== -1) {
				return this.resolution(src.url, options);
			}

			if (keywords.length > 0) {
				return this.viewport({url: src.url, sizes, keywords}, options);
			}

			for (const size of sizes) {
				this.sizes.push(size);
				// TODO: Make this concurrent
				const screenshot = await this.create(src.url, size, options) as Screenshot;
				screenshot.filename = this._filename;
				this.items.push(screenshot);
			}

			return undefined;
		}));

		this.stats.urls = arrayUniq(this.urls).length;
		this.stats.sizes = arrayUniq(this.sizes).length;
		this.stats.screenshots = this.items.length;

		if (!this.dest()) {
			return this.items;
		}

		await this.save(this.items);

		return this.items;
	}

	successMessage(): void {
		const {screenshots, sizes, urls} = this.stats;
		const words = {
			screenshots: plur('screenshot', screenshots),
			sizes: plur('size', sizes),
			urls: plur('url', urls)
		};

		console.log(`\n${logSymbols.success} Generated ${screenshots} ${words.screenshots} from ${urls} ${words.urls} and ${sizes} ${words.sizes}`);
	}

	private async resolution(url: string, options: Options): Promise<void> {
		for (const item of await getResMem()) {
			this.sizes.push(item.item);
			const screenshot = await this.create(url, item.item, options) as Screenshot;
			screenshot.filename = this._filename;
			this.items.push(screenshot);
		}
	}

	private async viewport(obj: Viewport, options: Options): Promise<void> {
		for (const item of await viewportListMem(obj.keywords)) {
			this.sizes.push(item.size);
			obj.sizes.push(item.size);
		}

		for (const size of arrayUniq(obj.sizes)) {
			const screenshot = await this.create(obj.url, size, options) as Screenshot;
			screenshot.filename = this._filename;
			this.items.push(screenshot);
		}
	}

	private async save(streams: Screenshot[]): Promise<void> {
		await Promise.all(streams.map(async stream => {
			await makeDir(this.dest());
			const dest = path.join(this.dest(), this._filename);
			await writeFile(dest, stream);
		}));
	}

	private create(uri: string, size: string, options: Options): Promise<Buffer> {
		const basename = path.isAbsolute(uri) ? path.basename(uri) : uri;

		let hash = parseUrl(uri).hash || '';
		// Strip empty hash fragments: `#` `#/` `#!/`
		if (/^#!?\/?$/.test(hash)) {
			hash = '';
		}

		const [width, height] = size.split('x');

		const filenameTemplate = template(`${options.filename}.${options.format}`);

		let filename = filenameTemplate({
			crop: options.crop ? '-cropped' : '',
			date: easydate('Y-M-d'),
			time: easydate('h-m-s'),
			size,
			width,
			height,
			url: `${filenamifyUrl(basename)}${filenamify(hash)}`
		});

		if (options.incrementalName) {
			filename = unusedFilename.sync(filename);
		}

		const finalOptions: any = {
			width: Number(width),
			height: Number(height),
			delay: options.delay,
			timeout: options.timeout,
			fullPage: !options.crop,
			styles: options.css && [options.css],
			scripts: options.script && [options.script],
			cookies: options.cookies, // TODO: Support string cookies in capture-website
			element: options.selector,
			hideElements: options.hide,
			scaleFactor: options.scale === undefined ? 1 : options.scale,
			format: options.format === 'jpg' ? 'jpeg' : 'png',
			userAgent: options.userAgent,
			headers: options.headers
		};

		if (options.username && options.password) {
			finalOptions.authentication = {
				username: options.username,
				password: options.password
			};
		}

		this._filename = filename;

		return captureWebsite.buffer(uri, finalOptions);
	}
}

// For CommonJS default export support
module.exports = Pageres;
module.exports.default = Pageres;
