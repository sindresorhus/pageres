#!/usr/bin/env node
'use strict';
var _ = require('lodash');
var eachAsync = require('each-async');
var multiline = require('multiline');
var updateNotifier = require('update-notifier');
var stdin = require('get-stdin');
var subarg = require('subarg');
var sudoBlock = require('sudo-block');
var logSymbols = require('log-symbols');
var pkg = require('./package.json');
var Pageres = require('./');

var options = subarg(process.argv.slice(2), {
	boolean: ['crop', 'help', 'version'],
	default: { delay: 0 },
	alias: {
		c: 'crop',
		d: 'delay',
		h: 'help',
		v: 'version'
	}
});
var args = options._;
delete options._;

function showHelp() {
  console.log(multiline(function () {/*

  Capture screenshots of websites in various resolutions.

  Specify urls and screen resolutions as arguments. Order doesn't matter.
  Group arguments with [ ]. Options defined inside a group will override the outer ones.
  Screenshots are saved in the current directory.

  Usage
    pageres <url> <resolution>
    pageres [ <url> <resolution> ] [ <url> <resolution> ]
    pageres [ <url> <resolution> ... ] < <file>
    cat <file> | pageres [ <url> <resolution> ... ]

  Example
    pageres todomvc.com yeoman.io 1366x768 1600x900
    pageres [ yeoman.io 1366x768 1600x900 --no-crop ] [ todomvc.com 1024x768 480x320 ] --crop
    pageres todomvc.com 1024x768 --name '<%= date %> - <%= url %>'
    pageres yeoman.io 1366x768 --selector '.page-header'
    pageres --delay 3 1366x768 < urls.txt
    pageres unicorn.html 1366x768
    cat screen-resolutions.txt | pageres todomvc.com yeoman.io

  Options
    -d, --delay <seconds>    Delay screenshot capture
    -c, --crop               Crop to the set height
    --cookie <cookie>        Browser cookie, can be set multiple times
    --name <template>        Custom filename
    --selector <element>     Capture DOM element
    --username <username>    Username for HTTP auth
    --password <password>    Password for HTTP auth

  <url> can also be a local file path.

  You can also pipe in a newline separated list of urls and screen resolutions which will get merged with the arguments.
  */}));
}

function generate(args, opts) {
	var pageres = new Pageres(opts)
		.dest(process.cwd());

	args.forEach(function (arg) {
		pageres.src(arg.url, arg.sizes, arg.options);
	});

	pageres.run(function (err) {
		if (err) {
			if (err instanceof Error) {
				throw err;
			} else {
				console.error(err);
				process.exit(1);
			}
		}

		pageres._logSuccessMessage();
	});
}

function get(args, options, cb) {
	var ret = [];

	eachAsync(args, function (arg, i, next) {
		if (arg.url.length === 0) {
			console.error(logSymbols.warning, 'Specify a url\n');
			showHelp();
			return;
		}

		if (arg.sizes.length === 0 && arg.keywords.length === 0) {
			console.error(logSymbols.warning, 'Specify a size\n');
			showHelp();
			return;
		}

		if (arg.keywords.length > 0) {
			arg.sizes = arg.sizes.concat(arg.keywords);
		}

		arg.url.forEach(function (el) {
			ret.push({ url: el, sizes: arg.sizes, options: arg.options });
		});

		next();
	}, function (err) {
		if (err) {
			cb(err);
		}

		cb(null, ret);
	});
}

function parse(args) {
	var ret = [];

	args.forEach(function (arg) {
		var options = arg;
		arg = arg._;
		delete options._;

		var url = _.uniq(arg.filter(/./.test, /\.|localhost/));
		var sizes = _.uniq(arg.filter(/./.test, /^\d{3,4}x\d{3,4}$/i));
		var keywords = _.difference(arg, url.concat(sizes));

		ret.push({ url: url, sizes: sizes, keywords: keywords, options: options });
	});

	return ret;
}

function init(args, options) {
	if (options.version) {
		console.log(require('./package').version);
		return;
	}

	if (options.help || args.length === 0) {
		showHelp();
		return;
	}

	if (args.some(function (arr) { return arr._ === undefined; })) {
		args = [{ _: args }];
	}

	get(parse(args), options, function (err, items) {
		if (err) {
			console.error(err);
			process.exit(1);
		}

		// plural makes more sense for a programmatic option
		options.cookies = options.cookie;
		delete options.cookie;

		generate(items, options);
	});
}

sudoBlock();

updateNotifier({
	packageName: pkg.name,
	packageVersion: pkg.version
}).notify();

if (process.stdin.isTTY) {
	init(args, options);
} else {
	stdin(function (data) {
		[].push.apply(args, data.trim().split('\n'));
		init(args, options);
	});
}
