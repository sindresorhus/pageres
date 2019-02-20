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
	/**
	 * Delay capturing the screenshot (seconds).
	 *
	 * @default 0
	 */
	delay?: number;

	/**
	 * Number of seconds after which the request is aborted.
	 *
	 * @default 60
	 */
	timeout?: number;

	/**
	 * Crop to the set height.
	 *
	 * @default false
	 */
	crop?: boolean;

	/**
	 * Apply custom CSS to the webpage.
	 */
	css?: string;

	/**
	 * Apply custom JavaScript to the webpage.
	 */
	script?: string;

	/**
	 * A string with the same format as a browser cookie or an object.
	 */
	cookies?: (string | {[key: string]: string})[];

	/**
	 * Define a customized filename using Lo-Dash templates.
	 */
	filename?: string;

	/**
	 * When a file exists, append an incremental number.
	 *
	 * @default false
	 */
	incrementalName?: boolean;

	/**
	 * Capture a specific DOM element matching a CSS selector.
	 */
	selector?: string;

	/**
	 * Hide an array of DOM elements matching CSS selectors.
	 */
	hide?: string[];

	/**
	 * Username for authenticating with HTTP auth.
	 */
	username?: string;

	/**
	 * Password for authenticating with HTTP auth.
	 */
	password?: string;

	/**
	 * Scale webpage number times.
	 *
	 * @default 1
	 */
	scale?: number;

	/**
	 * Image format.
	 *
	 * @default png
	 */
	format?: string;

	/**
	 * Custom user agent.
	 */
	userAgent?: string;

	/**
	 * Custom HTTP request headers.
	 */
	headers?: {[key: string]: string};

	/**
	 * Set background color to `transparent` instead of `white` if no background is set.
	 *
	 * @default false
	 */
	transparent?: boolean;
}

export interface Source {
	/**
	 * URL or local path to the website you want to screenshot. You can also use a data URI.
	 */
	url: string;

	/**
	 * Use a `<width>x<height>` notation or a keyword.
	 */
	sizes: string[];

	/**
	 * Options set here will take precedence over the ones set in the constructor.
	 */
	options?: Options;
}

/**
* Set the destination directory.
*/
export type Destination = string;

export interface Viewport {
	/**
	* URL or local path to the website you want to screenshot. You can also use a data URI.
	*/
	url: string;

	/**
	* Use a <width>x<height> notation.
	*/
	sizes: string[];

	/**
	* A keyword is a version of a device.
	*/
	keywords: string[];
}

interface Stats {
	/**
	* Number of URLs.
	*/
	urls?: number;

	/**
	* Number of sizes.
	*/
	sizes?: number;

	/**
	* Number of screenshots.
	*/
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

		if (!(typeof url === 'string' && url.length > 0)) {
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

		if (!(typeof directory === 'string' && directory.length > 0)) {
			throw new TypeError('Directory required');
		}

		this._destination = directory;

		return this;
	}

	async run(): Promise<Screenshot[]> {
		await Promise.all(this.src().map(async (src: Source): Promise<void> => {
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
				this.items.push(await this.create(src.url, size, options));
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
			this.items.push(await this.create(url, item.item, options));
		}
	}

	private async viewport(obj: Viewport, options: Options): Promise<void> {
		for (const item of await viewportListMem(obj.keywords)) {
			this.sizes.push(item.size);
			obj.sizes.push(item.size);
		}

		for (const size of arrayUniq(obj.sizes)) {
			this.items.push(await this.create(obj.url, size, options));
		}
	}

	private async save(screenshots: Screenshot[]): Promise<void> {
		await Promise.all(screenshots.map(async screenshot => {
			await makeDir(this.dest());
			const dest = path.join(this.dest(), screenshot.filename);
			await writeFile(dest, screenshot);
		}));
	}

	private async create(uri: string, size: string, options: Options): Promise<Screenshot> {
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

		const screenshot = await captureWebsite.buffer(uri, finalOptions);
		screenshot.filename = filename;
		return screenshot;
	}
}

// For CommonJS default export support
module.exports = Pageres;
module.exports.default = Pageres;
