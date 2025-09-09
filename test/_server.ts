import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import cookie from 'cookie';
import getPort from 'get-port';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const host = 'localhost';

export type TestServer = {
	host: string;
	port: number;
	url: string;
	protocol: string;
	close: () => Promise<void>;
} & Omit<http.Server, 'close'>;

const promisifyClose = (originalClose: http.Server['close']): (() => Promise<void>) => async () => new Promise((resolve, reject) => {
	originalClose((error?: Error) => {
		if (error) {
			reject(error);
		} else {
			resolve();
		}
	});
});

const baseCreateServer = (function_: http.RequestListener): (() => Promise<TestServer>) => async (): Promise<TestServer> => {
	const port = await getPort();
	const server = http.createServer(function_) as unknown as TestServer;

	server.host = host;
	server.port = port;
	server.url = `http://${host}:${port}`;
	server.protocol = 'http';
	server.listen(port);
	const originalClose = (server as unknown as http.Server).close.bind(server);
	server.close = promisifyClose(originalClose);

	return server;
};

export const createServer = baseCreateServer((_request, response) => {
	response.writeHead(200, {'content-type': 'text/html'});
	response.end(fs.readFileSync(path.join(__dirname, 'fixture.html'), 'utf8'));
});

export const createCookieServer = baseCreateServer((request, response) => {
	const color = cookie.parse(String(request.headers.cookie)).pageresColor ?? 'white';
	response.writeHead(200, {'content-type': 'text/html'});
	response.end(`<body><div style="background: ${color}; position: absolute; top: 0; bottom: 0; left: 0; right: 0;"></div></body`);
});
