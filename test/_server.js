'use strict';
var http = require('http');
var cookie = require('cookie');

module.exports = function (port) {
	var server = http.createServer(function (req, res) {
		var color = cookie.parse(req.headers.cookie).pageresColor || 'white';

		res.writeHead(200, {'content-type': 'text/html'});
		res.end('<body><div style="background: '+ color + ';position: absolute;top: 0;bottom: 0;left: 0;right: 0;"></div></body');
	});

	server.listen(port);

	return server;
};
