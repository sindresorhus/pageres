import process from 'node:process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import {EventEmitter} from 'node:events';
import captureWebsite, {
	type Options as CaptureWebsiteOptions,
	type BeforeScreenshot,
	type LaunchOptions,
} from 'capture-website';
import pMemoize from 'p-memoize';
import filenamify from 'filenamify';
import {unusedFilename} from 'unused-filename';
import arrayUniq from 'array-uniq';
import arrayDiffer from 'array-differ';
import {format as formatDate} from 'date-fns';
import getResolutions from 'get-res';
import logSymbols from 'log-symbols';
import {makeDirectory} from 'make-dir';
import viewportList from 'viewport-list';
import template from 'lodash.template';
import plur from 'plur';
import filenamifyUrl from 'filenamify-url';
import pMap from 'p-map';
import type {Writable} from 'type-fest';

const cpuCount = os.cpus().length;

export type Options = {
	/**
	Delay capturing the screenshot.

	Useful when the site does things after load that you want to capture.

	@default 0
	*/
	readonly delay?: number;

	/**
	Number of seconds after which the request is aborted.

	@default 60
	*/
	readonly timeout?: number;

	/**
	Crop to the set height.

	@default false
	*/
	readonly crop?: boolean;

	/**
	Apply custom CSS to the webpage. Specify some CSS or the path to a CSS file.
	*/
	readonly css?: string;

	/**
	Apply custom JavaScript to the webpage. Specify some JavaScript or the path to a file.
	*/
	readonly script?: string;

	/**
	A string with the same format as a [browser cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) or [an object](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagesetcookiecookies).

	Tip: Go to the website you want a cookie for and [copy-paste it from DevTools](https://stackoverflow.com/a/24961735/64949).

	@default []
	*/
	readonly cookies?: ReadonlyArray<string | Record<string, string>>;

	/**
	Define a customized filename using [Lo-Dash templates](https://lodash.com/docs#template).\
	For example: `<%= date %> - <%= url %>-<%= size %><%= crop %>`.

	Available variables:

	- `url`: The URL in [slugified](https://github.com/sindresorhus/filenamify-url) form, eg. `http://yeoman.io/blog/` becomes `yeoman.io!blog`
	- `size`: Specified size, eg. `1024x1000`
	- `width`: Width of the specified size, eg. `1024`
	- `height`: Height of the specified size, eg. `1000`
	- `crop`: Outputs `-cropped` when the crop option is true
	- `date`: The current date (YYYY-MM-DD), eg. 2015-05-18
	- `time`: The current time (HH-mm-ss), eg. 21-15-11

	@default '<%= url %>-<%= size %><%= crop %>'
	*/
	readonly filename?: string;

	/**
	When a file exists, append an incremental number.

	@default false
	*/
	readonly incrementalName?: boolean;

	/**
	Capture a specific DOM element matching a CSS selector.
	*/
	readonly selector?: string;

	/**
	Hide an array of DOM elements matching CSS selectors.

	@default []
	*/
	readonly hide?: string[];

	/**
	Username for authenticating with HTTP auth.
	*/
	readonly username?: string;

	/**
	Password for authenticating with HTTP auth.
	*/
	readonly password?: string;

	/**
	Scale webpage `n` times.

	@default 1
	*/
	readonly scale?: number;

	/**
	Image format.

	@default 'png'
	*/
	readonly format?: 'png' | 'jpg' | 'jpeg';

	/**
	Custom user agent.
	*/
	readonly userAgent?: string;

	/**
	Custom HTTP request headers.

	@default {}
	*/
	readonly headers?: Record<string, string>;

	/**
	Set background color to `transparent` instead of `white` if no background is set.

	@default false
	*/
	readonly transparent?: boolean;

	/**
	Emulate preference of dark color scheme.

	@default false
	*/
	readonly darkMode?: boolean;

	/**
	Options passed to [`puppeteer.launch()`](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#puppeteerlaunchoptions).

	@default {}
	*/
	readonly launchOptions?: LaunchOptions;

	/**
	The specified function is called right before the screenshot is captured. It receives the Puppeteer [`Page` instance](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-page) as the first argument and the [`browser` instance](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-browser) as the second argument. This gives you a lot of power to do custom stuff. The function can be async.

	Note: Make sure to not call `page.close()` or `browser.close()`.

	@example
	```
	import Pageres from 'pageres';

	await new Pageres({
		delay: 2,
		beforeScreenshot: async (page, browser) => {
			await checkSomething();
			await page.click('#activate-button');
			await page.waitForSelector('.finished');
		}
	})
		.source('https://github.com/sindresorhus/pageres', ['480x320', '1024x768'], {crop: true})
		.destination('screenshots')
		.run();

	console.log('Finished generating screenshots!');
	```
	*/
	readonly beforeScreenshot?: BeforeScreenshot;
};

