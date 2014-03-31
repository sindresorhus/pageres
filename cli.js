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

		Specify urls and screen resolutions as arguments. Order doesn't matter.
		Screenshots are saved in the current directory.

		Usage
		  pageres <url> <resolution>
		  pageres [ <url> <resolution> ] [ <url> <resolution> ]
		  pageres [ <url> <resolution> ... ] < <file>
		  cat <file> | pageres [ <url> <resolution> ... ]

		Example
		  pageres todomvc.com yeoman.io 1366x768 1600x900
		  pageres [ yeoman.io 1366x768 1600x900 ] [ todomvc.com 1024x768 480x320 ]
		  pageres 1366x768 < urls.txt
		  cat screen-resolutions.txt | pageres todomvc.com yeoman.io

		You can also pipe in a newline separated list of urls and screen resolutions which will get merged with the arguments. If no screen resolutions are specified it will fall back to the ten most popular ones according to w3counter.
	*/}));
}

function generate(args) {
	var sizes = [];
	var urls = [];

	pageres(args, function (err, items) {
		if (err) {
			if (err instanceof Error) {
				throw err;
			} else {
				console.error(err);
				process.exit(1);
			}
		}

		args.forEach(function (arg) {
			sizes = sizes.concat(arg.sizes);
			urls = urls.concat(arg.url);
		});

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

function init(args) {
	var items = [];

	if (opts.help) {
		return showHelp();
	}

	if (opts.version) {
		return console.log(require('./package').version);
	}

	if (!args.some(function (arr) { return arr._ !== undefined; })) {
		args = [{ _: args }];
	}

	eachAsync(args, function (el, i, next) {
		el = el._;

		var url = _.uniq(el.filter(/./.test, /\.|localhost/));
		var size = _.uniq(el.filter(/./.test, /^\d{3,4}x\d{3,4}$/i));

		if (url.length === 0) {
			console.error(chalk.yellow('Specify a url'));
			return showHelp();
		}

		if (size.length === 0) {
			return getRes(function (err, data) {
				if (err) {
					throw err;
				}

				size = data;
				console.log('No sizes specified. Falling back to the ten most popular screen resolutions according to w3counter as of January 2014:\n' + size.join(' '));

				items.push({ url: url, sizes: size });
				next();
			});
		}

		if (url.length > 1) {
			url.forEach(function (el) {
				items.push({ url: el, sizes: size });
			});
		} else {
			items.push({ url: url, sizes: size });
		}

		next();
	}, function () {
		generate(items);
	});
}

sudoBlock();

if (notifier.update) {
	notifier.notify(true);
}

var opts = nopt({
	help: Boolean,
	version: Boolean
}, {
	h: '--help',
	v: '--version'
});

var args = subarg(opts.argv.remain)._;

if (process.stdin.isTTY) {
	init(args);
} else {
	stdin(function (data) {
		[].push.apply(args, data.trim().split('\n'));
		init(args);
	});
}
