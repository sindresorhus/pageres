'use strict';
var express = require('express');
var cookieParser = require('cookie-parser');
var http = require('http');
var app = express();

app.use(cookieParser());
app.get('/', function(request, response) {
	var color = request.cookies.pageresColor || 'white';
	response.type('html');
	response.send('<body><div style="background: ' + color + ';position: absolute;top: 0;bottom: 0;left: 0;right: 0;"></div></body');
});

module.exports = function() {
	var server = http.createServer(app);
	server.listen(1337);
	return server;
};
