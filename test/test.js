'use strict';
var assert = require('assert');
var fs = require('fs');
var imageSize = require('image-size');
var concat = require('concat-stream');
var Pageres = require('../');

process.chdir(__dirname);

before(function () {
	this.timeout(20000);
});

it('should generate screenshots', function (cb) {
	var pageres = new Pageres()
		.src('yeoman.io', ['480x320', '1024x768', 'iphone5s'])
		.src('todomvc.com', ['1280x1024', '1920x1080']);

	pageres.run(function (err, streams) {
		assert(!err, err);
		assert.strictEqual(streams.length, 5);
		assert.strictEqual(streams[0].filename, 'todomvc.com-1280x1024.png');
		assert.strictEqual(streams[4].filename, 'yeoman.io-320x568.png');

		streams[0].once('data', function (data) {
			assert(data.length > 1000);
			cb();
		});
	});
});

it('should remove special characters from the URL to create a valid filename', function (cb) {
	var pageres = new Pageres()
		.src('http://www.microsoft.com/?query=pageres*|<>:"\\', ['1024x768']);

	pageres.run(function (err, streams) {
		assert(!err, err);
		assert.strictEqual(streams.length, 1);
		assert.strictEqual(streams[0].filename, 'microsoft.com!query=pageres-1024x768.png');
		cb();
	});
});

it('should have a `delay` option', function (cb) {
	var pageres = new Pageres({ delay: 2 })
		.src('http://todomvc.com', ['1024x768']);

	pageres.run(function (err, streams) {
		assert(!err, err);

		var now = new Date();

		streams[0].once('data', function () {
			assert((new Date()) - now > 2000);
			cb();
		});
	});
});

it('should crop image using the `crop` option', function (cb) {
	var pageres = new Pageres({ crop: true })
		.src('http://todomvc.com', ['1024x768']);

	pageres.run(function (err, streams) {
		assert(!err, err);

		streams[0].pipe(concat(function (data) {
			var size = imageSize(data);
			assert.strictEqual(size.width, 1024);
			assert.strictEqual(size.height, 768);
			cb();
		}));
	});
});

it('should support local relative files', function (cb) {
	var pageres = new Pageres()
		.src('fixture.html', ['1024x768']);

	pageres.run(function (err, streams) {
		assert(!err, err);

		assert.strictEqual(streams[0].filename, 'fixture.html-1024x768.png');

		streams[0].once('data', function (data) {
			assert(data.length > 1000);
			cb();
		});
	});
});

it('should save image', function (cb) {
	var pageres = new Pageres()
		.src('http://todomvc.com', ['1024x768'])
		.dest(__dirname);

	pageres.run(function (err) {
		assert(!err);
		assert(fs.existsSync('todomvc.com-1024x768.png'));
		fs.unlinkSync('todomvc.com-1024x768.png');
		cb();
	});
});
