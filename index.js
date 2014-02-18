'use strict';
var spawn = require('child_process').spawn;
var path = require('path');
var urlMod = require('url');
var slugifyUrl = require('slugify-url');
var phantomjsBin = require('phantomjs').path;
var base64 = require('base64-stream');

function runPhantomjs(options) {
	var cp = spawn(phantomjsBin, [
		path.join(__dirname, 'converter.js'),
		JSON.stringify(options)
	]);

	var stream = cp.stdout.pipe(base64.decode());

	process.stderr.setMaxListeners(0);
	cp.stderr.on('data', function (data) {
		// ignore phantomjs noise
		if (/ phantomjs\[/.test(data)) {
			return;
		}

		stream.emit('error', data);
	});

	return stream;
}

function generateSizes(url, size) {
	url = urlMod.parse(url).protocol ? url : 'http://' + url;

	// strip `www.`
	url = url.replace(/^(?:https?:\/\/)?www\./, '');

	// make it a valid filename
	// remove | ? : * " < > \ characters that are not
	// removed by slugify-url and are invalid file names
	var filenameUrl = slugifyUrl(url).replace(/\||\?|\:|\*|\"|\<|\>|\\/g, '');

	var filename = filenameUrl + '-' + size + '.png';
	var dim = size.split(/x/i);
	var options = {
		url: url,
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
		return cb(new Error('URLs required'));
	}

	if (sizes.length === 0) {
		return cb(new Error('Sizes required'));
	}

	var items = [];

	urls.forEach(function (url) {
		sizes.forEach(function (size) {
			items.push(generateSizes(url, size));
		});
	});

	cb(null, items);
};
