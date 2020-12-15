import path = require('path');
import fs = require('fs');
import http = require('http');
import cookie = require('cookie');
import getPort = require('get-port');
import pify = require('pify');

export const host = 'localhost';

export interface TestServer extends http.Server {
	host: string;
	port: number;
	url: string;
	protocol: string;
}

const baseCreateServer = (fn: http.RequestListener): (() => Promise<TestServer>) => {
	return async (): Promise<TestServer> => {
		const port = await getPort();
		const server = http.createServer(fn) as unknown as TestServer;

		server.host = host;
		server.port = port;
		server.url = `http://${host}:${port}`;
		server.protocol = 'http';
		server.listen(port);
		// @ts-expect-error
		server.close = pify(server.close) as typeof server.close;

		return server;
	};
};

export const createServer = baseCreateServer((_request, response) => {
	response.writeHead(200, {'content-type': 'text/html'});
	response.end(fs.readFileSync(path.join(__dirname, 'fixture.html'), 'utf8'));
});

export const createCookieServer = baseCreateServer((request, response) => {
	const color = cookie.parse(String(request.headers.cookie)).pageresColor || 'white';
	response.writeHead(200, {'content-type': 'text/html'});
	response.end(`<body><div style="background: ${color}; position: absolute; top: 0; bottom: 0; left: 0; right: 0;"></div></body`);
});
