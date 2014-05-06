#!/usr/bin/env node
'use strict';
var fs = require('fs');
var nopt = require('nopt');
var chalk = require('chalk');
var sudoBlock = require('sudo-block');
var _ = require('lodash');
var stdin = require('get-stdin');
var eachAsync = require('each-async');
var getRes = require('get-res');
var multiline = require('multiline');
var subarg = require('subarg');
var updateNotifier = require('update-notifier');
var pageres = require('./index');
var notifier = updateNotifier();

function showHelp() {
	console.log(multiline.stripIndent(function () {/*
		Get screenshots of websites in different resolutions.

		Specify urls and screen resolutions as arguments. Order doesn't matter. Group arguments with [ ]
		Screenshots are saved in the current directory.

		Usage
		  pageres <url> <resolution>
		  pageres [ <url> <resolution> ] [ <url> <resolution> ]
		  pageres [ <url> <resolution> ... ] < <file>
		  cat <file> | pageres [ <url> <resolution> ... ]

		Example
		  pageres todomvc.com yeoman.io 1366x768 1600x900 iphone5
		  pageres [ yeoman.io 1366x768 1600x900 galaxys4 ] [ todomvc.com 1024x768 480x320 iphone5 ]
		  pageres --delay 3 1366x768 < urls.txt
		  pageres unicorn.html 1366x768 iphone5
		  cat screen-resolutions.txt | pageres todomvc.com yeoman.io

		Options
		  -d, --delay <seconds>    Delay capturing the screenshot
		  -c, --crop               Crop to the set height

		<url> can also be a local file path.

		You can also pipe in a newline separated list of urls and screen resolutions which will get merged with the arguments. If no screen resolutions are specified it will fall back to the ten most popular ones according to w3counter.
	*/}));
}

function generate(args, opts) {
	var sizes = [];
	var urls = [];

	pageres(args, opts, function (err, items) {
		if (err) {
			if (err instanceof Error) {
				throw err;
			} else {
				console.error(err);
				process.exit(1);
			}
		}

		eachAsync(items, function (el, i, next) {
			var stream = el.pipe(fs.createWriteStream(el.filename));
			el.on('error', next);
			stream.on('finish', next);
			stream.on('error', next);
		}, function (err) {
			if (err) {
				throw err;
			}

			var i = sizes.length;
			var s = sizes.filter(function (el, i, self) {
				return self.indexOf(el) === i;
			}).length;
			var u = urls.length;

			console.log(chalk.green('\n✓ Successfully generated %d screenshots from %d %s and %d %s'), i, u, (u === 1 ? 'url' : 'urls'), s, (s === 1 ? 'resolution': 'resolutions'));
		});
	});
}

function fetch(args, opts, cb) {
	var ret = [];

	eachAsync(args, function (el, i, next) {
		el = el._;

		var url = _.uniq(el.filter(/./.test, /\.|localhost/));
		var size = _.uniq(el.filter(/./.test, /^\d{3,4}x\d{3,4}$/i));
		var keyword = _.difference(el, url.concat(size));

		if (url.length === 0) {
			console.error(chalk.yellow('Specify a url'));
			return showHelp();
		}

		if (size.length === 0 && keyword.length === 0) {
			return getRes(function (err, sizes) {
				if (err) {
					return next(err);
				}

				console.log('No sizes specified. Falling back to the ten most popular screen resolutions according to w3counter as of January 2014:\n' + size.join(' '));

				url.forEach(function (el) {
					ret.push({ url: el, sizes: sizes });
				});

				next();
			});
		}

		if (keyword.length > 0) {
			size = size.concat(keyword);
		}

		url.forEach(function (el) {
			ret.push({ url: el, sizes: size });
		});

		next();
	}, function (err) {
		cb(err, ret);
	});
}

function init(args, opts) {
	if (opts.help) {
		return showHelp();
	}

	if (opts.version) {
		return console.log(require('./package').version);
	}

	if (!args.some(function (arr) { return arr._ !== undefined; })) {
		args = [{ _: args }];
	}

	fetch(args, opts, function (err, items) {
		if (err) {
			throw err;
		}

		generate(items, opts);
	});
}

sudoBlock();

if (notifier.update) {
	notifier.notify(true);
}

var opts = nopt({
	help: Boolean,
	version: Boolean,
	crop: Boolean,
	delay: Number
}, {
	h: '--help',
	v: '--version',
	c: '--crop',
	d: '--delay'
});

var args = subarg(opts.argv.remain)._;

if (process.stdin.isTTY) {
	init(args, opts);
} else {
	stdin(function (data) {
		[].push.apply(args, data.trim().split('\n'));
		init(args, opts);
	});
}
