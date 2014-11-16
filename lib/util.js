'use strict';
var fs = require('fs');
var path = require('path');
var url = require('url');
var _ = require('lodash');
var date = require('easydate');
var each = require('each-async');
var fileUrl = require('file-url');
var fsWriteStreamAtomic = require('fs-write-stream-atomic');
var getRes = require('get-res');
var logSymbols = require('log-symbols');
var memoize = require('memoize-async');
var mkdir = require('mkdirp');
var screenshot = require('screenshot-stream');
var slugify = require('slugify-url');
var viewport = require('viewport-list');
var protocolify = require('protocolify');

/**
 * Fetch ten most popular resolutions
 *
 * @param {String} url
 * @param {Object} options
 * @param {Function} cb
 * @api private
 */

exports.resolution = function (url, options, cb) {
	var g = memoize(getRes);

	g(function (err, items) {
		if (err) {
			cb(err);
			return;
		}

		this.resolutions = items;

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
	var v = memoize(viewport);

	v(obj.keywords, function (err, items) {
		if (err) {
			cb(err);
			return;
		}

		items.forEach(function (item) {
			this.sizes.push(item.size);
			obj.sizes.push(item.size);
		}.bind(this));

		_.uniq(obj.sizes).forEach(function (size) {
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
	each(streams, function (stream, i, next) {
		mkdir(this.dest(), function (err) {
			if (err) {
				next(err);
				return;
			}

			var dest = path.join(this.dest(), stream.filename);
			var pipe = stream.pipe(fsWriteStreamAtomic(dest));

			stream.on('warn', this.emit.bind(this, 'warn'));
			stream.on('error', next);
			pipe.on('finish', next);
			pipe.on('error', next);
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

	var filename = _.template(options.filename + '.png', {
		crop: options.crop ? '-cropped' : '',
		date: date('Y-M-d'),
		size: size,
		width: sizes[0],
		height: sizes[1],
		url: slugify(uri).replace(/^(?:https?:\/\/)?www\./, '')
	});

	var stream = screenshot(protocolify(uri), size, _.assign({
		'ignore-ssl-errors': true,
		'local-to-remote-url-access': true
	}, options));

	stream.filename = filename;
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
