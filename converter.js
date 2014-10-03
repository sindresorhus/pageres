'use strict';
var webpage = require('webpage');
var system = require('system');
var page = webpage.create();
var options = JSON.parse(phantom.args[0]);
var log = console.log;

// make sure phantom never outputs to stdout
console.log = console.error = function () {
	system.stderr.writeLine([].slice.call(arguments).join(' '));
};

function formatTrace(trace) {
	return '→ ' + (trace.file || trace.sourceURL) + ' on line ' + trace.line + (trace.function ? ' in function ' + trace.function : '');
}

if (options.username && options.password) {
	page.customHeaders = {
		'Authorization': 'Basic ' + btoa(options.username + ':' + options.password)
	};
}

options.cookies.forEach(function (cookie) {
	if (!phantom.addCookie(cookie)) {
		console.error('Couldn\'t add cookie: ', cookie);
		phantom.exit(1);
	}
});

phantom.onError = function (err, trace) {
	console.error('PHANTOM ERROR:', err + '\n' + formatTrace(trace[0]));
};

page.onError = function (err, trace) {
	console.error('WARN:', err + '\n' + formatTrace(trace[0]));
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
		var background = window.getComputedStyle(document.body).getPropertyValue('background-color');
		if (!background || background === 'rgba(0, 0, 0, 0)') {
			document.body.style.backgroundColor = 'white';
		}
	});

	window.setTimeout(function () {
		log.call(console, page.renderBase64('png'));
		phantom.exit(0);
	}, options.delay * 1000);
});
