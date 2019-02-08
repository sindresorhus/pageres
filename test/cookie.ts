import test from 'ava';
import PNG from 'png-js';
import pify from 'pify';
import Pageres from '../source';
import {createCookieServer} from './_server';

async function cookieTest(input, t): Promise<void> {
	const server = await createCookieServer();

	const screenshots = await new Pageres({cookies: [input]})
		.src(server.url, ['320x480'])
		.run();

	server.close();

	const png = new PNG(screenshots[0]);
	const pixels = await pify(png.decode.bind(png), {errorFirst: false})();

	t.is(pixels[0], 0);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
	t.is(pixels[3], 255);
}

test('send cookie', cookieTest.bind(null, 'pageresColor=black; Path=/; Domain=localhost'));

test('send cookie using an object', cookieTest.bind(null, {
	name: 'pageresColor',
	value: 'black',
	domain: 'localhost'
}));
