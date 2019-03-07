import fs from 'fs';
import path from 'path';
import test from 'ava';
import imageSize from 'image-size';
import easydate from 'easydate';
import PNG from 'png-js';
import pify from 'pify';
import pathExists from 'path-exists';
import sinon from 'sinon';
import fileType from 'file-type';
import Pageres, {Screenshot} from '../source';
import {createServer} from './_server';

const fsP = pify(fs);

const hasScreenshotsWithFilenames = (screenshots: Screenshot[], filenames: string[]): boolean => {
	return screenshots.some(screenshot => filenames.includes(screenshot.filename));
};

const getPngPixels = async (buffer: any): Promise<Buffer> => {
	const png = new PNG(buffer);
	const pixels = await pify(png.decode.bind(png), {errorFirst: false})();
	return pixels;
};

let server: any;
test.before(async () => {
	server = await createServer();
});

test.after(() => {
	server.close();
});

test('expose a constructor', t => {
	t.is(typeof Pageres, 'function');
});

test('add a source', t => {
	const pageres = new Pageres().src('https://yeoman.io', ['1280x1024', '1920x1080']);
	t.is((pageres as any)._source[0].url, 'https://yeoman.io');
});

test('set destination directory', t => {
	t.is((new Pageres().dest('tmp') as any)._destination, 'tmp');
});

test('`.src()` - error if no correct `url` is specified', t => {
	t.throws(() => {
		// @ts-ignore
		new Pageres().src('');
	}, 'URL required');
});

test('`.src()` - error if no `sizes` is specified', t => {
	t.throws(() => {
		// @ts-ignore
		new Pageres().src('https://sindresorhus.com');
	}, 'Sizes required');
});

test('`.dest()` - error if no correct `directory` is specified', t => {
	t.throws(() => {
		new Pageres().dest('');
	}, 'Directory required');
});

test('generate screenshots', async t => {
	const screenshots = await new Pageres()
		.src('https://yeoman.io', ['480x320', '1024x768', 'iphone 5s'])
		.src('https://sindresorhus.com', ['1280x1024', '1920x1080'])
		.run();

	t.is(screenshots.length, 5);
	t.true(hasScreenshotsWithFilenames(screenshots, ['yeoman.io-480x320.png']));
	t.true(hasScreenshotsWithFilenames(screenshots, ['sindresorhus.com-1920x1080.png']));
	t.true(screenshots[0].length > 1000);
});

test('generate screenshots - multiple sizes for one URL', async t => {
	const screenshots = await new Pageres()
		.src('https://sindresorhus.com', ['1280x1024', '1920x1080'])
		.run();

	t.is(screenshots.length, 2);
	t.true(hasScreenshotsWithFilenames(screenshots, ['sindresorhus.com-1280x1024.png']));
	t.true(hasScreenshotsWithFilenames(screenshots, ['sindresorhus.com-1920x1080.png']));
	t.true(screenshots[0].length > 1000);
});

test('save filename with hash', async t => {
	const screenshots = await new Pageres()
		.src('https://example.com#', ['480x320'])
		.src('https://example.com/#/', ['480x320'])
		.src('https://example.com/#/@user', ['480x320'])
		.src('https://example.com/#/product/listing', ['480x320'])
		.src('https://example.com/#!/bang', ['480x320'])
		.src('https://example.com#readme', ['480x320'])
		.run();

	t.is(screenshots.length, 6);

	t.true(hasScreenshotsWithFilenames(screenshots, [
		'example.com-480x320.png',
		'example.com-480x320.png',
		'example.com#!@user-480x320.png',
		'example.com#!product!listing-480x320.png',
		'example.com#!bang-480x320.png',
		'example.com#readme-480x320.png'
	]));

	t.true(screenshots[0].length > 1000);
});

test('success message', async t => {
	const stub = sinon.stub(console, 'log');
	const pageres = new Pageres().src(server.url, ['480x320', '1024x768', 'iphone 5s']);
	await pageres.run();
	pageres.successMessage();
	t.true(/Generated 3 screenshots from 1 url and 1 size/.test(stub.firstCall.args[0]));
	stub.restore();
});

test('remove special characters from the URL to create a valid filename', async t => {
	const screenshots = await new Pageres().src(`${server.url}?query=pageres*|<>:"\\`, ['1024x768']).run();
	t.is(screenshots.length, 1);
	t.is(screenshots[0].filename, `${server.host}!${server.port}!query=pageres-1024x768.png`);
});

test('`delay` option', async t => {
	const now = Date.now();
	await new Pageres({delay: 2}).src(server.url, ['1024x768']).run();
	t.true(Date.now() - now > 2000);
});

test('`crop` option', async t => {
	const screenshots = await new Pageres({crop: true}).src(server.url, ['1024x768']).run();
	t.is(screenshots[0].filename, `${server.host}!${server.port}-1024x768-cropped.png`);

	const size = imageSize(screenshots[0]);
	t.is(size.width, 1024);
	t.is(size.height, 768);
});

