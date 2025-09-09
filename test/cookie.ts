import {test, describe} from 'node:test';
import assert from 'node:assert/strict';
import PNG from 'png.js';
import Pageres from '../source/index.js';
import {createCookieServer} from './_server.js';

type Cookie = Record<string, string>;

const parsePng = async (data: Uint8Array): Promise<{pixels: Uint8Array}> => {
	const png = new PNG(data);
	return new Promise((resolve, reject) => {
		png.parse((error: Error | undefined, result: any) => {
			if (error) {
				reject(error);
			} else {
				resolve(result);
			}
		});
	});
};

async function cookieTest(input: string | Cookie): Promise<void> {
	const server = await createCookieServer();
	// Width of the screenshot
	const width = 320;
	// Height of the screenshot
	const height = 480;
	// Bits per pixel
	const bpp = 24;

	try {
		const screenshots = await new Pageres({cookies: [input]})
			.source(server.url, [width + 'x' + height])
			.run();

		const {pixels} = await parsePng(screenshots[0]);

		// Validate image size
		assert.equal(pixels.length, width * height * bpp / 8);

		// Validate pixel color
		assert.equal(pixels[0], 64);
		assert.equal(pixels[1], 128);
		assert.equal(pixels[2], 255);
	} finally {
		await server.close();
	}
}

void describe('cookies', () => {
	void test('send cookie', async () => {
		await cookieTest('pageresColor=rgb(64 128 255); Path=/; Domain=localhost');
	});

	void test('send cookie using an object', async () => {
		await cookieTest({
			name: 'pageresColor',
			value: 'rgb(64 128 255)',
			domain: 'localhost',
		});
	});
});
