/* global afterEach, beforeEach, it */
'use strict';
var assert = require('assert');
var fs = require('fs');
var pageres = require('./index');
var rm = require('rimraf');

afterEach(function (cb) {
	process.chdir('../');
	rm('tmp', cb);
});

beforeEach(function (cb) {
	fs.mkdirSync('tmp');
	process.chdir('tmp');
	cb();
});

it('should generate screenshots', function (cb) {
	pageres(['yeoman.io'], ['1024x768', '640x480'], function () {
		assert(fs.existsSync('yeoman.io-640x480.png'));
		assert(fs.existsSync('yeoman.io-1024x768.png'));
		cb();
	});
});
