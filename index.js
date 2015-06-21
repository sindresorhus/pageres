'use strict';
var EventEmitter = require('events').EventEmitter;
var eachAsync = require('each-async');
var arrayUniq = require('array-uniq');
var arrayDiffer = require('array-differ');
var objectAssign = require('object-assign');

/**
 * Initialize a new Pageres
 *
 * @param {Object} options
 * @api public
 */

function Pageres(options) {
	if (!(this instanceof Pageres)) {
		return new Pageres(options);
	}

	EventEmitter.call(this);

	this.options = objectAssign({}, options);
	this.options.filename = this.options.filename || '<%= url %>-<%= size %><%= crop %>';
	this.options.format = this.options.format || 'png';

	this.stats = {};
	this.items = [];
	this.sizes = [];
	this.urls = [];
}

objectAssign(Pageres.prototype, EventEmitter.prototype);
objectAssign(Pageres.prototype, require('./util'));

module.exports = Pageres;

/**
 * Get or set page to capture
 *
 * @param {String} url
 * @param {Array} sizes
 * @param {Object} options
 * @api public
 */

Pageres.prototype.src = function (url, sizes, options) {
	if (!arguments.length) {
		return this._src;
	}

	this._src = this._src || [];
	this._src.push({
		url: url,
		sizes: sizes,
		options: options
	});

	return this;
};

/**
 * Get or set the destination directory
 *
 * @param {String} dir
 * @api public
 */

Pageres.prototype.dest = function (dir) {
	if (!arguments.length) {
		return this._dest;
	}

	this._dest = dir;
	return this;
};

/**
 * Run pageres
 *
 * @param {Function} cb
 * @api public
 */

Pageres.prototype.run = function (cb) {
	cb = cb || function () {};

	eachAsync(this.src(), function (src, i, next) {
		var options = objectAssign({}, this.options, src.options);
		var sizes = arrayUniq(src.sizes.filter(/./.test, /^\d{3,4}x\d{3,4}$/i));
		var keywords = arrayDiffer(src.sizes, sizes);

		if (!src.url) {
			cb(new Error('URL required'));
			return;
		}

		this.urls.push(src.url);

		if (!sizes.length && keywords.indexOf('w3counter') !== -1) {
			this.resolution(src.url, options, next);
			return;
		}

		if (keywords.length) {
			this.viewport({url: src.url, sizes: sizes, keywords: keywords}, options, next);
			return;
		}

		sizes.forEach(function (size) {
			this.sizes.push(size);

			try {
				this.items.push(this.create(src.url, size, options));
			} catch (err) {
				next(err);
			}
		}.bind(this));

		next();
	}.bind(this), function (err) {
		if (err) {
			cb(err);
			return;
		}

		this.stats.urls = arrayUniq(this.urls).length;
		this.stats.sizes = arrayUniq(this.sizes).length;
		this.stats.screenshots = this.items.length;

		if (!this.dest()) {
			cb(null, this.items);
			return;
		}

		this.save(this.items, cb);
	}.bind(this));
};
