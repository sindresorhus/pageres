'use strict';
var spawn = require('child_process').spawn;
var path = require('path');
var _ = require('lodash');
var urlMod = require('url');
var slugifyUrl = require('slugify-url');
var phantomjsBin = require('phantomjs').path;
var base64 = require('base64-stream');
var assign = require('object-assign');

function runPhantomjs(options) {
	var cp = spawn(phantomjsBin, [
		path.join(__dirname, 'converter.js'),
		JSON.stringify(options)
	]);

	var stream = cp.stdout.pipe(base64.decode());

	process.stderr.setMaxListeners(0);

	cp.stdout.on('data', function (data) {
		// stupid phantomjs outputs this on stdout...
		if (/Couldn\'t load url/.test(data)) {
			return stream.emit('error', new Error('Couldn\'t load url'));
		}
	});

	cp.stderr.on('data', function (data) {
		// ignore phantomjs noise
		if (/ phantomjs\[/.test(data)) {
			return;
		}

		stream.emit('error', data);
	});

	return stream;
}

function generateSizes(url, size, opts) {
	url = url.replace(/^localhost/, 'http://$&');
	url = urlMod.parse(url).protocol ? url : 'http://' + url;

	// strip `www.`
	url = url.replace(/^(?:https?:\/\/)?www\./, '');

	// make it a valid filename
	var filenameUrl = slugifyUrl(url);

	var filename = filenameUrl + '-' + size + '.png';
	var dim = size.split(/x/i);

	var stream = runPhantomjs([{}, opts, {
		url: url,
		width: dim[0],
		height: dim[0]
	}].reduce(assign));

	stream.filename = filename;

	return stream;
}

module.exports = function (args, opts, cb) {
	var items = [];

	if (!cb && _.isFunction(opts)) {
	    cb = opts;
	    opts = {};
	}

	args = args || [];
	opts = opts || {};
	cb = cb || function () {};

	args.forEach(function (arg) {
		if (!arg.url || arg.url.length === 0) {
			return cb(new Error('URLs required'));
		}

		if (!arg.sizes || arg.sizes.length === 0) {
			return cb(new Error('Sizes required'));
		}

		arg.url = Array.isArray(arg.url) ? arg.url.join('') : arg.url;
		arg.sizes = Array.isArray(arg.sizes) ? arg.sizes : [arg.sizes];

		arg.sizes.forEach(function (size) {
			items.push(generateSizes(arg.url, size, opts));
		});
	});

	cb(null, items);
};
