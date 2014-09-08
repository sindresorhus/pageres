'use strict';
var express = require('express');
var cookieParser = require('cookie-parser');
var http = require('http');
var app = express();

app.use(cookieParser());
app.get('/', function (req, res) {
	var color = req.cookies.pageresColor || 'white';
	res.type('html');
	res.send('<body><div style="background: ' + color + ';position: absolute;top: 0;bottom: 0;left: 0;right: 0;"></div></body');
});

module.exports = function (port) {
	var server = http.createServer(app);
	server.listen(port);
	return server;
};
