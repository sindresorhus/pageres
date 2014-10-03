'use strict';
var fs = require('fs');
var spawn = require('child_process').spawn;
var test = require('ava');
var imageSize = require('image-size');
var concat = require('concat-stream');
var date = require('easydate');
var PNG = require('png-js');
var Pageres = require('../');
var Server = require('./serverForCookieTests');

process.chdir(__dirname);

test('expose a constructor', function (t) {
	t.plan(1);
	t.assert(typeof Pageres === 'function');
});

test('add a source', function (t) {
	t.plan(1);

	var pageres = new Pageres()
		.src('yeoman.io', ['1280x1024', '1920x1080']);

	t.assert(pageres._src[0].url === 'yeoman.io');
});

test('set destination directory', function (t) {
	t.plan(1);

	var pageres = new Pageres()
		.dest('tmp');

	t.assert(pageres._dest === 'tmp');
});

test('generate screenshots', function (t) {
	t.plan(5);

	var pageres = new Pageres()
		.src('yeoman.io', ['480x320', '1024x768', 'iphone 5s'])
		.src('todomvc.com', ['1280x1024', '1920x1080']);

	pageres.run(function (err, streams) {
		t.assert(!err, err);
		t.assert(streams.length === 5);
		t.assert(streams[0].filename === 'todomvc.com-1280x1024.png');
		t.assert(streams[4].filename === 'yeoman.io-320x568.png');

		streams[0].once('data', function (data) {
			t.assert(data.length > 1000);
		});
	});
});

test('remove special characters from the URL to create a valid filename', function (t) {
	t.plan(3);

	var pageres = new Pageres()
		.src('http://www.microsoft.com/?query=pageres*|<>:"\\', ['1024x768']);

	pageres.run(function (err, streams) {
		t.assert(!err, err);
		t.assert(streams.length === 1);
		t.assert(streams[0].filename === 'microsoft.com!query=pageres-1024x768.png');
	});
});

test('have a `delay` option', function (t) {
	t.plan(2);

	var pageres = new Pageres({ delay: 2 })
		.src('http://todomvc.com', ['1024x768']);

	pageres.run(function (err, streams) {
		t.assert(!err, err);

		var now = new Date();

		streams[0].once('data', function () {
			t.assert((new Date()) - now > 2000);
		});
	});
});

test('crop image using the `crop` option', function (t) {
	t.plan(4);

	var pageres = new Pageres({ crop: true })
		.src('http://todomvc.com', ['1024x768']);

	pageres.run(function (err, streams) {
		t.assert(!err, err);
		t.assert(streams[0].filename === 'todomvc.com-1024x768-cropped.png');

		streams[0].pipe(concat(function (data) {
			var size = imageSize(data);
			t.assert(size.width === 1024);
			t.assert(size.height === 768);
		}));
	});
});

test('rename image using the `filename` option', function (t) {
	t.plan(3);

	var pageres = new Pageres()
		.src('http://todomvc.com', ['1024x768'], { filename: '<%= date %> - <%= url %>' });

	pageres.run(function (err, streams) {
		t.assert(!err, err);
		t.assert(streams.length === 1);
		t.assert(streams[0].filename === date('Y-M-d') + ' - todomvc.com.png');
	});
});

test('capture a DOM element using the `selector` option', function (t) {
	t.plan(4);

	var pageres = new Pageres({ selector: '.page-header' })
		.src('http://yeoman.io', ['1024x768']);

	pageres.run(function (err, streams) {
		t.assert(!err, err);
		t.assert(streams[0].filename === 'yeoman.io-1024x768.png');

		streams[0].pipe(concat(function (data) {
			var size = imageSize(data);
			t.assert(size.width === 1024);
			t.assert(size.height === 80);
		}));
	});
});

test('support local relative files', function (t) {
	t.plan(3);

	var pageres = new Pageres()
		.src('fixture.html', ['1024x768']);

	pageres.run(function (err, streams) {
		t.assert(!err, err);
		t.assert(streams[0].filename === 'fixture.html-1024x768.png');

		streams[0].once('data', function (data) {
			t.assert(data.length > 1000);
		});
	});
});

test('fetch resolutions from w3counter', function (t) {
	t.plan(3);

	var pageres = new Pageres()
		.src('yeoman.io', ['w3counter']);

	pageres.run(function (err, streams) {
		t.assert(!err, err);
		t.assert(streams.length === 10);

		streams[0].once('data', function (data) {
			t.assert(data.length > 1000);
		});
	});
});

test('save image', function (t) {
	t.plan(3);

	var pageres = new Pageres()
		.src('http://todomvc.com', ['1024x768'])
		.dest(__dirname);

	pageres.run(function (err) {
		t.assert(!err, err);
		t.assert(fs.existsSync('todomvc.com-1024x768.png'));

		fs.unlink('todomvc.com-1024x768.png', function (err) {
			t.assert(!err);
		});
	});
});

test('generate screenshot using the CLI', function (t) {
	t.plan(2);

	spawn('../cli.js', ['yeoman.io', '320x240'], {stdio:'inherit'})
		.on('close', function () {
			t.assert(fs.existsSync('yeoman.io-320x240.png'));

			fs.unlink('yeoman.io-320x240.png', function (err) {
				t.assert(!err);
			});
		});
});

test('auth using username and password', function (t) {
	t.plan(3);

	var pageres = new Pageres({username: 'user', password: 'passwd'})
		.src('httpbin.org/basic-auth/user/passwd', ['120x120']);

	pageres.run(function (err, streams) {
		t.assert(!err, err);
		t.assert(streams.length === 1);

		streams[0].once('data', function (data) {
			t.assert(data.length);
		});
	});
});

function cookieTest (port, input, t) {
	t.plan(6);
	var server = new Server(port);
	var filename = 'localhost!' + port + '-320x480.png';

	var pageres = new Pageres({cookies: [input]})
		.src('http://localhost:' + port, ['320x480']);

	pageres.run(function (err, streams) {
		t.assert(!err, err);
		t.assert(streams[0].filename === filename);

		streams[0].pipe(concat(function (data) {
			server.close();
			var png = new PNG(data);
			png.decode(function (pixels) {
				t.assert(pixels[0] === 0);
				t.assert(pixels[1] === 0);
				t.assert(pixels[2] === 0);
				t.assert(pixels[3] === 255);
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
