'use strict';
var path = require('path');
var easydate = require('easydate');
var eachAsync = require('each-async');
var fsWriteStreamAtomic = require('fs-write-stream-atomic');
var getRes = require('get-res');
var logSymbols = require('log-symbols');
var memoizeAsync = require('memoize-async');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var screenshotStream = require('screenshot-stream');
var viewportList = require('viewport-list');
var protocolify = require('protocolify');
var arrayUniq = require('array-uniq');
var filenamifyUrl = require('filenamify-url');
var template = require('lodash.template');

/**
 * Fetch ten most popular resolutions
 *
 * @param {String} url
 * @param {Object} options
 * @param {Function} cb
 * @api private
 */

exports.resolution = function (url, options, cb) {
	var g = memoizeAsync(getRes);

	g(function (err, items) {
		if (err) {
			cb(err);
			return;
		}

		items.forEach(function (item) {
			this.sizes.push(item.item);

			try {
				this.items.push(this.create(url, item.item, options));
			} catch (err) {
				cb(err);
			}
		}.bind(this));

		cb();
	}.bind(this));
};

/**
 * Fetch keywords
 *
 * @param {Object} obj
 * @param {Object} options
 * @param {Function} cb
 */

exports.viewport = function (obj, options, cb) {
	var v = memoizeAsync(viewportList);

	v(obj.keywords, function (err, items) {
		if (err) {
			cb(err);
			return;
		}

		items.forEach(function (item) {
			this.sizes.push(item.size);
			obj.sizes.push(item.size);
		}.bind(this));

		arrayUniq(obj.sizes).forEach(function (size) {
			try {
				this.items.push(this.create(obj.url, size, options));
			} catch (err) {
				cb(err);
			}
		}.bind(this));

		cb();
	}.bind(this));
};

/**
 * Save an array of streams to files
 *
 * @param {Array} streams
 * @param {Function} cb
 * @api private
 */

exports.save = function (streams, cb) {
	var files = [];

	function end(cb) {
		eachAsync(files, function (file, i, next) {
			rimraf(file, next);
		}, cb);
	}

	process.on('SIGINT', end.bind(null, process.exit));

	eachAsync(streams, function (stream, i, next) {
		mkdirp(this.dest(), function (err) {
			if (err) {
				next(err);
				return;
			}

			var dest = path.join(this.dest(), stream.filename);
			var write = fsWriteStreamAtomic(dest);

			files.push(write.__atomicTmp);

			stream.on('warn', this.emit.bind(this, 'warn'));
			stream.on('error', function (err) {
				end(next.bind(null, err));
			});

			write.on('finish', next);
			write.on('error', function (err) {
				end(next.bind(null, err));
			});

			stream.pipe(write);
		}.bind(this));
	}.bind(this), function (err) {
		if (err) {
			cb(err);
			return;
		}

		cb(null, streams);
	});
};

/**
 * Create a pageres stream
 *
 * @param {String} uri
 * @param {String} size
 * @param {Object} options
 * @api private
 */

exports.create = function (uri, size, options) {
	var sizes = size.split('x');
	var stream = screenshotStream(protocolify(uri), size, options);
	var filename = template(options.filename + '.' + options.format);

	stream.filename = filename({
		crop: options.crop ? '-cropped' : '',
		date: easydate('Y-M-d'),
		size: size,
		width: sizes[0],
		height: sizes[1],
		url: filenamifyUrl(uri)
	});

	return stream;
};

/**
 * Success message
 *
 * @api private
 */

exports.successMessage = function () {
	var stats = this.stats;

	console.log([
		'\n' + logSymbols.success + ' Generated',
		stats.screenshots + ' ' + (stats.screenshots === 1 ? 'screenshot' : 'screenshots') + ' from',
		stats.urls + ' ' + (stats.urls === 1 ? 'url' : 'urls') + ' and',
		stats.sizes + ' ' + (stats.sizes === 1 ? 'resolution' : 'resolutions')
	].join(' '));
};
