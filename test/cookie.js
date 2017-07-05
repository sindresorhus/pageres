import test from 'ava';
import PNG from 'png-js';
import getStream from 'get-stream';
import pify from 'pify';
import Pageres from '../dist';
import {createCookieServer} from './_server';

async function cookieTest(input, t) {
	const s = await createCookieServer();
	const filename = `${s.host}!${s.port}-320x480.png`;
	const streams = await new Pageres({cookies: [input]})
		.src(s.url, ['320x480'])
		.run();

	t.is(streams[0].filename, filename);

	const data = await getStream.buffer(streams[0]);

	s.close();

	const png = new PNG(data);
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
