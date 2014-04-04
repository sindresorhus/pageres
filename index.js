'use strict';
var spawn = require('child_process').spawn;
var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var urlMod = require('url');
var slugifyUrl = require('slugify-url');
var phantomjsBin = require('phantomjs').path;
var base64 = require('base64-stream');
var assign = require('object-assign');
var fileUrl = require('file-url');
var viewport = require('viewport-list');
var eachAsync = require('each-async');

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
	var newUrl;

	// check whether `url` is a local file since both local
	// file `index.html` and url `todomvc.com` are supported
	var isFile = fs.existsSync(url);

	if (isFile) {
		newUrl = fileUrl(url);
	} else {
		newUrl = url.replace(/^localhost/, 'http://$&');
		newUrl = urlMod.parse(newUrl).protocol ? newUrl : 'http://' + newUrl;
	}

	// make it a valid filename
	var filenameUrl = slugifyUrl(isFile ? url : newUrl).replace(/^(?:https?:\/\/)?www\./, '');

	var filename = filenameUrl + '-' + size + '.png';
	var dim = size.split(/x/i);

	var defaults = {
		delay: 0
	};

	var stream = runPhantomjs([defaults, opts, {
		url: newUrl,
		width: dim[0],
		height: dim[1]
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

	if (!phantomjsBin) {
		return cb('The automatic install of PhantomJS, which is used for generating the screenshots, seems to have failed.\nTry installing it manually: http://phantomjs.org/download.html');
	}

	eachAsync(args, function (arg, i, next) {
		if (!arg.url || arg.url.length === 0) {
			return next(new Error('URLs required'));
		}

		if (!arg.sizes || arg.sizes.length === 0) {
			return next(new Error('Sizes required'));
		}

		arg.url = Array.isArray(arg.url) ? arg.url.join('') : arg.url;
		arg.sizes = Array.isArray(arg.sizes) ? arg.sizes : [arg.sizes];

		var sizes = _.uniq(arg.sizes.filter(/./.test, /^\d{3,4}x\d{3,4}$/i));
		var keywords = _.difference(arg.sizes, sizes);

		if (keywords.length > 0) {
			return viewport(keywords, function (err, data) {
				if (err) {
					return next(err);
				}

				data.forEach(function (item) {
					sizes.push(item.size);
				});

				_.uniq(sizes).forEach(function (size) {
					items.push(generateSizes(arg.url, size, opts));
				});

				next();
			});
		}

		sizes.forEach(function (size) {
			items.push(generateSizes(arg.url, size, opts));
		});

		next();
	}, function (err) {
		cb(err, items);
	});
};
