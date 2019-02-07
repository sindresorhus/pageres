import path from 'path';
import fs from 'fs';
import http from 'http';
import cookie from 'cookie';
import getPort from 'get-port';
import pify from 'pify';

export const host = 'localhost';

const baseCreateServer = fn => {
	return async () => {
		const port = await getPort();
		const server = http.createServer(fn);

		server.host = host;
		server.port = port;
		server.url = `http://${host}:${port}`;
		server.protocol = 'http';
		server.listen(port);
		server.close = pify(server.close);

		return server;
	};
};

export const createServer = baseCreateServer((_req, res) => {
	res.writeHead(200, {'content-type': 'text/html'});
	res.end(fs.readFileSync(path.join(__dirname, 'fixture.html'), 'utf8'));
});

export const createCookieServer = baseCreateServer((req, res) => {
	const color = cookie.parse(req.headers.cookie).pageresColor || 'white';

	res.writeHead(200, {'content-type': 'text/html'});
	res.end(`<body><div style="background: ${color};position: absolute;top: 0;bottom: 0;left: 0;right: 0;"></div></body`);
});
