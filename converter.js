'use strict';
var webpage = require('webpage');
var page = webpage.create();
var options = JSON.parse(phantom.args[0]);

var log = console.log;
// make sure phantom never outputs to stdout
console.log = console.error;

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

	page.evaluate(function () {
		document.body.style.background = 'white';
	});

	window.setTimeout(function () {
		log.call(console, page.renderBase64('png'));
		phantom.exit(0);
	}, options.delay * 1000);
});
