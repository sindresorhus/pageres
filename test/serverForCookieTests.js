'use strict';
var express = require('express');
var path = require('path');
var fs = require('fs');
var cookieParser = require('cookie-parser');
var app = express();

var httpserverOptions = {
	key: fs.readFileSync(path.join(__dirname, 'key.pem')),
	cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};


app.use(cookieParser());
app.get('/', function(request, response) {
	var color = request.cookies.pageresColor || 'red';
	response.type('html');
	response.send('<body><div style="background: ' + color + ';position: absolute;top: 0;bottom: 0;left: 0;right: 0;"></div></body');
});

module.exports = function(opts) {
	opts = opts || {};
	var port = 1337;
	var proto = 'http';
	var serverArgs = [app];
	if (opts.ssl) {
		port = 2337;
		proto = 'https';
		serverArgs = [httpserverOptions, app];
	}
	var http = require(proto);
	var server = http.createServer.apply(null, serverArgs);
	server.listen(port);
	return server;
};
