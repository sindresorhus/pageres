'use strict';
var fs = require('fs');
var test = require('ava');
var imageSize = require('image-size');
var concat = require('concat-stream');
var Pageres = require('../');
var Server = require('./serverForCookieTests');
var PNG = require('png-js');

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
		cb();
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

test('send cookie', function(t) {
	t.plan(6);
	var server = new Server();
	var filename = 'localhost!1337-320x480.png';

	var pageres = new Pageres({cookies: ['pageresColor=black; Path=/; Domain=localhost']})
		.src('http://localhost:1337', ['320x480'])
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
});
