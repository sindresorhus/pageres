'use strict';
var webshot = require('webshot');
var eachAsync = require('each-async');
var slugifyUrl = require('slugify-url');

function generateSizes(url, sizes, cb) {
	eachAsync(sizes, function (el, i, next) {
		// strip `www.` and convert to valid filename
		var filenameUrl = slugifyUrl(url.replace(/^(?:https?:\/\/)?www\./, ''));
		var filename = filenameUrl + '-' + el + '.png';
		var dim = el.split(/x/i);
		var options = {
			windowSize: {
				width: dim[0],
				height: dim[1]
			},
			shotSize: {
				width: 'window',
				height: 'all'
			}
		};

		webshot(url.toLowerCase(), filename, options, next);
	}, cb);
}

module.exports = function (urls, sizes, cb) {
	cb = cb || function () {};

	if (urls.length === 0) {
		return cb(new Error('`urls` required'));
	}

	if (sizes.length === 0) {
		return cb(new Error('`sizes` required'));
	}

	eachAsync(urls, function (url, i, next) {
		generateSizes(url, sizes, next);
	}, cb);
};
