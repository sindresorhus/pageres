'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const cookie = require('cookie');
const getPort = require('get-port');
const pify = require('pify');

exports.host = 'localhost';
const host = exports.host;

function createServer(fn) {
	return () => getPort().then(port => {
		const server = http.createServer(fn);

		server.host = host;
		server.port = port;
		server.url = `http://${host}:${port}`;
		server.protocol = 'http';
		server.listen(port);
		server.close = pify(server.close);

		return server;
	});
}

exports.createServer = createServer((req, res) => {
	res.writeHead(200, {'content-type': 'text/html'});
	res.end(fs.readFileSync(path.join(__dirname, 'fixture.html'), 'utf8'));
});

exports.createCookieServer = createServer((req, res) => {
	const color = cookie.parse(req.headers.cookie).pageresColor || 'white';

	res.writeHead(200, {'content-type': 'text/html'});
	res.end(`<body><div style="background: ${color};position: absolute;top: 0;bottom: 0;left: 0;right: 0;"></div></body`);
});
