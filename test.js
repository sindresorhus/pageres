/*global afterEach, beforeEach, it */
'use strict';
var assert = require('assert');
var fs = require('fs');
var pageres = require('./index');

it('should generate screenshots', function (cb) {
	this.timeout(20000);

	pageres(['yeoman.io', 'todomvc.com'], ['1024x768', '640x480'], function (err, streams) {
		assert(!err);
		assert.strictEqual(streams.length, 4);
		assert.strictEqual(streams[0].filename, 'yeoman.io-1024x768.png');

		streams[0].once('data', function (data) {
			assert(data.length > 1000);
			cb();
		});
	});
});
