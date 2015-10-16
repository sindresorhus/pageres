import fs from 'fs';
import test from 'ava';
import imageSize from 'image-size';
import easydate from 'easydate';
import PNG from 'png-js';
import getStream from 'get-stream';
import pify from 'pify';
import rfpify from 'rfpify';
import Promise from 'pinkie-promise';
import pathExists from 'path-exists';
import Pageres from '../dist';
import Server from './serverForCookieTests';

const promiseFs = pify.all(fs, Promise);

process.chdir(__dirname);

test('expose a constructor', t => {
	t.is(typeof Pageres, 'function');
	t.end();
});

test('add a source', t => {
	const pageres = new Pageres().src('yeoman.io', ['1280x1024', '1920x1080']);
	t.is(pageres._src[0].url, 'yeoman.io');
	t.end();
});

test('set destination directory', t => {
	t.is((new Pageres().dest('tmp'))._dest, 'tmp');
	t.end();
});

test('error if no url is specified', async t => {
	try {
		await new Pageres().src('', []).run();
		t.fail();
	} catch (err) {
		t.ok(err);
		t.is(err.message, 'URL required');
	}
});

test('generate screenshots', async t => {
	const streams = await new Pageres()
		.src('yeoman.io', ['480x320', '1024x768', 'iphone 5s'])
		.src('todomvc.com', ['1280x1024', '1920x1080'])
		.run();

	t.is(streams.length, 5);
	t.is(streams[0].filename, 'yeoman.io-480x320.png');
	t.is(streams[1].filename, 'yeoman.io-1024x768.png');
	t.is(streams[2].filename, 'yeoman.io-320x568.png');
	t.is(streams[3].filename, 'todomvc.com-1280x1024.png');
	t.is(streams[4].filename, 'todomvc.com-1920x1080.png');
	t.true((await getStream.buffer(streams[0])).length > 1000);
});

test('remove special characters from the URL to create a valid filename', async t => {
	const streams = await new Pageres().src('http://www.microsoft.com/?query=pageres*|<>:"\\', ['1024x768']).run();
	t.is(streams.length, 1);
	t.is(streams[0].filename, 'microsoft.com!query=pageres-1024x768.png');
});

test('have a `delay` option', async t => {
	const streams = await new Pageres({delay: 2}).src('http://todomvc.com', ['1024x768']).run();
	const now = Date.now();
	await getStream(streams[0]);
	t.true(Date.now() - now > 2000);
});

test('crop image using the `crop` option', async t => {
	const streams = await new Pageres({crop: true}).src('http://todomvc.com', ['1024x768']).run();
	t.is(streams[0].filename, 'todomvc.com-1024x768-cropped.png');

	const size = imageSize(await getStream.buffer(streams[0]));
	t.is(size.width, 1024);
	t.is(size.height, 768);
});

test('rename image using the `filename` option', async t => {
	const streams = await new Pageres()
		.src('http://todomvc.com', ['1024x768'], {
			filename: '<%= date %> - <%= time %> - <%= url %>'
		})
		.run();

	t.is(streams.length, 1);
	t.regexTest(new RegExp(`${easydate('Y-M-d')} - \\d{2}-\\d{2}-\\d{2} - todomvc.com.png`), streams[0].filename);
});

test('capture a DOM element using the `selector` option', async t => {
	const streams = await new Pageres({selector: '.page-header'}).src('http://yeoman.io', ['1024x768']).run();
	t.is(streams[0].filename, 'yeoman.io-1024x768.png');

	const size = imageSize(await getStream.buffer(streams[0]));
	t.is(size.width, 1024);
	t.is(size.height, 80);
});

test('support local relative files', async t => {
	const streams = await new Pageres().src('fixture.html', ['1024x768']).run();
	t.is(streams[0].filename, 'fixture.html-1024x768.png');
	t.true((await getStream.buffer(streams[0])).length > 1000);
});

test('fetch resolutions from w3counter', async t => {
	const streams = await new Pageres().src('yeoman.io', ['w3counter']).run();
	t.is(streams.length, 10);
	t.true((await getStream.buffer(streams[0])).length > 1000);
});

test('save image', async t => {
	try {
		await new Pageres().src('http://todomvc.com', ['1024x768']).dest(__dirname).run();
		t.true(fs.existsSync('todomvc.com-1024x768.png'));
	} finally {
		await promiseFs.unlink('todomvc.com-1024x768.png');
	}
});

test('remove temporary files on error', async t => {
	try {
		await new Pageres().src('this-is-a-error-site.io', ['1024x768']).dest(__dirname).run();
	} catch (err) {
		t.ok(err);
		t.is(err.message, 'Couldn\'t load url: http://this-is-a-error-site.io');
		t.false(await pathExists('this-is-a-error-site.io.png'));
	}
});

test('auth using username and password', async t => {
	const streams = await new Pageres({username: 'user', password: 'passwd'})
		.src('httpbin.org/basic-auth/user/passwd', ['120x120']).run();

	t.is(streams.length, 1);
	t.true((await getStream.buffer(streams[0])).length > 0);
});

test('scale webpage using the `scale` option', async t => {
	const streams = await new Pageres({scale: 2, crop: true}).src('yeoman.io', ['120x120']).run();
	const size = imageSize(await getStream.buffer(streams[0]));
	t.is(size.width, 240);
	t.is(size.height, 240);
});

async function cookieTest(port, input, t) {
	const server = new Server(port);
	const filename = `localhost!${port}-320x480.png`;
	const streams = await new Pageres({cookies: [input]})
		.src(`http://localhost:${port}`, ['320x480']).run();

	t.is(streams[0].filename, filename);

	const data = await getStream.buffer(streams[0]);

	server.close();

	const png = new PNG(data);
	const pixels = await rfpify(png.decode.bind(png), Promise)();

	t.is(pixels[0], 0);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
	t.is(pixels[3], 255);
}

test('send cookie', cookieTest.bind(null, 5000, 'pageresColor=black; Path=/; Domain=localhost'));

test('send cookie using an object', cookieTest.bind(null, 5001, {
	name: 'pageresColor',
	value: 'black',
	domain: 'localhost'
}));
