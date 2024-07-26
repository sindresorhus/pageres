import process from 'node:process';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import test from 'ava';
import {imageDimensionsFromData} from 'image-dimensions';
import {format as formatDate} from 'date-fns';
import PNG from 'png.js';
import pify from 'pify';
import {pathExists} from 'path-exists';
import {stub as sinonStub} from 'sinon';
import {fileTypeFromBuffer} from 'file-type';
import Pageres, {type Screenshot} from '../source/index.js';
import {type TestServer, createServer} from './_server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const hasScreenshotsWithFilenames = (screenshots: readonly Screenshot[], filenames: readonly string[]): boolean => screenshots.some(screenshot => filenames.includes(screenshot.filename));

const getPngPixels = async (data: Uint8Array): Promise<Uint8Array> => {
	const png = new PNG(data);
	const {pixels} = await pify(png.parse.bind(png))();
	return pixels;
};

let server: TestServer;
let serverFileName: string;
test.before(async () => {
	server = await createServer();
	serverFileName = server.url
		.replace('http://', '')
		.replace(':', '!');
});

test.after(() => {
	server.close();
});

test('expose a constructor', t => {
	t.is(typeof Pageres, 'function');
});

test('`.source()` - error if no correct `url` is specified', t => {
	t.throws(() => {
		new Pageres().source('', ['1280x1024', '1920x1080']);
	}, {message: 'URL required'});
});

test('`.source()` - error if no `sizes` is specified', t => {
	t.throws(() => {
		new Pageres().source(server.url, []);
	}, {message: 'Sizes required'});
});

test('`.destination()` - error if no correct `directory` is specified', t => {
	t.throws(() => {
		new Pageres().destination('');
	}, {message: 'Directory required'});
});

test('generate screenshots', async t => {
	const screenshots = await new Pageres()
		.source(server.url, ['480x320', '1024x768', 'iphone 5s'])
		.source(server.url, ['1280x1024', '1920x1080'])
		.run();

	t.is(screenshots.length, 5);
	t.true(hasScreenshotsWithFilenames(screenshots, [`${serverFileName}-480x320.png`]));
	t.true(hasScreenshotsWithFilenames(screenshots, [`${serverFileName}-1920x1080.png`]));
	t.true(screenshots[0].length > 1000);
});

test('generate screenshots - multiple sizes for one URL', async t => {
	const screenshots = await new Pageres()
		.source(server.url, ['1280x1024', '1920x1080'])
		.run();

	t.is(screenshots.length, 2);
	t.true(hasScreenshotsWithFilenames(screenshots, [`${serverFileName}-1280x1024.png`]));
	t.true(hasScreenshotsWithFilenames(screenshots, [`${serverFileName}-1920x1080.png`]));
	t.true(screenshots[0].length > 1000);
});

test('save filename with hash', async t => {
	const screenshots = await new Pageres()
		.source('https://example.com#', ['480x320'])
		.source('https://example.com/#/', ['480x320'])
		.source('https://example.com/#/@user', ['480x320'])
		.source('https://example.com/#/product/listing', ['480x320'])
		.source('https://example.com/#!/bang', ['480x320'])
		.source('https://example.com#readme', ['480x320'])
		.run();

	t.is(screenshots.length, 6);

	t.true(hasScreenshotsWithFilenames(screenshots, [
		'example.com!#-480x320.png',
		'example.com!#-480x320.png',
		'example.com!#!@user-480x320.png',
		'example.com!#!product!listing-480x320.png',
		'example.com!#!bang-480x320.png',
		'example.com#readme-480x320.png',
	]));

	t.true(screenshots[0].length > 1000);
});

test.serial('success message', async t => {
	const stub = sinonStub(console, 'log');
	const pageres = new Pageres().source(server.url, ['480x320', '1024x768', 'iphone 5s']);
	await pageres.run();
	pageres.successMessage();
	const [message] = stub.firstCall.args;
	t.true(message.includes('Generated 3 screenshots from 1 url and 1 size'), message); // eslint-disable-line ava/assertion-arguments
	stub.restore();
});

test('remove special characters from the URL to create a valid filename', async t => {
	const screenshots = await new Pageres().source(`${server.url}?query=pageres*|<>:"\\`, ['1024x768']).run();
	t.is(screenshots.length, 1);
	t.is(screenshots[0].filename, `${server.host}!${server.port}!query=pageres-1024x768.png`);
});

test('`delay` option', async t => {
	const now = Date.now();
	await new Pageres({delay: 2}).source(server.url, ['1024x768']).run();
	t.true(Date.now() - now > 2000);
});

test('`crop` option', async t => {
	const screenshots = await new Pageres({crop: true}).source(server.url, ['1024x768']).run();
	t.is(screenshots[0].filename, `${server.host}!${server.port}-1024x768-cropped.png`);

	const size = imageDimensionsFromData(screenshots[0]) as any;
	t.is(size.width, 1024);
	t.is(size.height, 768);
});

