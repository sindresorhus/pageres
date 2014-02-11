#!/usr/bin/env node
'use strict';
var nopt = require('nopt');
var chalk = require('chalk');
var sudoBlock = require('sudo-block');
var _ = require('lodash');
var pageres = require('./index');

function showHelp() {
	console.log('');
	console.log('Get screenshots of websites in different resolutions.');
	console.log('');
	console.log('Specify urls and screen resolutions as arguments. Order doesn\'t matter.');
	console.log('');
	console.log(chalk.underline('Usage'));
	console.log('  pageres <url> <resolution> [<resolution> <url> ...]');
	console.log('  pageres [<url> <resolution> ...] < <file>');
	console.log('  cat <file> | pageres [<url> <resolution> ...]');
	console.log('');
	console.log(chalk.underline('Example'));
	console.log('  pageres todomvc.com yeoman.io 1366x768 1600x900');
	console.log('  pageres 1366x768 < urls.txt');
	console.log('  cat screen-resolutions.txt | pageres todomvc.com yeoman.io');
	console.log('');
	console.log('You can also pipe in a newline separated list of urls and screen resolutions which will get merged with the arguments.');
	console.log('If no screen resolutions are specified it will fall back to the ten most popular ones according to w3counter.');
}

function getStdin(cb) {
	var ret = '';

	process.stdin.resume();
	process.stdin.setEncoding('utf8');

	process.stdin.on('data', function (data) {
		ret += data;
	});

	process.stdin.on('end', function () {
		cb(ret);
	});
}

function init(args) {
	if (opts.help) {
		return showHelp();
	}

	if (opts.version) {
		return console.log(require('./package').version);
	}

	var urls = _.uniq(args.filter(/./.test.bind(/\./)));
	var sizes = _.uniq(args.filter(/./.test.bind(/^\d{3,4}x\d{3,4}$/i)))

	if (urls.length === 0) {
		console.error(chalk.yellow('Specify at least one url'));
		return showHelp();
	}

	if (sizes.length === 0) {
		console.log('No sizes specified. Falling back to the ten most popular screen resolutions according to w3counter as of January 2014:\n' + defRes);
		sizes = defRes.split(',');
	}

	pageres(urls, sizes, function (err) {
		if (err) {
			throw new Error(chalk.red('✗ ' + err.message));
		}

		var u = urls.length;
		var s = sizes.length;

		console.log(chalk.green('\n✓ Successfully generated %d screenshots from %d %s and %d %s'), u * s, u, (u === 1 ? 'url' : 'urls'), s, (s === 1 ? 'resolution': 'resolutions'));
	});
}


sudoBlock();

var opts = nopt({
	help: Boolean,
	version: Boolean
}, {
	h: '--help',
	v: '--version'
});

var args = opts.argv.remain;

//TODO: keep me up to date: http://www.w3counter.com/globalstats.php
var defRes = '1366x768 1024x768 1280x800 1920x1080 1440x900 768x1024 1280x1024 1600x900 320x480 320x568';

if (process.stdin.isTTY) {
	init(args);
} else {
	getStdin(function (data) {
		[].push.apply(args, data.trim().split('\n'));
		init(args);
	});
}
