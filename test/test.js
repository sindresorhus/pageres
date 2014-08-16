'use strict';
var fs = require('fs');
var test = require('ava');
var imageSize = require('image-size');
var concat = require('concat-stream');
var date = require('easydate');
var PNG = require('png-js')
var Pageres = require('../');
var Server = require('./serverForCookieTests');;

process.chdir(__dirname);

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

test('rename image using the `name` option', function (t) {
	t.plan(3);

	var pageres = new Pageres()
		.src('http://todomvc.com', ['1024x768'], { name: '<%= date %> - <%= url %>' });

	pageres.run(function (err, streams) {
		t.assert(!err, err);
		t.assert(streams.length === 1);
		t.assert(streams[0].filename === date('Y-M-d') + ' - todomvc.com.png');
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
	t.plan(2);

	var pageres = new Pageres()
		.src('http://todomvc.com', ['1024x768'])
		.dest(__dirname);

	pageres.run(function (err) {
		t.assert(!err, err);
		t.assert(fs.existsSync('todomvc.com-1024x768.png'));
		fs.unlinkSync('todomvc.com-1024x768.png');
	});
});

function cookieTest (port, input, t) {
	t.plan(6);
	var server = new Server(port);
	var filename = 'localhost!' + port + '-320x480.png';

	var pageres = new Pageres({cookies: [input]})
		.src('http://localhost:' + port, ['320x480'])
		.dest(__dirname);

	pageres.run(function(err) {
		server.close();

		t.assert(!err, err);
		t.assert(fs.existsSync(filename));

		PNG.decode(filename, function(pixels) {
			fs.unlinkSync(filename);
			t.assert(pixels[0] === 0);
			t.assert(pixels[1] === 0);
			t.assert(pixels[2] === 0);
			t.assert(pixels[3] === 255);
		});
	});
}

test('send cookie', cookieTest.bind(null, 5000, 'pageresColor=black; Path=/; Domain=localhost'));

test('send cookie using an object', cookieTest.bind(null, 5001, {
	name: 'pageresColor',
	value: 'black',
	domain: 'localhost'
}));