test('`css` option', async t => {
	const screenshots = await new Pageres({css: 'body { background-color: red !important; }'}).source(server.url, ['1024x768']).run();
	const pixels = await getPngPixels(screenshots[0]);
	t.is(pixels[0], 255);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
});

test('`script` option', async t => {
	const screenshots = await new Pageres({
		script: 'document.body.style.backgroundColor = \'red\';',
	}).source(server.url, ['1024x768']).run();
	const pixels = await getPngPixels(screenshots[0]);
	t.is(pixels[0], 255);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
});

test('`filename` option', async t => {
	const screenshots = await new Pageres()
		.source(server.url, ['1024x768'], {
			filename: '<%= date %> - <%= time %> - <%= url %>',
		})
		.run();

	t.is(screenshots.length, 1);
	t.regex(screenshots[0].filename, new RegExp(`${formatDate(Date.now(), 'yyyy-MM-dd')} - \\d{2}-\\d{2}-\\d{2} - ${server.host}!${server.port}.png`));
});

test('`selector` option', async t => {
	const screenshots = await new Pageres({selector: '#team'}).source(server.url, ['1024x768']).run();
	t.is(screenshots[0].filename, `${server.host}!${server.port}-1024x768.png`);

	const size = imageDimensionsFromData(screenshots[0]) as any;
	t.is(size.width, 1024);
	t.is(size.height, 80);
});

test.serial('support local relative files', async t => {
	const _cwd = process.cwd();
	process.chdir(__dirname);
	const screenshots = await new Pageres().source('fixture.html', ['1024x768']).run();
	t.is(screenshots[0].filename, 'fixture.html-1024x768.png');
	t.true(screenshots[0].length > 1000);
	process.chdir(_cwd);
});

test('support local absolute files', async t => {
	const screenshots = await new Pageres().source(path.join(__dirname, 'fixture.html'), ['1024x768']).run();
	t.is(screenshots[0].filename, 'fixture.html-1024x768.png');
	t.true(screenshots[0].length > 1000);
});

/// test('fetch resolutions from w3counter', async t => {
// 	const screenshots = await new Pageres().source(server.url, ['w3counter']).run();
// 	t.is(screenshots.length, 10);
// 	t.true(screenshots[0].length > 1000);
// });

test('save image', async t => {
	try {
		await new Pageres().source(server.url, ['1024x768']).destination(__dirname).run();
		t.true(fs.existsSync(path.join(__dirname, `${server.host}!${server.port}-1024x768.png`)));
	} finally {
		await fsPromises.unlink(path.join(__dirname, `${server.host}!${server.port}-1024x768.png`));
	}
});

test('remove temporary files on error', async t => {
	await t.throwsAsync(
		new Pageres().source('https://this-is-a-error-site.io', ['1024x768']).destination(__dirname).run(),
		{
			message: /ERR_NAME_NOT_RESOLVED/,
		},
	);
	t.false(await pathExists(path.join(__dirname, 'this-is-a-error-site.io.png')));
});

test('auth using username and password', async t => {
	const screenshots = await new Pageres({
		username: 'user',
		password: 'passwd',
	}).source('https://httpbin.org/basic-auth/user/passwd', ['120x120']).run();

	t.is(screenshots.length, 1);
	t.true(screenshots[0].length > 0);
});

test('`scale` option', async t => {
	const screenshots = await new Pageres({
		scale: 2,
		crop: true,
	}).source(server.url, ['120x120']).run();

	const size = imageDimensionsFromData(screenshots[0]) as any;
	t.is(size.width, 240);
	t.is(size.height, 240);
});

test('support data URL', async t => {
	const screenshots = await new Pageres().source('data:text/html;base64,PGgxPkZPTzwvaDE+', ['100x100']).run();
	const fileType = await fileTypeFromBuffer(screenshots[0]);
	t.is(fileType?.mime, 'image/png');
});

test('`format` option', async t => {
	const screenshots = await new Pageres().source(server.url, ['100x100'], {format: 'jpg'}).run();
	const fileType = await fileTypeFromBuffer(screenshots[0]);
	t.is(fileType?.mime, 'image/jpeg');
});

test('when a file exists, append an incrementer', async t => {
	const folderPath = process.cwd();
	try {
		await new Pageres({delay: 2}).source(server.url, ['1024x768', '480x320'], {incrementalName: true, filename: '<%= url %>'}).destination(folderPath).run();
		t.true(fs.existsSync(path.join(folderPath, `${serverFileName}.png`)));
		await new Pageres({delay: 2}).source(server.url, ['1024x768', '480x320'], {incrementalName: true, filename: '<%= url %>'}).destination(folderPath).run();
		t.true(fs.existsSync(path.join(folderPath, `${serverFileName} (1).png`)));
	} finally {
		await fsPromises.unlink(path.join(folderPath, `${serverFileName}.png`));
		await fsPromises.unlink(path.join(folderPath, `${serverFileName} (1).png`));
	}
});
