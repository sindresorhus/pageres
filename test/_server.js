'use strict';
var fs = require('fs');
var http = require('http');
var cookie = require('cookie');
var getPort = require('get-port');
var pify = require('pify');
var host = exports.host = 'localhost';

function createServer(fn) {
	return function () {
		return getPort().then(function (port) {
			var server = http.createServer(fn);

			server.host = host;
			server.port = port;
			server.url = 'http://' + host + ':' + port;
			server.protocol = 'http';

			server.listen(port);
			server.close = pify(server.close);

			return server;
		});
	};
}

exports.createServer = createServer(function (req, res) {
	res.writeHead(200, {'content-type': 'text/html'});
	res.end(fs.readFileSync('fixture.html', 'utf8'));
});

exports.createCookieServer = createServer(function (req, res) {
	var color = cookie.parse(req.headers.cookie).pageresColor || 'white';

	res.writeHead(200, {'content-type': 'text/html'});
	res.end('<body><div style="background: ' + color + ';position: absolute;top: 0;bottom: 0;left: 0;right: 0;"></div></body');
});
