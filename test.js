'use strict';
var assert = require('assert');
var imageSize = require('image-size');
var concat = require('concat-stream');
var pageres = require('./index');

var def = [{
	url: 'http://todomvc.com',
	sizes: '1024x768'
}];

before(function () {
	this.timeout(20000);
});

it('should generate screenshots', function (cb) {
	var items = [{
		url: 'yeoman.io',
		sizes: ['480x320', '1024x768']
	}, {
		url: 'todomvc.com',
		sizes: ['1280x1024', '1920x1080', 'iphone5']
	}];

	pageres(items, function (err, streams) {
		assert(!err, err);
		assert.strictEqual(streams.length, 5);
		assert.strictEqual(streams[0].filename, 'yeoman.io-480x320.png');
		assert.strictEqual(streams[4].filename, 'todomvc.com-320x568.png');

		streams[0].once('data', function (data) {
			assert(data.length > 1000);
			cb();
		});
	});
});

it('should remove special characters from the URL to create a valid filename', function (cb) {
	var items = [{
		url: 'http://www.microsoft.com/?query=pageres*|<>:"\\',
		sizes: '1024x768'
	}];

	pageres(items, function (err, streams) {
		assert(!err, err);
		assert.strictEqual(streams.length, 1);
		assert.strictEqual(streams[0].filename, 'microsoft.com!query=pageres-1024x768.png');
		cb();
	});
});

it('should have a `delay` option', function (cb) {
	pageres(def, {delay: 2}, function (err, streams) {
		assert(!err, err);

		var now = new Date();

		streams[0].once('data', function () {
			assert((new Date()) - now > 2000);
			cb();
		});
	});
});

it('should crop image using the `crop` option', function (cb) {
	pageres(def, {crop: true}, function (err, streams) {
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
	var items = [{
		url: 'fixture/fixture.html',
		sizes: ['1024x768']
	}];

	pageres(items, function (err, streams) {
		assert(!err, err);

		assert.strictEqual(streams[0].filename, 'fixture!fixture.html-1024x768.png');

		streams[0].once('data', function (data) {
			assert(data.length > 1000);
			cb();
		});
	});
});
