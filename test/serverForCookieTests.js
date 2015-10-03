import http from 'http';
import cookie from 'cookie';

export default function (port) {
	const server = http.createServer((req, res) => {
		const color = cookie.parse(req.headers.cookie).pageresColor || 'white';

		res.writeHead(200, {'Content-Type': 'text/html'});
		res.end(`<body><div style="background: ${color};position: absolute;top: 0;bottom: 0;left: 0;right: 0;"></div></body`);
	});

	server.listen(port);
	return server;
}