test('`css` option', async t => {
	const screenshots = await new Pageres({css: 'body { background-color: red !important; }'}).src(server.url, ['1024x768']).run();
	const pixels = await getPngPixels(screenshots[0]);
	t.is(pixels[0], 255);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
});

test('`script` option', async t => {
	const screenshots = await new Pageres({
		script: 'document.body.style.backgroundColor = \'red\';'
	}).src(server.url, ['1024x768']).run();
	const pixels = await getPngPixels(screenshots[0]);
	t.is(pixels[0], 255);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
});

test('`filename` option', async t => {
	const screenshots = await new Pageres()
		.src(server.url, ['1024x768'], {
			filename: '<%= date %> - <%= time %> - <%= url %>'
		})
		.run();

	t.is(screenshots.length, 1);
	t.regex(screenshots[0].filename, new RegExp(`${easydate('Y-M-d')} - \\d{2}-\\d{2}-\\d{2} - ${server.host}!${server.port}.png`));
});

test('`selector` option', async t => {
	const screenshots = await new Pageres({selector: '#team'}).src(server.url, ['1024x768']).run();
	t.is(screenshots[0].filename, `${server.host}!${server.port}-1024x768.png`);

	const size = imageSize(screenshots[0]);
	t.is(size.width, 1024);
	t.is(size.height, 80);
});

test.serial('support local relative files', async t => {
	const _cwd = process.cwd();
	process.chdir(__dirname);
	const screenshots = await new Pageres().src('fixture.html', ['1024x768']).run();
	t.is(screenshots[0].filename, 'fixture.html-1024x768.png');
	t.true(screenshots[0].length > 1000);
	process.chdir(_cwd);
});

test('support local absolute files', async t => {
	const screenshots = await new Pageres().src(path.join(__dirname, 'fixture.html'), ['1024x768']).run();
	t.is(screenshots[0].filename, 'fixture.html-1024x768.png');
	t.true(screenshots[0].length > 1000);
});

test('fetch resolutions from w3counter', async t => {
	const screenshots = await new Pageres().src(server.url, ['w3counter']).run();
	t.is(screenshots.length, 10);
	t.true(screenshots[0].length > 1000);
});

test('save image', async t => {
	try {
		await new Pageres().src(server.url, ['1024x768']).dest(__dirname).run();
		t.true(fs.existsSync(path.join(__dirname, `${server.host}!${server.port}-1024x768.png`)));
	} finally {
		await fsP.unlink(path.join(__dirname, `${server.host}!${server.port}-1024x768.png`));
	}
});

test('remove temporary files on error', async t => {
	await t.throwsAsync(
		new Pageres().src('https://this-is-a-error-site.io', ['1024x768']).dest(__dirname).run(),
		/ERR_NAME_NOT_RESOLVED/
	);
	t.false(await pathExists(path.join(__dirname, 'this-is-a-error-site.io.png')));
});

test('auth using username and password', async t => {
	const screenshots = await new Pageres({
		username: 'user',
		password: 'passwd'
	}).src('https://httpbin.org/basic-auth/user/passwd', ['120x120']).run();

	t.is(screenshots.length, 1);
	t.true(screenshots[0].length > 0);
});

test('`scale` option', async t => {
	const screenshots = await new Pageres({
		scale: 2,
		crop: true
	}).src(server.url, ['120x120']).run();

	const size = imageSize(screenshots[0]);
	t.is(size.width, 240);
	t.is(size.height, 240);
});

test('support data URL', async t => {
	const screenshots = await new Pageres().src('data:text/html;base64,PGgxPkZPTzwvaDE+', ['100x100']).run();
	t.is((fileType(screenshots[0]) as any).mime, 'image/png');
});

test('`format` option', async t => {
	const screenshots = await new Pageres().src('https://sindresorhus.com', ['100x100'], {format: 'jpg'}).run();
	t.is((fileType(screenshots[0]) as any).mime, 'image/jpeg');
});

test('when a file exists, append an incrementer', async t => {
	const folderPath = process.cwd();
	try {
		await new Pageres({delay: 2}).src('https://yeoman.io', ['1024x768', '480x320'], {incrementalName: true, filename: '<%= url %>'}).dest(folderPath).run();
		t.true(fs.existsSync(path.join(folderPath, 'yeoman.io.png')));
		await new Pageres({delay: 2}).src('https://yeoman.io', ['1024x768', '480x320'], {incrementalName: true, filename: '<%= url %>'}).dest(folderPath).run();
		t.true(fs.existsSync(path.join(folderPath, 'yeoman.io (1).png')));
	} finally {
		await fsP.unlink(path.join(folderPath, 'yeoman.io.png'));
		await fsP.unlink(path.join(folderPath, 'yeoman.io (1).png'));
	}
});
