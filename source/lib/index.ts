// @flow
import path from 'path';
import EventEmitter from 'events';
import {Readable} from 'stream';
import url from 'url';
import arrayUniq from 'array-uniq';
import arrayDiffer from 'array-differ';
import easydate from 'easydate';
import fsWriteStreamAtomic from 'fs-write-stream-atomic';
import getRes from 'get-res';
import logSymbols from 'log-symbols';
import mem from 'mem';
import makeDir from 'make-dir';
import del from 'del';
import screenshotStream from 'screenshot-stream';
import viewportList from 'viewport-list';
import protocolify from 'protocolify';
import filenamify from 'filenamify';
import filenamifyUrl from 'filenamify-url';
import template from 'lodash.template';
import plur from 'plur';
import unusedFilename from 'unused-filename';

type PageresStream = Readable & {filename: string};

interface Options {
	delay?: number;
	timeout?: number;
	crop?: boolean;
	incrementalName?: boolean;
	css?: string;
	cookies?: string[] | {[key: string]: string};
	filename?: string;
	selector?: string;
	hide?: string[];
	username?: string;
	password?: string;
	scale?: number;
	format?: string;
	userAgent?: string;
	headers?: {[key: string]: string};
}

interface Src {
	url: string;
	sizes: string[];
	options: Options;
}

interface Viewport {
	url: string;
	sizes: string[];
	keywords: string[];
}

type SrcFn<DestValue> =
	& ((_: void, _: void, _: void) => Src[])
	& ((url: string, sizes: string[], options: Options) => Pageres<DestValue>);

type DestFn<DestValue> =
	& ((_: void) => DestValue)
	& ((dir: DestValue) => Pageres<DestValue>);

const getResMem = mem(getRes);
const viewportListMem = mem(viewportList);

let listener;

export default class Pageres<DestValue: string> extends EventEmitter {
	options: Options;

	stats: Object;

	items: PageresStream[];

	sizes: string[];

	urls: string[];

	SRC: Src[];

	DEST: DestValue | undefined;

	constructor(options: Options) {
		super();

		this.options = {...options};
		this.options.filename = this.options.filename || '<%= url %>-<%= size %><%= crop %>';
		this.options.format = this.options.format || 'png';
		this.options.incrementalName = this.options.incrementalName || false;

		this.stats = {};
		this.items = [];
		this.sizes = [];
		this.urls = [];
		this.SRC = [];
	}

	src: SrcFn<DestValue>;

	src(url: string, sizes: string[], options: Options) {
		if (url === undefined) {
			return this.SRC;
		}

		this.SRC.push({url, sizes, options});
		return this;
	}

	dest: DestFn<DestValue>;

	dest(dir: DestValue) {
		if (dir === undefined) {
			return this.DEST;
		}

		this.DEST = dir;
		return this;
	}

	async run(): Promise<PageresStream[]> {
		await Promise.all(this.src().map(src => {
			const options = {...this.options, ...src.options};
			const sizes = arrayUniq(src.sizes.filter(/./.test, /^\d{2,4}x\d{2,4}$/i));
			const keywords = arrayDiffer(src.sizes, sizes);

			if (!src.url) {
				throw new Error('URL required');
			}

			this.urls.push(src.url);

			if (sizes.length === 0 && keywords.indexOf('w3counter') !== -1) {
				return this.resolution(src.url, options);
			}

			if (keywords.length > 0) {
				return this.viewport({url: src.url, sizes, keywords}, options);
			}

			for (const size of sizes) {
				this.sizes.push(size);
				this.items.push(this.create(src.url, size, options));
			}
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

	async resolution(url: string, options: Options) {
		for (const item of await getResMem()) {
			this.sizes.push(item.item);
			this.items.push(this.create(url, item.item, options));
		}
	}

	async viewport(obj: Viewport, options: Options) {
		for (const item of await viewportListMem(obj.keywords)) {
			this.sizes.push(item.size);
			obj.sizes.push(item.size);
		}

		for (const size of arrayUniq(obj.sizes)) {
			this.items.push(this.create(obj.url, size, options));
		}
	}

	save(streams: PageresStream[]) {
		const files = [];

		const end = () => del(files, {force: true});

		if (!listener) {
			listener = process.on('SIGINT', async () => {
				await end();
				process.exit(1);
			});
		}

		return Promise.all(streams.map(stream =>
			new Promise(async (resolve, reject) => {
				await makeDir(this.dest());

				const dest = path.join(this.dest(), stream.filename);
				const write = fsWriteStreamAtomic(dest);

				files.push(write.__atomicTmp);

				stream.on('warning', this.emit.bind(this, 'warning'));
				stream.on('warn', this.emit.bind(this, 'warn'));
				stream.on('error', async err => {
					await end();
					reject(err);
				});

				write.on('finish', resolve);
				write.on('error', async err => {
					await end();
					reject(err);
				});

				stream.pipe(write);
			})));
	}

	create(uri: string, size: string, options: Options) {
		const sizes = size.split('x');
		const stream = screenshotStream(protocolify(uri), size, options);

		// Coercing to string here to please Flow
		// TODO: Should fix the Flow type so this isn't necessary
		const filename = template(`${String(options.filename)}.${String(options.format)}`);

		let hash = url.parse(uri).hash || '';

		if (path.isAbsolute(uri)) {
			uri = path.basename(uri);
		}

		// Strip empty hash fragments: `#` `#/` `#!/`
		if (/^#!?\/?$/.test(hash)) {
			hash = '';
		}

		stream.filename = filename({
			crop: options.crop ? '-cropped' : '',
			date: easydate('Y-M-d'),
			time: easydate('h-m-s'),
			size,
			width: sizes[0],
			height: sizes[1],
			url: filenamifyUrl(uri) + filenamify(hash)
		});

		if (options.incrementalName) {
			stream.filename = unusedFilename.sync(stream.filename);
		}

		return stream;
	}

	successMessage() {
		const {stats} = this;
		const {screenshots, sizes, urls} = stats;
		const words = {
			screenshots: plur('screenshot', screenshots),
			sizes: plur('size', sizes),
			urls: plur('url', urls)
		};

		console.log(`\n${logSymbols.success} Generated ${screenshots} ${words.screenshots} from ${urls} ${words.urls} and ${sizes} ${words.sizes}`);
	}
}
