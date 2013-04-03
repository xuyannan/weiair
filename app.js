
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes');
var url = require('url');
var sha1 = require('sha1');
//var wechat = require('./wechat.js');
var wechat = require('wechat');
var http = require('http');
var connect = require('connect');
var app = connect();
app.use(connect.query());

app.use('/', wechat('weiair', function (req, res, next) {
  // 微信输入信息都在req.weixin上
  var message = req.weixin;
  res.reply('you just said: ' + message.Content);
}));
var port = 3000;
http.createServer(app).listen(port);
console.log("Express server listening on port %d", port);
