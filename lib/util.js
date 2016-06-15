import path from 'path';
import easydate from 'easydate';
import fsWriteStreamAtomic from 'fs-write-stream-atomic';
import getRes from 'get-res';
import logSymbols from 'log-symbols';
import mem from 'mem';
import mkdirp from 'mkdirp';
import rimraf from 'rimraf';
import screenshotStream from 'screenshot-stream';
import viewportList from 'viewport-list';
import protocolify from 'protocolify';
import arrayUniq from 'array-uniq';
import filenamifyUrl from 'filenamify-url';
import template from 'lodash.template';
import pify from 'pify';
import plur from 'plur';

const getResMem = mem(getRes);
const viewportListMem = mem(viewportList);

let listener;

/**
 * Fetch ten most popular resolutions
 *
 * @param {String} url
 * @param {Object} options
 * @api private
 */

export async function resolution(url, options) {
	for (const item of await getResMem()) {
		this.sizes.push(item.item);
		this.items.push(this.create(url, item.item, options));
	}
}

/**
 * Fetch keywords
 *
 * @param {Object} obj
 * @param {Object} options
 */

export async function viewport(obj, options) {
	for (const item of await viewportListMem(obj.keywords)) {
		this.sizes.push(item.size);
		obj.sizes.push(item.size);
	}

	for (const size of arrayUniq(obj.sizes)) {
		this.items.push(this.create(obj.url, size, options));
	}
}

/**
 * Save an array of streams to files
 *
 * @param {Array} streams
 * @api private
 */

export async function save(streams) {
	const files = [];

	async function end() {
		return await Promise.all(files.map(file => pify(rimraf)(file)));
	}

	if (!listener) {
		listener = process.on('SIGINT', async () => {
			process.exit(await end()); // eslint-disable-line xo/no-process-exit
		});
	}

	return await Promise.all(streams.map(stream =>
		new Promise(async (resolve, reject) => {
			await pify(mkdirp)(this.dest());

			const dest = path.join(this.dest(), stream.filename);
			const write = fsWriteStreamAtomic(dest);

			files.push(write.__atomicTmp);

			stream.on('warn', this.emit.bind(this, 'warn'));
			stream.on('error', err => end().then(reject(err)));

			write.on('finish', resolve);
			write.on('error', err => end().then(reject(err)));

			stream.pipe(write);
		})
	));
}

/**
 * Create a pageres stream
 *
 * @param {String} uri
 * @param {String} size
 * @param {Object} options
 * @api private
 */

export function create(uri, size, options) {
	const sizes = size.split('x');
	const stream = screenshotStream(protocolify(uri), size, options);
	const filename = template(`${options.filename}.${options.format}`);

	if (path.isAbsolute(uri)) {
		uri = path.basename(uri);
	}

	stream.filename = filename({
		crop: options.crop ? '-cropped' : '',
		date: easydate('Y-M-d'),
		time: easydate('h-m-s'),
		size,
		width: sizes[0],
		height: sizes[1],
		url: filenamifyUrl(uri)
	});

	return stream;
}

/**
 * Success message
 *
 * @api private
 */

export function successMessage() {
	const stats = this.stats;
	const {screenshots, sizes, urls} = stats;
	const words = {
		screenshots: plur('screenshot', screenshots),
		sizes: plur('size', sizes),
		urls: plur('url', urls)
	};

	console.log(`\n${logSymbols.success} Generated ${screenshots} ${words.screenshots} from ${urls} ${words.urls} and ${sizes} ${words.sizes}`);
}
