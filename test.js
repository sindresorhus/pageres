/*global it */
'use strict';
var assert = require('assert');
var pageres = require('./index');

it('should generate screenshots', function (cb) {
	this.timeout(20000);

	var items = [{
		url: 'yeoman.io',
		sizes: ['480x320', '1024x768']
	}, {
		url: 'todomvc.com',
		sizes: ['1280x1024', '1920x1080']
	}];

	pageres(items, function (err, streams) {
		assert(!err);
		assert.strictEqual(streams.length, 4);
		assert.strictEqual(streams[0].filename, 'yeoman.io-480x320.png');

		streams[0].once('data', function (data) {
			assert(data.length > 1000);
			cb();
		});
	});
});

it('should remove special characters from the URL to create a valid filename', function (cb) {
	this.timeout(20000);

	var items =[{
		url: 'http://microsoft.com/?query=pageres*|<>:"\\',
		sizes: '1024x768'
	}];

	pageres(items, function (err, streams) {
		assert(!err);
		assert.strictEqual(streams.length, 1);
		assert.strictEqual(streams[0].filename, 'microsoft.com!query=pageres-1024x768.png');
		cb();
	});
});
