'use strict';
var webshot = require('webshot');
var eachAsync = require('each-async');
var slugifyUrl = require('slugify-url');
var _ = require('lodash');

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

	// Check localhost URLs have http(s):// at the beginning
	_.map(urls, function (url) {
		if (/^localhost/.test(url) && !/^https?:\/\//.test(url)) {
			return cb(new Error('localhost urls require http://'));
		}
	});

	if (sizes.length === 0) {
		return cb(new Error('`sizes` required'));
	}

	eachAsync(urls, function (url, i, next) {
		generateSizes(url, sizes, next);
	}, cb);
};