/**
A page to screenshot added in {@link Pageres.source}.
*/
export type Source = {
	/**
	URL or local path to a website to screenshot. Can also be a data URI.
	*/
	readonly url: string;

	/**
	Size of screenshot. Uses `<width>x<height>` notation or a keyword.
	*/
	readonly sizes: string[];

	/**
	Options which will take precedence over the ones set in the constructor.
	*/
	readonly options?: Options;
};

/**
A destination directory set in {@link Pageres.destination}.
*/
export type Destination = string;

export type Viewport = {
	readonly url: string;
	readonly sizes: string[];
	readonly keywords: string[];
};

type Stats = {
	urls: number;
	sizes: number;
	screenshots: number;
};

/**
Data representing a screenshot. Includes the filename from the template in {@link Options.filename}.
*/
export type Screenshot = Uint8Array & {filename: string};

const getResolutionsMemoized = pMemoize(getResolutions);
// @ts-expect-error - TS is not very smart.
const viewportListMemoized = pMemoize(viewportList);

/**
Capture screenshots of websites in various resolutions. A good way to make sure your websites are responsive. It's speedy and generates 100 screenshots from 10 different websites in just over a minute. It can also be used to render SVG images.
*/
export default class Pageres extends EventEmitter {
	readonly #options: Writable<Options>;
	readonly #stats: Stats = {} as Stats; // eslint-disable-line @typescript-eslint/consistent-type-assertions
	readonly #items: Screenshot[] = [];
	readonly #sizes: string[] = [];
	readonly #urls: string[] = [];
	readonly #_source: Source[] = [];
	#_destination: Destination = '';

	constructor(options: Options = {}) {
		super();

		// Prevent false-positive `MaxListenersExceededWarning` warnings
		this.setMaxListeners(Number.POSITIVE_INFINITY);

		this.#options = {...options};
		this.#options.filename ??= '<%= url %>-<%= size %><%= crop %>';
		this.#options.format ??= 'png';
		this.#options.incrementalName ??= false;
		this.#options.launchOptions ??= {};
	}

	/**
	Retrieve pages to screenshot.

	@returns List of pages that have been already been added.
	*/
	source(): Source[];

	/**
	Add a page to screenshot.
	@param url - URL or local path to the website you want to screenshot. You can also use a data URI.
	@param sizes - Use a `<width>x<height>` notation or a keyword.

	A keyword is a version of a device from [this list](https://github.com/kevva/viewport-list/blob/master/data.json).

	You can also pass in the `w3counter` keyword to use the ten most popular resolutions from [w3counter](http://www.w3counter.com/globalstats.php).
	@param options - Options set here will take precedence over the ones set in the constructor.

	@example
	```
	import Pageres from 'pageres';

	const pageres = new Pageres({delay: 2})
		.source('https://github.com/sindresorhus/pageres', ['480x320', '1024x768'], {crop: true})
		.source('https://sindresorhus.com', ['1280x1024', '1920x1080'])
		.source('data:text/html,<h1>Awesome!</h1>', ['1024x768'], {delay: 1});
	```
	*/
	source(url: string, sizes: readonly string[], options?: Options): this;

	source(url?: string, sizes?: readonly string[], options?: Options): this | Source[] {
		if (url === undefined) {
			return this.#_source;
		}

		if (!(typeof url === 'string' && url.length > 0)) {
			throw new TypeError('URL required');
		}

		if (!(Array.isArray(sizes) && sizes.length > 0)) {
			throw new TypeError('Sizes required');
		}

		this.#_source.push({url, sizes, options});

		return this;
	}

	/**
	Get the destination directory.
	*/
	destination(): Destination;

	/**
	Set the destination directory.

	@example
	```
	import Pageres from 'pageres';

	const pageres = new Pageres()
		.source('https://github.com/sindresorhus/pageres', ['480x320'])
		.destination('screenshots');
	```
	*/
	destination(directory: Destination): this;

	destination(directory?: Destination): this | Destination {
		if (directory === undefined) {
			return this.#_destination;
		}

		if (!(typeof directory === 'string' && directory.length > 0)) {
			throw new TypeError('Directory required');
		}

		this.#_destination = directory;

		return this;
	}

