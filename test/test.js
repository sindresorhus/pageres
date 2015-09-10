import fs from 'fs';
import test from 'ava';
import imageSize from 'image-size';
import concatStream from 'concat-stream';
import easydate from 'easydate';
import PNG from 'png-js';
import Pageres from '../';
import Server from './serverForCookieTests';

process.chdir(__dirname);

test('expose a constructor', t => {
	t.is(typeof Pageres, 'function');
	t.end();
});

test('return an instance if it called without `new`', t => {
	const pageres = Pageres;
	t.true(pageres() instanceof Pageres);
	t.end();
});

test('add a source', t => {
	const pageres = new Pageres()
		.src('yeoman.io', ['1280x1024', '1920x1080']);

	t.is(pageres._src[0].url, 'yeoman.io');
	t.end();
});

test('set destination directory', t => {
	const pageres = new Pageres()
		.dest('tmp');

	t.is(pageres._dest, 'tmp');
	t.end();
});

test('error if no url is specified', t => {
	t.plan(2);

	new Pageres()
		.src('', [])
		.run(err => {
			t.ok(err);
			t.is(err.message, 'URL required');
		});
});

test('generate screenshots', t => {
	t.plan(5);

	const pageres = new Pageres()
		.src('yeoman.io', ['480x320', '1024x768', 'iphone 5s'])
		.src('todomvc.com', ['1280x1024', '1920x1080']);

	pageres.run((err, streams) => {
		t.ifError(err);
		t.is(streams.length, 5);
		t.is(streams[0].filename, 'todomvc.com-1280x1024.png');
		t.is(streams[4].filename, 'yeoman.io-320x568.png');
		streams[0].once('data', data => t.true(data.length > 1000));
	});
});

test('remove special characters from the URL to create a valid filename', t => {
	t.plan(3);

	const pageres = new Pageres()
		.src('http://www.microsoft.com/?query=pageres*|<>:"\\', ['1024x768']);

	pageres.run((err, streams) => {
		t.ifError(err);
		t.is(streams.length, 1);
		t.is(streams[0].filename, 'microsoft.com!query=pageres-1024x768.png');
	});
});

test('have a `delay` option', t => {
	t.plan(2);

	const pageres = new Pageres({delay: 2})
		.src('http://todomvc.com', ['1024x768']);

	pageres.run((err, streams) => {
		t.ifError(err);

		const now = Date.now();
		streams[0].once('data', () => t.true(Date.now() - now > 2000));
	});
});

test('crop image using the `crop` option', t => {
	t.plan(4);

	const pageres = new Pageres({crop: true})
		.src('http://todomvc.com', ['1024x768']);

	pageres.run((err, streams) => {
		t.ifError(err);
		t.is(streams[0].filename, 'todomvc.com-1024x768-cropped.png');

		streams[0].pipe(concatStream(data => {
			const size = imageSize(data);
			t.is(size.width, 1024);
			t.is(size.height, 768);
		}));
	});
});

test('rename image using the `filename` option', t => {
	t.plan(3);

	const pageres = new Pageres()
		.src('http://todomvc.com', ['1024x768'], {
			filename: '<%= date %> - <%= time %> - <%= url %>'
		});

	pageres.run((err, streams) => {
		t.ifError(err);
		t.is(streams.length, 1);
		t.is(streams[0].filename, `${easydate('Y-M-d')} - ${easydate('h-m-s')} - todomvc.com.png`);
	});
});

test('capture a DOM element using the `selector` option', t => {
	t.plan(4);

	const pageres = new Pageres({
		selector: '.page-header'
	}).src('http://yeoman.io', ['1024x768']);

	pageres.run((err, streams) => {
		t.ifError(err);
		t.is(streams[0].filename, 'yeoman.io-1024x768.png');

		streams[0].pipe(concatStream(data => {
			const size = imageSize(data);
			t.is(size.width, 1024);
			t.is(size.height, 80);
		}));
	});
});

test('support local relative files', t => {
	t.plan(3);

	const pageres = new Pageres()
		.src('fixture.html', ['1024x768']);

	pageres.run((err, streams) => {
		t.ifError(err);
		t.is(streams[0].filename, 'fixture.html-1024x768.png');
		streams[0].once('data', data => t.true(data.length > 1000));
	});
});

test('fetch resolutions from w3counter', t => {
	t.plan(3);

	const pageres = new Pageres()
		.src('yeoman.io', ['w3counter']);

	pageres.run((err, streams) => {
		t.ifError(err);
		t.is(streams.length, 10);
		streams[0].once('data', data => t.true(data.length > 1000));
	});
});

test('save image', t => {
	t.plan(3);

	const pageres = new Pageres()
		.src('http://todomvc.com', ['1024x768'])
		.dest(__dirname);

	pageres.run(err => {
		t.ifError(err);
		t.true(fs.existsSync('todomvc.com-1024x768.png'));
		fs.unlink('todomvc.com-1024x768.png', err => t.ifError(err));
	});
});

test('remove temporary files on error', t => {
	t.plan(4);

	const pageres = new Pageres()
		.src('this-is-a-error-site.io', ['1024x768'])
		.dest(__dirname);

	pageres.run(err => {
		t.ok(err);
		t.is(err.message, 'Couldn\'t load url: http://this-is-a-error-site.io');

		fs.readdir(__dirname, (err, files) => {
			t.ifError(err);
			t.is(files.indexOf('this-is-a-error-site.io.png'), -1);
		});
	});
});

test('auth using username and password', t => {
	t.plan(3);

	const pageres = new Pageres({
		username: 'user',
		password: 'passwd'
	}).src('httpbin.org/basic-auth/user/passwd', ['120x120']);

	pageres.run((err, streams) => {
		t.ifError(err);
		t.is(streams.length, 1);
		streams[0].once('data', data => t.ok(data.length));
	});
});

test('scale webpage using the `scale` option', t => {
	t.plan(3);

	const pageres = new Pageres({
		scale: 2,
		crop: true
	}).src('yeoman.io', ['120x120']);

	pageres.run((err, streams) => {
		t.ifError(err);

		streams[0].pipe(concatStream(data => {
			const size = imageSize(data);
			t.is(size.width, 240);
			t.is(size.height, 240);
		}));
	});
});

function cookieTest(port, input, t) {
	t.plan(6);

	const server = new Server(port);
	const filename = `localhost!${port}-320x480.png`;

	const pageres = new Pageres({
		cookies: [input]
	}).src(`http://localhost:${port}`, ['320x480']);

	pageres.run((err, streams) => {
		t.ifError(err);
		t.is(streams[0].filename, filename);

		streams[0].pipe(concatStream(data => {
			server.close();

			const png = new PNG(data);

			png.decode(pixels => {
				t.is(pixels[0], 0);
				t.is(pixels[1], 0);
				t.is(pixels[2], 0);
				t.is(pixels[3], 255);
			});
		}));
	});
}

test('send cookie', cookieTest.bind(null, 5000, 'pageresColor=black; Path=/; Domain=localhost'));

test('send cookie using an object', cookieTest.bind(null, 5001, {
	name: 'pageresColor',
	value: 'black',
	domain: 'localhost'
}));
