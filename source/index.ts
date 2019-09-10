import {promisify} from 'util';
import path from 'path';
import fs from 'fs';
import EventEmitter from 'events';
import {parse as parseUrl} from 'url'; // eslint-disable-line node/no-deprecated-api
import arrayUniq from 'array-uniq';
import arrayDiffer from 'array-differ';
import dateFns from 'date-fns';
import getRes from 'get-res';
import logSymbols from 'log-symbols';
import mem from 'mem';
import makeDir from 'make-dir';
import captureWebsite from 'capture-website';
import viewportList from 'viewport-list';
import filenamify from 'filenamify';
import template from 'lodash.template';
import plur from 'plur';
import unusedFilename from 'unused-filename';
import * as _filenamifyUrl from 'filenamify-url';

// TODO: Update filenamifyUrl and fix the import after https://github.com/sindresorhus/filenamify-url/issues/4 is resolved.
const filenamifyUrl = _filenamifyUrl.default;
// TODO: Move this to `type-fest`
type Mutable<ObjectType> = {-readonly [KeyType in keyof ObjectType]: ObjectType[KeyType]};

const writeFile = promisify(fs.writeFile);

export interface Options {
	readonly delay?: number;
	readonly timeout?: number;
	readonly crop?: boolean;
	readonly css?: string;
	readonly script?: string;
	readonly cookies?: readonly (string | {[key: string]: string})[];
	readonly filename?: string;
	readonly incrementalName?: boolean;
	readonly selector?: string;
	readonly hide?: readonly string[];
	readonly username?: string;
	readonly password?: string;
	readonly scale?: number;
	readonly format?: string;
	readonly userAgent?: string;
	readonly headers?: {[key: string]: string};
	readonly transparent?: boolean;
}

export interface Source {
	readonly url: string;
	readonly sizes: string[];
	readonly options?: Options;
}

export type Destination = string;

export interface Viewport {
	readonly url: string;
	readonly sizes: string[];
	readonly keywords: string[];
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
	private options: Mutable<Options>;

	private stats: Stats;

	private items: Screenshot[];

	private sizes: string[];

	private urls: string[];

	private _source: Source[];

	private _destination: Destination;

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

	src(url: string, sizes: readonly string[], options?: Options): this;

	src(url?: string, sizes?: readonly string[], options?: Options): this | Source[] {
		if (url === undefined) {
			return this._source;
		}

		if (!(typeof url === 'string' && url.length > 0)) {
			throw new TypeError('URL required');
		}

		if (!(Array.isArray(sizes) && sizes.length > 0)) {
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

		if (!(typeof directory === 'string' && directory.length > 0)) {
			throw new TypeError('Directory required');
		}

		this._destination = directory;

		return this;
	}

	async run(): Promise<Screenshot[]> {
		await Promise.all(this.src().map(async (source: Source): Promise<void> => {
			const options = {
				...this.options,
				...source.options
			};

			const sizes = arrayUniq(source.sizes.filter(/./.test, /^\d{2,4}x\d{2,4}$/i));
			const keywords = arrayDiffer(source.sizes, sizes);

			this.urls.push(source.url);

			if (sizes.length === 0 && keywords.includes('w3counter')) {
				return this.resolution(source.url, options);
			}

			if (keywords.length > 0) {
				return this.viewport({url: source.url, sizes, keywords}, options);
			}

			for (const size of sizes) {
				this.sizes.push(size);
				// TODO: Make this concurrent
				this.items.push(await this.create(source.url, size, options));
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
		for (const item of await getResMem() as {item: string}[]) {
			this.sizes.push(item.item);
			this.items.push(await this.create(url, item.item, options));
		}
	}

	private async viewport(viewport: Viewport, options: Options): Promise<void> {
		for (const item of await viewportListMem(viewport.keywords) as {size: string}[]) {
			this.sizes.push(item.size);
			viewport.sizes.push(item.size);
		}

		for (const size of arrayUniq(viewport.sizes)) {
			this.items.push(await this.create(viewport.url, size, options));
		}
	}

	private async save(screenshots: Screenshot[]): Promise<void> {
		await Promise.all(screenshots.map(async screenshot => {
			await makeDir(this.dest());
			const dest = path.join(this.dest(), screenshot.filename);
			await writeFile(dest, screenshot);
		}));
	}

	private async create(url: string, size: string, options: Options): Promise<Screenshot> {
		const basename = path.isAbsolute(url) ? path.basename(url) : url;

		let hash = parseUrl(url).hash || '';
		// Strip empty hash fragments: `#` `#/` `#!/`
		if (/^#!?\/?$/.test(hash)) {
			hash = '';
		}

		const [width, height] = size.split('x');

		const filenameTemplate = template(`${options.filename}.${options.format}`);

		const now = Date.now();
		let filename = filenameTemplate({
			crop: options.crop ? '-cropped' : '',
			date: dateFns.format(now, 'YYYY-MM-DD'),
			time: dateFns.format(now, 'HH-mm-ss'),
			size,
			width,
			height,
			url: `${filenamifyUrl(basename)}${filenamify(hash)}`
		});

		if (options.incrementalName) {
			filename = unusedFilename.sync(filename);
		}

		// TODO: Type this using the `capture-website` types
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
			type: options.format === 'jpg' ? 'jpeg' : 'png',
			userAgent: options.userAgent,
			headers: options.headers
		};

		if (options.username && options.password) {
			finalOptions.authentication = {
				username: options.username,
				password: options.password
			};
		}

		const screenshot = await captureWebsite.buffer(url, finalOptions) as any;
		screenshot.filename = filename;
		return screenshot;
	}
}

// For CommonJS default export support
module.exports = Pageres;
module.exports.default = Pageres;
