import fs from 'fs';
import path from 'path';
import test from 'ava';
import imageSize from 'image-size';
import easydate from 'easydate';
import PNG from 'png-js';
import getStream from 'get-stream';
import pify from 'pify';
import pathExists from 'path-exists';
import sinon from 'sinon';
import Pageres from '../dist';
import {createServer} from './_server';

const fsP = pify(fs);

let s;

test.before(async () => {
	s = await createServer();
});

test.after(() => {
	s.close();
});

test('expose a constructor', t => {
	t.is(typeof Pageres, 'function');
});

test('add a source', t => {
	const pageres = new Pageres().src('yeoman.io', ['1280x1024', '1920x1080']);
	t.is(pageres._src[0].url, 'yeoman.io');
});

test('set destination directory', t => {
	t.is((new Pageres().dest('tmp'))._dest, 'tmp');
});

test('error if no url is specified', async t => {
	await t.throws(new Pageres().src('', []).run(), 'URL required');
});

test('generate screenshots', async t => {
	const streams = await new Pageres()
		.src('yeoman.io', ['480x320', '1024x768', 'iphone 5s'])
		.src('todomvc.com', ['1280x1024', '1920x1080'])
		.run();

	t.is(streams.length, 5);
	t.is(streams[0].filename, 'todomvc.com-1280x1024.png');
	t.is(streams[4].filename, 'yeoman.io-320x568.png');
	t.true((await getStream.buffer(streams[0])).length > 1000);
});

test('save filename with hash', async t => {
	const streams = await new Pageres()
		.src('example.com#', ['480x320'])
		.src('example.com/#/', ['480x320'])
		.src('example.com/#/@user', ['480x320'])
		.src('example.com/#/product/listing', ['480x320'])
		.src('example.com/#!/bang', ['480x320'])
		.src('example.com#readme', ['480x320'])
		.run();

	t.is(streams.length, 6);
	t.is(streams[0].filename, 'example.com-480x320.png');
	t.is(streams[1].filename, 'example.com-480x320.png');
	t.is(streams[2].filename, 'example.com#!@user-480x320.png');
	t.is(streams[3].filename, 'example.com#!product!listing-480x320.png');
	t.is(streams[4].filename, 'example.com#!bang-480x320.png');
	t.is(streams[5].filename, 'example.com#readme-480x320.png');
	t.true((await getStream.buffer(streams[0])).length > 1000);
});

test('success message', async t => {
	const stub = sinon.stub(console, 'log');
	const pageres = new Pageres().src(s.url, ['480x320', '1024x768', 'iphone 5s']);
	await pageres.run();
	pageres.successMessage();
	t.true(/Generated 3 screenshots from 1 url and 1 size/.test(stub.firstCall.args[0]));
	stub.restore();
});

test('remove special characters from the URL to create a valid filename', async t => {
	const streams = await new Pageres().src(`${s.url}?query=pageres*|<>:"\\`, ['1024x768']).run();
	t.is(streams.length, 1);
	t.is(streams[0].filename, `${s.host}!${s.port}!query=pageres-1024x768.png`);
});

test('have a `delay` option', async t => {
	const streams = await new Pageres({delay: 2}).src(s.url, ['1024x768']).run();
	const now = Date.now();
	await getStream(streams[0]);
	t.true(Date.now() - now > 2000);
});

test('crop image using the `crop` option', async t => {
	const streams = await new Pageres({crop: true}).src(s.url, ['1024x768']).run();
	t.is(streams[0].filename, `${s.host}!${s.port}-1024x768-cropped.png`);

	const size = imageSize(await getStream.buffer(streams[0]));
	t.is(size.width, 1024);
	t.is(size.height, 768);
});

test('have a `css` option', async t => {
	const streams = await new Pageres({css: 'body { background-color: red !important; }'}).src(s.url, ['1024x768']).run();
	const png = new PNG(await getStream.buffer(streams[0]));
	const pixels = await pify(png.decode.bind(png), {errorFirst: false})();
	t.is(pixels[0], 255);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
});

