
/**
 * Module dependencies.
 */

var C = require('./config').config();
var express = require('express')
  , routes = require('./routes');
var url = require('url');
var sha1 = require('sha1');
var dateformat = require('dateformat');
//var AqiApi = require('./chineseaqi.js');
var AqiApi = require('chineseaqi');
//var wechat = require('./wechat.js');
var wechat = require('wechat');
var ejs = require('ejs');
var http = require('http');
var connect = require('connect');
var app = connect();
app.use(connect.query());

var api = new AqiApi('QfEJyi3oWKSBCnKrqp1v');
var db = require('mongojs').connect(C.db.url , C.db.collections);
var tpl = '<%=area%>\n\r[污染指数] <%=aqi%>\n\r[pm2.5浓度] <%=pm2_5%>\n\r[空气质量] <%=quality%> \n\r[更新时间] <%=time_point%>';
var compiled = ejs.compile(tpl);

app.use('/', wechat('weiair', function (req, res, next) {
  // 微信输入信息都在req.weixin上
  var message = req.weixin;
  var city = message.Content;
  console.log('getting data for ' + message.Content);

  var now = new Date();
  var serverTime = now.getTime();
  var utcTime = serverTime + now.getTimezoneOffset() * 60000;
  var clientTime = utcTime + C.timezone * 3600000;
  var requestTime =  new Date(clientTime);
  var now_str = dateformat(requestTime, 'yyyy-mm-dd-HH');

  db.aqi.find({'area': city, 'time_point': now_str}, function(error, result) {
    if (error) {
    } else if (result && result.length > 0 && now_str == result[0].time_point_of_latest_data ) {
        console.log('命中cache:' + city + ' ' + now_str);
        res.reply(compiled(result[0].data));
    } else {
      api.getAvgPm25ForCity(message.Content, function(data){
        var time_point_of_latest_data = data.time_point.substring(0, 13).replace('T', '-');
        data.time_point = data.time_point.substring(11, data.time_point.length-1);
        res.reply(compiled(data));
        if (!result || result.length == 0) {
          db.aqi.save({
            area: city,
            data: data,
            time_point: now_str,
            time_point_of_latest_data: time_point_of_latest_data
          } , function(error) {
            if (error) {
              console.log(error);
            }
          });
        } else {
          db.aqi.update({'area': city, 'time_point': now_str}, 
              {$set: {data: data, time_point_of_latest_data: time_point_of_latest_data}},
              function(err, updated) {
                if (err || !updated) {
                  console.log(err);
                } else {
                  console.log('data update');
                }
              }
          ); 
        }
      },
        function(data) {
          res.reply('该城市还没有pm2.5数据，试试别的城市~');
        }
      );
    }
  });

}));
var port = 3000;
http.createServer(app).listen(port);
console.log("Express server listening on port %d", port);
