import path from 'path';
import fs from 'fs';
import http from 'http';
import cookie from 'cookie';
import getPort from 'get-port';
import pify from 'pify';

export const host = 'localhost';

interface TestServer extends http.Server {
	host: string;
	port: number;
	url: string;
	protocol: string;
}

const baseCreateServer = fn => {
	return async (): Promise<TestServer> => {
		const port = await getPort();
		const server = http.createServer(fn) as TestServer;

		server.host = host;
		server.port = port;
		server.url = `http://${host}:${port}`;
		server.protocol = 'http';
		server.listen(port);
		server.close = pify(server.close);

		return server;
	};
};

export const createServer = baseCreateServer((_request, response) => {
	response.writeHead(200, {'content-type': 'text/html'});
	response.end(fs.readFileSync(path.join(__dirname, 'fixture.html'), 'utf8'));
});

export const createCookieServer = baseCreateServer((request, response) => {
	const color = cookie.parse(request.headers.cookie).pageresColor || 'white';

	response.writeHead(200, {'content-type': 'text/html'});
	response.end(`<body><div style="background: ${color}; position: absolute; top: 0; bottom: 0; left: 0; right: 0;"></div></body`);
});
