import {promisify} from 'util';
import {parse as parseUrl} from 'url'; // eslint-disable-line node/no-deprecated-api
import path = require('path');
import fs = require('fs');
import os = require('os');
import {EventEmitter} from 'events';
import pMemoize = require('p-memoize');
import filenamify = require('filenamify');
import unusedFilename from 'unused-filename';
import arrayUniq = require('array-uniq');
import arrayDiffer = require('array-differ');
import dateFns = require('date-fns');
import getResolutions = require('get-res');
import logSymbols = require('log-symbols');
import makeDir = require('make-dir');
import captureWebsite = require('capture-website');
import viewportList = require('viewport-list');
import template = require('lodash.template');
import plur = require('plur');
import filenamifyUrl = require('filenamify-url');
import pMap = require('p-map');

// TODO: Move this to `type-fest`
type Mutable<ObjectType> = {-readonly [KeyType in keyof ObjectType]: ObjectType[KeyType]};

const writeFile = promisify(fs.writeFile);
const cpuCount = os.cpus().length;

export interface Options {
	readonly delay?: number;
	readonly timeout?: number;
	readonly crop?: boolean;
	readonly css?: string;
	readonly script?: string;
	readonly cookies?: ReadonlyArray<string | Record<string, string>>;
	readonly filename?: string;
	readonly incrementalName?: boolean;
	readonly selector?: string;
	readonly hide?: readonly string[];
	readonly username?: string;
	readonly password?: string;
	readonly scale?: number;
	readonly format?: string;
	readonly userAgent?: string;
	readonly headers?: Record<string, string>;
	readonly transparent?: boolean;
	readonly darkMode?: boolean;
	readonly launchOptions?: captureWebsite.Options['launchOptions'];
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
	urls: number;
	sizes: number;
	screenshots: number;
}

export type Screenshot = Buffer & {filename: string};

const getResolutionsMemoized = pMemoize(getResolutions);
// @ts-expect-error
const viewportListMemoized = pMemoize(viewportList);

// TODO: Use private class fields when targeting Node.js 12.
export default class Pageres extends EventEmitter {
	private readonly options: Mutable<Options>;

	private stats: Stats;

	private readonly items: Screenshot[];

	private readonly sizes: string[];

	private readonly urls: string[];

	private readonly _source: Source[];

	private _destination: Destination;

	constructor(options: Options = {}) {
		super();

		// Prevent false-positive `MaxListenersExceededWarning` warnings
		this.setMaxListeners(Number.POSITIVE_INFINITY);

		this.options = {...options};
		this.options.filename = this.options.filename ?? '<%= url %>-<%= size %><%= crop %>';
		this.options.format = this.options.format ?? 'png';
		this.options.incrementalName = this.options.incrementalName ?? false;
		this.options.launchOptions = this.options.launchOptions ?? {};

		// FIXME
		this.stats = {} as Stats; // eslint-disable-line @typescript-eslint/consistent-type-assertions
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

			const sizes = arrayUniq(source.sizes.filter(size => /^\d{2,4}x\d{2,4}$/i.test(size)));
			const keywords = arrayDiffer(source.sizes, sizes);

			this.urls.push(source.url);

			if (sizes.length === 0 && keywords.includes('w3counter')) {
				return this.resolution(source.url, options);
			}

			if (keywords.length > 0) {
				return this.viewport({url: source.url, sizes, keywords}, options);
			}

			const screenshots = await pMap(
				sizes,
				async (size: string): Promise<Screenshot> => {
					this.sizes.push(size);
					return this.create(source.url, size, options);
				},
				{concurrency: cpuCount * 2}
			);
			this.items.push(...screenshots);

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
		for (const item of await getResolutionsMemoized() as Array<{item: string}>) {
			this.sizes.push(item.item);
			this.items.push(await this.create(url, item.item, options));
		}
	}

	private async viewport(viewport: Viewport, options: Options): Promise<void> {
		for (const item of await viewportListMemoized(viewport.keywords) as Array<{size: string}>) {
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

		let hash = parseUrl(url).hash ?? '';
		// Strip empty hash fragments: `#` `#/` `#!/`
		if (/^#!?\/?$/.test(hash)) {
			hash = '';
		}

		const [width, height] = size.split('x');

		const filenameTemplate = template(`${options.filename!}.${options.format!}`);

		const now = Date.now();
		let filename = filenameTemplate({
			crop: options.crop ? '-cropped' : '',
			date: dateFns.format(now, 'yyyy-MM-dd'),
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
			headers: options.headers,
			darkMode: options.darkMode,
			launchOptions: options.launchOptions
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
