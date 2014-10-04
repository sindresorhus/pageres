'use strict';
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
var url = require('url');
var _ = require('lodash');
var base64 = require('base64-stream');
var date = require('easydate');
var each = require('each-async');
var fileUrl = require('file-url');
var getRes = require('get-res');
var logSymbols = require('log-symbols');
var memoize = require('memoize-async');
var mkdir = require('mkdirp');
var phantomjs = require('phantomjs').path;
var slugify = require('slugify-url');
var viewport = require('viewport-list');

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
			this.items.push(this.create(url, item.item, options));
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
			this.items.push(this.create(obj.url, size, options));
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
			var pipe = stream.pipe(fs.createWriteStream(dest));

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
	var isFile = fs.existsSync(uri);
	var newUrl;

	if (isFile) {
		newUrl = fileUrl(uri);
	} else {
		newUrl = uri.replace(/^localhost/, 'http://$&');
		newUrl = url.parse(newUrl).protocol ? newUrl : 'http://' + newUrl;
	}

	var filename = _.template(options.filename + '.png', {
		crop: options.crop ? '-cropped' : '',
		date: date('Y-M-d'),
		size: size,
		url: slugify(isFile ? uri : newUrl).replace(/^(?:https?:\/\/)?www\./, '')
	});

	var stream = this.phantomjs(_.assign({ delay: 0 }, options, {
		url: newUrl,
		width: size.split(/x/i)[0],
		height: size.split(/x/i)[1],
	}));

	stream.filename = filename;
	return stream;
};

/**
 * Spawn a PhantomJS instance
 *
 * @param {Object} options
 * @api private
 */

exports.phantomjs = function (options) {
	var args = [
		path.join(__dirname, 'converter.js'),
		JSON.stringify(options),
		'--ignore-ssl-errors=true',
		'--local-to-remote-url-access=true'
	];

	var cp = spawn(phantomjs, args);
	var stream = cp.stdout.pipe(base64.decode());

	process.stderr.setMaxListeners(0);

	cp.stderr.setEncoding('utf8');
	cp.stderr.on('data', function (data) {
		if (/ phantomjs\[/.test(data)) {
			return;
		}

		if (/^WARN: /.test(data)) {
			stream.emit('warn', data.replace(/^WARN: /, ''));
			return;
		}

		if (data.trim().length) {
			stream.emit('error', new Error(data));
		}
	});

	return stream;
};

/**
 * Success message
 *
 * @api private
 */

exports.successMessage = function () {
	var len = this.sizes.length;
	var screenshots = this.stats.screenshots;
	var urls = this.stats.urls;

	console.log([
		'\n' + logSymbols.success + ' Successfully generated ' + len + ' screenshots from',
		urls + ' ' + (urls === 1 ? 'url' : 'urls') + ' and',
		screenshots + ' ' + (screenshots === 1 ? 'resolution' : 'resolutions')
	].join(' '));
};
