'use strict';
var webpage = require('webpage');
var page = webpage.create();
var system = require('system');
var options = JSON.parse(phantom.args[0]);

var log = console.log;

// make sure phantom never outputs to stdout
console.log = console.error = function () {
	system.stderr.writeLine([].slice.call(arguments).join(' '));
};

if (options.username && options.password) {
	page.customHeaders = {'Authorization': 'Basic ' + btoa(options.username + ':' + options.password)};
}

options.cookies.forEach(function (cookie) {
	if (!phantom.addCookie(cookie)) {
		console.error('Couldn\'t add cookie: ', cookie);
		phantom.exit(1);
	}
});

phantom.onError = function(msg, trace) {
	var msgStack = ['PHANTOM ERROR: ' + msg];

	if (trace && trace.length) {
		msgStack.push('TRACE:');
		trace.forEach(function(t) {
			msgStack.push(' -> ' + (t.file || t.sourceURL) + ': ' + t.line + (t.function ? ' (in function ' + t.function +')' : ''));
		});
	}

	console.error(msgStack.join('\n'));
};

page.onError = function (err) {
	console.error(err);
};

page.onResourceReceived = function () {
	page.injectJs('./node_modules/es5-shim/es5-shim.js');
};

page.viewportSize = {
	width: options.width,
	height: options.height
};

if (options.crop) {
	page.clipRect = {
		top: 0,
		left: 0,
		width: options.width,
		height: options.height
	};
}

page.open(options.url, function (status) {
	if (status === 'fail') {
		console.error('Couldn\'t load url');
		phantom.exit(1);
	}

	if (options.selector) {
		page.clipRect = page.evaluate(function (s) {
			return document.querySelector(s).getBoundingClientRect();
		}, options.selector);
	}

	page.evaluate(function () {
		var styles = window.getComputedStyle(document.body);
		var background = styles.getPropertyValue('background-color');

		if (!background) {
			document.body.style.background = 'white';
		}
	});

	window.setTimeout(function () {
		log.call(console, page.renderBase64('png'));
		phantom.exit(0);
	}, options.delay * 1000);
});
