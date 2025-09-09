import process from 'node:process';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {
	test,
	describe,
	before,
	after,
} from 'node:test';
import assert from 'node:assert/strict';
import {imageDimensionsFromData} from 'image-dimensions';
import {format as formatDate} from 'date-fns';
import PNG from 'png.js';
import {pathExists} from 'path-exists';
import {fileTypeFromBuffer} from 'file-type';
import Pageres, {type Screenshot} from '../source/index.js';
import {type TestServer, createServer} from './_server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const hasScreenshotsWithFilenames = (screenshots: readonly Screenshot[], filenames: readonly string[]): boolean => screenshots.some(screenshot => filenames.includes(screenshot.filename));

const getPngPixels = async (data: Uint8Array): Promise<Uint8Array> => {
	const png = new PNG(data);
	return new Promise((resolve, reject) => {
		png.parse((error: Error | undefined, data: any) => {
			if (error) {
				reject(error);
			} else {
				resolve(data.pixels);
			}
		});
	});
};

void describe('pageres', () => {
	let server: TestServer;
	let serverFileName: string;

	before(async () => {
		server = await createServer();
		serverFileName = server.url
			.replace('http://', '')
			.replace(':', '!');
	});

	after(async () => {
		await server.close();
	});

	void test('expose a constructor', () => {
		assert.equal(typeof Pageres, 'function');
	});

	void test('`.source()` - error if no correct `url` is specified', () => {
		assert.throws(() => {
			new Pageres().source('', ['1280x1024', '1920x1080']);
		}, {message: 'URL required'});
	});

	void test('`.source()` - error if no `sizes` is specified', () => {
		assert.throws(() => {
			new Pageres().source(server.url, []);
		}, {message: 'Sizes required'});
	});

	void test('`.destination()` - error if no correct `directory` is specified', () => {
		assert.throws(() => {
			new Pageres().destination('');
		}, {message: 'Directory required'});
	});

	void test('generate screenshots', async () => {
		const screenshots = await new Pageres()
			.source(server.url, ['480x320', '1024x768', '320x568'])
			.source(server.url, ['1280x1024', '1920x1080'])
			.run();

		assert.equal(screenshots.length, 5);
		assert.ok(hasScreenshotsWithFilenames(screenshots, [`${serverFileName}-480x320.png`]));
		assert.ok(hasScreenshotsWithFilenames(screenshots, [`${serverFileName}-1920x1080.png`]));
		assert.ok(screenshots[0].length > 1000);
	});

	void test('generate screenshots - multiple sizes for one URL', async () => {
		const screenshots = await new Pageres()
			.source(server.url, ['1280x1024', '1920x1080'])
			.run();

		assert.equal(screenshots.length, 2);
		assert.ok(hasScreenshotsWithFilenames(screenshots, [`${serverFileName}-1280x1024.png`]));
		assert.ok(hasScreenshotsWithFilenames(screenshots, [`${serverFileName}-1920x1080.png`]));
		assert.ok(screenshots[0].length > 1000);
	});

	void test('save filename with hash', async () => {
		const screenshots = await new Pageres()
			.source('https://example.com#', ['480x320'])
			.source('https://example.com/#/', ['480x320'])
			.source('https://example.com/#/@user', ['480x320'])
			.source('https://example.com/#/product/listing', ['480x320'])
			.source('https://example.com/#!/bang', ['480x320'])
			.source('https://example.com#readme', ['480x320'])
			.run();

		assert.equal(screenshots.length, 6);

		assert.ok(hasScreenshotsWithFilenames(screenshots, [
			'example.com!#-480x320.png',
			'example.com!#-480x320.png',
			'example.com!#!@user-480x320.png',
			'example.com!#!product!listing-480x320.png',
			'example.com!#!bang-480x320.png',
			'example.com#readme-480x320.png',
		]));

		assert.ok(screenshots[0].length > 1000);
	});

	void test('success message', async () => {
		const originalLog = console.log;
		let capturedMessage = '';
		console.log = (message: string) => {
			capturedMessage = message;
		};

		try {
			const pageres = new Pageres().source(server.url, ['480x320', '1024x768', '320x568']);
			await pageres.run();
			pageres.successMessage();
			assert.ok(capturedMessage.includes('Generated 3 screenshots from 1 url and 3 sizes'));
		} finally {
			console.log = originalLog;
		}
	});

	void test('remove special characters from the URL to create a valid filename', async () => {
		const screenshots = await new Pageres().source(`${server.url}?query=pageres*|<>:"\\`, ['1024x768']).run();
		assert.equal(screenshots.length, 1);
		assert.equal(screenshots[0].filename, `${server.host}!${server.port}!query=pageres-1024x768.png`);
	});

	void test('`delay` option', async () => {
		const now = Date.now();
		await new Pageres({delay: 1}).source(server.url, ['1024x768']).run();
		assert.ok(Date.now() - now > 1000);
	});

	void test('`crop` option', async () => {
		const screenshots = await new Pageres({crop: true}).source(server.url, ['1024x768']).run();
		assert.equal(screenshots[0].filename, `${server.host}!${server.port}-1024x768-cropped.png`);

		const size = imageDimensionsFromData(screenshots[0]) as any;
		assert.equal(size.width, 1024);
		assert.equal(size.height, 768);
	});

	void test('`css` option', async () => {
		const screenshots = await new Pageres({css: 'body { background-color: red !important; }'}).source(server.url, ['1024x768']).run();
		const pixels = await getPngPixels(screenshots[0]);
		assert.equal(pixels[0], 255);
		assert.equal(pixels[1], 0);
		assert.equal(pixels[2], 0);
	});

	void test('`script` option', async () => {
		const screenshots = await new Pageres({
			script: 'document.body.style.backgroundColor = \'red\';',
		}).source(server.url, ['1024x768']).run();
		const pixels = await getPngPixels(screenshots[0]);
		assert.equal(pixels[0], 255);
		assert.equal(pixels[1], 0);
		assert.equal(pixels[2], 0);
	});

	void test('`filename` option', async () => {
		const screenshots = await new Pageres()
			.source(server.url, ['1024x768'], {
				filename: '<%= date %> - <%= time %> - <%= url %>',
			})
			.run();

		assert.equal(screenshots.length, 1);
		assert.match(screenshots[0].filename, new RegExp(`${formatDate(Date.now(), 'yyyy-MM-dd')} - \\d{2}-\\d{2}-\\d{2} - ${server.host}!${server.port}.png`));
	});

	void test('`selector` option', async () => {
		const screenshots = await new Pageres({selector: '#team'}).source(server.url, ['1024x768']).run();
		assert.equal(screenshots[0].filename, `${server.host}!${server.port}-1024x768.png`);

		const size = imageDimensionsFromData(screenshots[0]) as any;
		assert.equal(size.width, 1024);
		assert.equal(size.height, 80);
	});

	void test('`clickElement` option', async () => {
		// Test without clickElement - red modal should be visible
		const screenshotWithModal = await new Pageres().source(path.join(__dirname, 'fixture-clickable.html'), ['300x200']).run();
		const pixelsWithModal = await getPngPixels(screenshotWithModal[0]);

		// Test with clickElement - modal should be hidden after clicking close button
		const screenshotWithoutModal = await new Pageres({clickElement: '#close-button'}).source(path.join(__dirname, 'fixture-clickable.html'), ['300x200']).run();
		const pixelsWithoutModal = await getPngPixels(screenshotWithoutModal[0]);

		// Look for red pixels (modal background) in the first screenshot
		let hasRedPixels = false;
		for (let i = 0; i < pixelsWithModal.length; i += 4) {
			const r = pixelsWithModal[i];
			const g = pixelsWithModal[i + 1];
			const b = pixelsWithModal[i + 2];
			if (r > 200 && g < 50 && b < 50) { // Red pixel
				hasRedPixels = true;
				break;
			}
		}

		// Look for red pixels in the second screenshot (should be fewer/none)
		let hasRedPixelsAfterClick = false;
		for (let i = 0; i < pixelsWithoutModal.length; i += 4) {
			const r = pixelsWithoutModal[i];
			const g = pixelsWithoutModal[i + 1];
			const b = pixelsWithoutModal[i + 2];
			if (r > 200 && g < 50 && b < 50) { // Red pixel
				hasRedPixelsAfterClick = true;
				break;
			}
		}

		// The first screenshot should have red pixels (modal visible)
		// The second screenshot should have fewer or no red pixels (modal hidden)
		assert.ok(hasRedPixels, 'Modal should be visible before clicking');
		assert.equal(hasRedPixelsAfterClick, false, 'Modal should be hidden after clicking close button');
	});

	void test('support local relative files', async () => {
		const _cwd = process.cwd();
		process.chdir(__dirname);
		try {
			const screenshots = await new Pageres().source('fixture.html', ['1024x768']).run();
			assert.equal(screenshots[0].filename, 'fixture.html-1024x768.png');
			assert.ok(screenshots[0].length > 1000);
		} finally {
			process.chdir(_cwd);
		}
	});

	void test('support local absolute files', async () => {
		const screenshots = await new Pageres().source(path.join(__dirname, 'fixture.html'), ['1024x768']).run();
		assert.equal(screenshots[0].filename, 'fixture.html-1024x768.png');
		assert.ok(screenshots[0].length > 1000);
	});

	void test('save image', async () => {
		const filePath = path.join(__dirname, `${server.host}!${server.port}-1024x768.png`);
		try {
			await new Pageres().source(server.url, ['1024x768']).destination(__dirname).run();
			assert.ok(fs.existsSync(filePath));
		} finally {
			if (fs.existsSync(filePath)) {
				await fsPromises.unlink(filePath);
			}
		}
	});

	void test('remove temporary files on error', async () => {
		await assert.rejects(
			new Pageres().source('https://this-is-a-error-site.io', ['1024x768']).destination(__dirname).run(),
			{
				message: /ERR_NAME_NOT_RESOLVED/,
			},
		);
		assert.equal(await pathExists(path.join(__dirname, 'this-is-a-error-site.io.png')), false);
	});

	void test('auth using username and password', async () => {
		const screenshots = await new Pageres({
			username: 'user',
			password: 'passwd',
		}).source('https://httpbin.org/basic-auth/user/passwd', ['120x120']).run();

		assert.equal(screenshots.length, 1);
		assert.ok(screenshots[0].length > 0);
	});

	void test('`scale` option', async () => {
		const screenshots = await new Pageres({
			scale: 2,
			crop: true,
		}).source(server.url, ['120x120']).run();

		const size = imageDimensionsFromData(screenshots[0]) as any;
		assert.equal(size.width, 240);
		assert.equal(size.height, 240);
	});

	void test('support data URL', async () => {
		const screenshots = await new Pageres().source('data:text/html;base64,PGgxPkZPTzwvaDE+', ['100x100']).run();
		const fileType = await fileTypeFromBuffer(screenshots[0]);
		assert.equal(fileType?.mime, 'image/png');
	});

	void test('support HTML input directly using sourceHtml', async () => {
		const htmlString = '<html><body style="background: blue; width: 100px; height: 50px;"><h1>Direct HTML</h1></body></html>';
		const screenshots = await new Pageres().sourceHtml(htmlString, ['100x100']).run();

		assert.equal(screenshots.length, 1);
		assert.ok(screenshots[0].length > 0);

		const fileType = await fileTypeFromBuffer(screenshots[0]);
		assert.equal(fileType?.mime, 'image/png');

		// The filename should be derived from HTML content (or some default)
		assert.ok(screenshots[0].filename.includes('.png'));
	});

	void test('`format` option', async () => {
		const screenshots = await new Pageres().source(server.url, ['100x100'], {format: 'jpg'}).run();
		const fileType = await fileTypeFromBuffer(screenshots[0]);
		assert.equal(fileType?.mime, 'image/jpeg');
	});

	void test('when a file exists, append an incrementer', async () => {
		const folderPath = process.cwd();
		const file1 = path.join(folderPath, `${serverFileName}.png`);
		const file2 = path.join(folderPath, `${serverFileName} (1).png`);

		try {
			await new Pageres().source(server.url, ['1024x768', '480x320'], {incrementalName: true, filename: '<%= url %>'}).destination(folderPath).run();
			assert.ok(fs.existsSync(file1));
			await new Pageres().source(server.url, ['1024x768', '480x320'], {incrementalName: true, filename: '<%= url %>'}).destination(folderPath).run();
			assert.ok(fs.existsSync(file2));
		} finally {
			if (fs.existsSync(file1)) {
				await fsPromises.unlink(file1);
			}

			if (fs.existsSync(file2)) {
				await fsPromises.unlink(file2);
			}
		}
	});
});