	/**
	Run pageres.

	@returns List of screenshot data.

	@example
	```
	import Pageres from 'pageres';

	await new Pageres({delay: 2})
		.source('https://sindresorhus.com', ['1280x1024'])
		.destination('screenshots')
		.run();
	```
	*/
	async run(): Promise<Screenshot[]> {
		await Promise.all(this.source().map(async (source: Source): Promise<void> => {
			const options = {
				...this.#options,
				...source.options,
			};

			const sizes = arrayUniq(source.sizes.filter(size => /^\d{2,4}x\d{2,4}$/i.test(size)));
			const keywords = arrayDiffer(source.sizes, sizes);

			this.#urls.push(source.url);

			if (sizes.length === 0 && keywords.includes('w3counter')) {
				return this.#resolution(source.url, options);
			}

			if (keywords.length > 0) {
				return this.#viewport({url: source.url, sizes, keywords}, options);
			}

			const screenshots = await pMap(
				sizes,
				async (size: string): Promise<Screenshot> => {
					this.#sizes.push(size);
					return this.#create(source.url, size, options);
				},
				{concurrency: cpuCount * 2},
			);
			this.#items.push(...screenshots);

			return undefined;
		}));

		this.#stats.urls = arrayUniq(this.#urls).length;
		this.#stats.sizes = arrayUniq(this.#sizes).length;
		this.#stats.screenshots = this.#items.length;

		if (!this.destination()) {
			return this.#items;
		}

		await this.#save(this.#items);

		return this.#items;
	}

	/**
	Print a success message to the console.

	@example
	```
	import Pageres from 'pageres';

	const pageres = new Pageres({delay: 2})
		.source('https://sindresorhus.com', ['1280x1024', '1920x1080'])
		.destination('screenshots');

	await pageres.run();

	// prints: Generated 2 screenshots from 1 url and 2 sizes.
	pageres.successMessage();
	```
	*/
	successMessage(): void {
		const {screenshots, sizes, urls} = this.#stats;
		const words = {
			screenshots: plur('screenshot', screenshots),
			sizes: plur('size', sizes),
			urls: plur('url', urls),
		};

		console.log(`\n${logSymbols.success} Generated ${screenshots} ${words.screenshots} from ${urls} ${words.urls} and ${sizes} ${words.sizes}`);
	}

	async #resolution(url: string, options: Options): Promise<void> {
		for (const item of await getResolutionsMemoized() as Array<{item: string}>) {
			this.#sizes.push(item.item);
			this.#items.push(await this.#create(url, item.item, options));
		}
	}

	async #viewport(viewport: Viewport, options: Options): Promise<void> {
		for (const item of await viewportListMemoized(viewport.keywords) as Array<{size: string}>) {
			this.#sizes.push(item.size);
			viewport.sizes.push(item.size);
		}

		for (const size of arrayUniq(viewport.sizes)) {
			this.#items.push(await this.#create(viewport.url, size, options));
		}
	}

	async #save(screenshots: Screenshot[]): Promise<void> {
		await Promise.all(screenshots.map(async screenshot => {
			await makeDirectory(this.destination());
			const destination = path.join(this.destination(), screenshot.filename);
			await fsPromises.writeFile(destination, screenshot);
		}));
	}

	async #create(url: string, size: string, options: Options): Promise<Screenshot> {
		const basename = fs.existsSync(url) ? path.basename(url) : url;

		let hash = new URL(url, pathToFileURL(process.cwd())).hash ?? '';
		// Strip empty hash fragments: `#` `#/` `#!/`
		if (/^#!?\/?$/.test(hash)) {
			hash = '';
		}

		const [width, height] = size.split('x');

		const filenameTemplate = template(`${options.filename!}.${options.format!}`);

		const now = Date.now();
		let filename = filenameTemplate({
			crop: options.crop ? '-cropped' : '',
			date: formatDate(now, 'yyyy-MM-dd'),
			time: formatDate(now, 'HH-mm-ss'),
			size,
			width,
			height,
			url: `${filenamifyUrl(basename)}${filenamify(hash)}`,
		});

		if (options.incrementalName) {
			filename = await unusedFilename(filename);
		}

		const finalOptions: Writable<CaptureWebsiteOptions> = {
			width: Number(width),
			height: Number(height),
			delay: options.delay,
			timeout: options.timeout,
			fullPage: !options.crop,
			styles: options.css ? [options.css] : undefined,
			defaultBackground: !options.transparent,
			scripts: options.script ? [options.script] : undefined,
			cookies: options.cookies as any, // TODO: Support string cookies in capture-website
			element: options.selector,
			hideElements: options.hide,
			scaleFactor: options.scale ?? 1,
			type: options.format === 'jpg' ? 'jpeg' : 'png',
			userAgent: options.userAgent,
			headers: options.headers,
			darkMode: options.darkMode,
			launchOptions: options.launchOptions,
			beforeScreenshot: options.beforeScreenshot,
		};

		if (options.username && options.password) {
			finalOptions.authentication = {
				username: options.username,
				password: options.password,
			};
		}

		const screenshot = new Uint8Array(await captureWebsite.buffer(url, finalOptions)) as Screenshot;
		screenshot.filename = filename;
		return screenshot;
	}
}
