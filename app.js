
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes');
var url = require('url');
var sha1 = require('sha1');
var AqiApi = require('./chineseaqi.js');
//var wechat = require('./wechat.js');
var wechat = require('wechat');
var ejs = require('ejs');
var http = require('http');
var connect = require('connect');
var app = connect();
app.use(connect.query());

var api = new AqiApi('QfEJyi3oWKSBCnKrqp1v');

var tpl = '<%=area%>的空气污染指数:<%=aqi%>\n\rpm2.5浓度:<%=pm2_5%>\n\r<%=quality%> \n\r<%=time_point%>';
var compiled = ejs.compile(tpl);

app.use('/', wechat('weiair', function (req, res, next) {
  // 微信输入信息都在req.weixin上
  var message = req.weixin;
  var city = message.Content;
  console.log('getting data for ' + message.Content);
  api.getAvgPm25ForCity(message.Content, function(data){
    res.reply(compiled(data));
  },
    function(data) {
      res.reply('该城市还没有pm2.5数据，试试别的城市~');
    }
  );
}));
var port = 3000;
http.createServer(app).listen(port);
console.log("Express server listening on port %d", port);
