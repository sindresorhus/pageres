import test, {type ExecutionContext} from 'ava';
import PNG from 'png.js';
import pify from 'pify';
import Pageres from '../source/index.js';
import {createCookieServer} from './_server.js';

type Cookie = Record<string, string>;

async function cookieTest(input: string | Cookie, t: ExecutionContext): Promise<void> {
	const server = await createCookieServer();
	// Width of the screenshot
	const width = 320;
	// Height of the screenshot
	const height = 480;
	// Bits per pixel
	const bpp = 24;

	const screenshots = await new Pageres({cookies: [input]})
		.source(server.url, [width + 'x' + height])
		.run();

	server.close();

	const png = new PNG(screenshots[0]);
	const {pixels} = await pify(png.parse.bind(png))();

	// Validate image size
	t.is(pixels.length, width * height * bpp / 8);

	// Validate pixel color
	t.is(pixels[0], 64);
	t.is(pixels[1], 128);
	t.is(pixels[2], 255);
}

test('send cookie', cookieTest.bind(null, 'pageresColor=rgb(64 128 255); Path=/; Domain=localhost'));

test('send cookie using an object', cookieTest.bind(null, {
	name: 'pageresColor',
	value: 'rgb(64 128 255)',
	domain: 'localhost',
}));
