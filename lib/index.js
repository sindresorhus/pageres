import {EventEmitter} from 'events';
import arrayUniq from 'array-uniq';
import arrayDiffer from 'array-differ';
import objectAssign from 'object-assign';

export default class Pageres {
	/**
	 * Initialize a new Pageres
	 *
	 * @param {Object} options
	 * @api public
	 */

	constructor(options) {
		this.options = objectAssign({}, options);
		this.options.filename = this.options.filename || '<%= url %>-<%= size %><%= crop %>';
		this.options.format = this.options.format || 'png';

		this.stats = {};
		this.items = [];
		this.sizes = [];
		this.urls = [];
	}

	/**
	 * Get or set page to capture
	 *
	 * @param {String} url
	 * @param {Array} sizes
	 * @param {Object} options
	 * @api public
	 */

	src(url, sizes, options) {
		if (!arguments.length) {
			return this._src;
		}

		this._src = this._src || [];
		this._src.push({url, sizes, options});

		return this;
	}

	/**
	 * Get or set the destination directory
	 *
	 * @param {String} dir
	 * @api public
	 */

	dest(dir) {
		if (!arguments.length) {
			return this._dest;
		}

		this._dest = dir;
		return this;
	}

	/**
	 * Run pageres
	 *
	 * @api public
	 */

	async run() {
		await Promise.all(this.src().map(src => {
			const options = objectAssign({}, this.options, src.options);
			const sizes = arrayUniq(src.sizes.filter(/./.test, /^\d{2,4}x\d{2,4}$/i));
			const keywords = arrayDiffer(src.sizes, sizes);

			if (!src.url) {
				throw new Error('URL required');
			}

			this.urls.push(src.url);

			if (!sizes.length && keywords.indexOf('w3counter') !== -1) {
				return this.resolution(src.url, options);
			}

			if (keywords.length) {
				return this.viewport({url: src.url, sizes, keywords}, options);
			}

			for (const size of sizes) {
				this.sizes.push(size);
				this.items.push(this.create(src.url, size, options));
			}
		}));

		this.stats.urls = arrayUniq(this.urls).length;
		this.stats.sizes = arrayUniq(this.sizes).length;
		this.stats.screenshots = this.items.length;

		if (!this.dest()) {
			return this.items;
		}

		await this.save(this.items);

		return this.items;
	}
}

objectAssign(Pageres.prototype, EventEmitter.prototype);
objectAssign(Pageres.prototype, require('./util'));
