#!/usr/bin/env node
'use strict';
var fs = require('fs');
var nopt = require('nopt');
var chalk = require('chalk');
var pageres = require('./index');

function showHelp() {
	console.log('');
	console.log('Get screenshots of websites in different resolutions.');
	console.log('');
	console.log(chalk.underline('Usage'));
	console.log('  pageres <url> [<url> ...] --sizes <resolution>,[<resolution>,...]');
	console.log('  pageres <url> [<url> ...] --file <filepath>');
	console.log('');
	console.log(chalk.underline('Example'));
	console.log('  pageres todomvc.com yeoman.io --sizes 1366x768,1600x900');
	console.log('');
	console.log('If --sizes is not specified it will fall back to the ten most popular screen resolutions according to w3counter.');
	console.log('');
	console.log('The <filepath> file should be formatted to have one <resolution> on each line.');
}

var opts = nopt({
	help: Boolean,
	version: Boolean,
	sizes: String,
	file: String
}, {
	h: '--help',
	v: '--version',
	s: '--sizes',
	f: '--file'
});

var urls = opts.argv.remain;
var sizes = opts.sizes && opts.sizes.split(',');

//TODO: keep me up to date: http://www.w3counter.com/globalstats.php
var defRes = '1366x768,1024x768,1280x800,1920x1080,1440x900,768x1024,1280x1024,1600x900,320x480,320x568';

if (opts.help || urls.length === 0) {
	return showHelp();
}

if (opts.version) {
	return console.log(require('./package').version);
}

if (urls.length === 0) {
	console.error(chalk.yellow('Specify at least one url'));
	return showHelp();
}

if (!sizes) {
	if (opts.file) {
		sizes = fs.readFileSync(opts.file, 'utf8').trim().split('\n');
	} else {
		console.log('Neither ' + chalk.underline('--sizes') + ' nor ' + chalk.underline('--file') + ' specified. Falling back to the ten most popular screen resolutions according to w3counter as of January 2014:\n' + defRes);
		sizes = defRes.split(',');
	}
}

// detect if the user inputed the sizes wrong. good UX ftw.
if (urls.some(function (el) { return /^\d{3,4}x\d{3,4}$/.test(el) })) {
	console.log(chalk.yellow('The --sizes needs to be comma separated, not space ;)'));
	return showHelp();
}

pageres(urls, sizes, function (err) {
	if (err) {
		throw new Error(chalk.red('✗ ' + err.message));
	}

	var u = urls.length;
	var s = sizes.length;

	console.log(chalk.green('\n✓ Successfully generated %d screenshots from %d %s and %d %s'), u * s, u, (u === 1 ? 'url' : 'urls'), s, (s === 1 ? 'resolution': 'resolutions'));
});
