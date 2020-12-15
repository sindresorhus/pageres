import test, {ExecutionContext} from 'ava';
import PNG = require('png.js');
import pify = require('pify');
import Pageres from '../source';
import {createCookieServer} from './_server';

type Cookie = Record<string, string>;

async function cookieTest(input: string | Cookie, t: ExecutionContext): Promise<void> {
	const server = await createCookieServer();

	const screenshots = await new Pageres({cookies: [input]})
		.src(server.url, ['320x480'])
		.run();

	server.close();

	const png = new PNG(screenshots[0]);
	const {pixels} = await pify(png.parse.bind(png))();

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
