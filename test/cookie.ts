import test, {ExecutionContext} from 'ava';
// eslint-disable-next-line ava/no-import-test-files
import PNG from 'png.js';
import pify from 'pify';
import Pageres from '../source';
import {createCookieServer} from './_server';

async function cookieTest(
	input: string | { [key: string]: string },
	t: ExecutionContext
): Promise<void> {
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
