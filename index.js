'use strict';
var spawn = require('child_process').spawn;
var path = require('path');
var fs = require('fs');
var urlMod = require('url');
var slugifyUrl = require('slugify-url');
var phantomjsBin = require('phantomjs').path;
var base64 = require('base64-stream');

function runPhantomjs(options) {
	var cp = spawn(phantomjsBin, [
		path.join(__dirname, 'converter.js'),
		JSON.stringify(options)
	]);

	process.stderr.setMaxListeners(0);
	cp.stderr.on('data', function (data) {
		cp.stdout.emit('error', data);
	});

	return cp.stdout.pipe(base64.decode());
}

function generateSizes(url, size) {
	url = urlMod.parse(url).protocol ? url : 'http://' + url;
	// strip `www.` and convert to valid filename
	url = url.replace(/^(?:https?:\/\/)?www\./, '');

	var filenameUrl = slugifyUrl(url);
	var filename = filenameUrl + '-' + size + '.png';
	var dim = size.split(/x/i);
	var options = {
		url: url.toLowerCase(),
		width: dim[0],
		height: dim[0]
	};

	var stream = runPhantomjs(options);
	stream.filename = filename;
	return stream;
}

module.exports = function (urls, sizes, cb) {
	cb = cb || function () {};

	if (urls.length === 0) {
		return cb(new Error('`urls` required'));
	}

	if (sizes.length === 0) {
		return cb(new Error('`sizes` required'));
	}

	var items = [];

	urls.forEach(function (url) {
		sizes.forEach(function (size) {
			items.push(generateSizes(url, size));
		});
	});

	cb(null, items);
};