test('rename image using the `filename` option', async t => {
	const streams = await new Pageres()
		.src(s.url, ['1024x768'], {
			filename: '<%= date %> - <%= time %> - <%= url %>'
		})
		.run();

	t.is(streams.length, 1);
	t.regex(streams[0].filename, new RegExp(`${easydate('Y-M-d')} - \\d{2}-\\d{2}-\\d{2} - ${s.host}!${s.port}.png`));
});

test('capture a DOM element using the `selector` option', async t => {
	const streams = await new Pageres({selector: '#team'}).src(s.url, ['1024x768']).run();
	t.is(streams[0].filename, `${s.host}!${s.port}-1024x768.png`);

	const size = imageSize(await getStream.buffer(streams[0]));
	t.is(size.width, 1024);
	t.is(size.height, 80);
});

test.serial('support local relative files', async t => {
	const _cwd = process.cwd();
	process.chdir(__dirname);
	const streams = await new Pageres().src('fixture.html', ['1024x768']).run();
	t.is(streams[0].filename, 'fixture.html-1024x768.png');
	t.true((await getStream.buffer(streams[0])).length > 1000);
	process.chdir(_cwd);
});

test('support local absolute files', async t => {
	const streams = await new Pageres().src(path.join(__dirname, 'fixture.html'), ['1024x768']).run();
	t.is(streams[0].filename, 'fixture.html-1024x768.png');
	t.true((await getStream.buffer(streams[0])).length > 1000);
});

test('fetch resolutions from w3counter', async t => {
	const streams = await new Pageres().src(s.url, ['w3counter']).run();
	t.is(streams.length, 10);
	t.true((await getStream.buffer(streams[0])).length > 1000);
});

test('save image', async t => {
	try {
		await new Pageres().src(s.url, ['1024x768']).dest(__dirname).run();
		t.true(fs.existsSync(path.join(__dirname, `${s.host}!${s.port}-1024x768.png`)));
	} finally {
		await fsP.unlink(path.join(__dirname, `${s.host}!${s.port}-1024x768.png`));
	}
});

test.skip('remove temporary files on error', async t => { // eslint-disable-line ava/no-skip-test
	await t.throws(new Pageres().src('this-is-a-error-site.io', ['1024x768']).dest(__dirname).run(), 'Couldn\'t load url: http://this-is-a-error-site.io');
	t.false(await pathExists(path.join(__dirname, 'this-is-a-error-site.io.png')));
});

test('auth using username and password', async t => {
	const streams = await new Pageres({
		username: 'user',
		password: 'passwd'
	}).src('httpbin.org/basic-auth/user/passwd', ['120x120']).run();

	t.is(streams.length, 1);
	t.true((await getStream.buffer(streams[0])).length > 0);
});

test('scale webpage using the `scale` option', async t => {
	const streams = await new Pageres({
		scale: 2,
		crop: true
	}).src(s.url, ['120x120']).run();
	const size = imageSize(await getStream.buffer(streams[0]));
	t.is(size.width, 240);
	t.is(size.height, 240);
});

test('support data uri', async t => {
	const uri = await fsP.readFile(path.join(__dirname, 'fixture.txt'), 'utf8');
	const streams = await new Pageres().src(uri, ['100x100']).run();
	const data = await getStream.buffer(streams[0]);
	const png = new PNG(data);
	const pixels = await pify(png.decode.bind(png), {errorFirst: false})();
	t.is(pixels[0], 0);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
});

test('when a file exists, append an incrementer', async t => {
	const folderPath = process.cwd();
	try {
		await new Pageres({delay: 2}).src('yeoman.io', ['1024x768', '480x320'], {incrementalName: true, filename: '<%= url %>'}).dest(folderPath).run();
		t.true(fs.existsSync(path.join(folderPath, `yeoman.io.png`)));
		await new Pageres({delay: 2}).src('yeoman.io', ['1024x768', '480x320'], {incrementalName: true, filename: '<%= url %>'}).dest(folderPath).run();
		t.true(fs.existsSync(path.join(folderPath, `yeoman.io (1).png`)));
	} finally {
		await fsP.unlink(path.join(folderPath, `yeoman.io.png`));
		await fsP.unlink(path.join(folderPath, `yeoman.io (1).png`));
	}
});
