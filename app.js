
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

app.use('/public', express.static(__dirname + "/public"));

app.use('/', wechat('weiair', function (req, res, next) {
  // 微信输入信息都在req.weixin上
  var welcome = '感谢您关注微空气！发送城市名称，如"北京"或"beijing"即可获取空气质量数据~';
  var message = req.weixin;
  if (message.MsgType == 'event' && message.Event == 'subscribe') {
    res.reply(welcome);
    return;
  }
  if (message.MsgType == 'event' && message.Event == 'unsubscribe') {
    console.log(message.FromUserName, ' say goodbye');
    return;
  }
  var city = message.Content;
  console.log(dateformat(new Date(), 'yyyy-mm-dd HH:MM:ss'), '[', message.Content, ']', '\r\r');

  var now = new Date();
  var serverTime = now.getTime();
  var utcTime = serverTime + now.getTimezoneOffset() * 60000;
  var clientTime = utcTime + C.timezone * 3600000;
  var requestTime =  new Date(clientTime);
  var now_str = dateformat(requestTime, 'yyyy-mm-dd-HH');

  var aqidata = {
    timepoint: now_str,
    chinese: {},
    usem: {}
  };

  var sendMessage = function(data) {
    var tpl = '<%=area%>\n\r[污染指数] <%=chinese.aqi%>\n\r[pm2.5浓度] <%=chinese.pm2_5%>\n\r[空气质量] <%=chinese.quality%> \n\r[更新时间] <%=chinese.time_point%>';
    tpl += '<%if (!!usem) {%>\n\r\n\r美使馆数据\n\r[污染指数] <%=usem.aqi%>\n\r[pm2.5浓度] <%=usem.pm2_5%>\n\r[空气质量] <%=usem.quality%> \n\r[更新时间] <%=usem.time_point%><% } %>';
    var compiled = ejs.compile(tpl);
    res.reply(compiled(data));
  
  };
  
  var getUsemData = function(data, request_time) {
    db.usemaqi.find({'area': data.area, 'time_point': request_time}, function(error, result) {
      if(error) {
      } else if (result && result.length > 0 && request_time == result[0].time_point_of_latest_data) {
          console.log('命中usem cache');
          sendMessage({
            area: data.area,
            chinese: data,
            usem: result[0].data
          });
      } else {
        api.getUsemPm25ForCity({
          city: data.area,
          errorCallback: function() {
            sendMessage({
              area: data.area,
              chinese: data,
              usem: null
            });
          },
          callback: function(res) {
            var usemdata = res[0];
            //res.reply(compiled(data));
            var d = new Date(usemdata.time_point);
            var time_point_of_latest_data = dateformat(d, 'yyyy-mm-dd-HH');
            usemdata.time_point = dateformat(d, 'HH:00:00');
            usemdata.quality = usemdata.quality.replace(/\(.*\)/, '');
            sendMessage({
              area: data.area,
              chinese: data,
              usem: usemdata
            });
            if (!result || result.length == 0) {
              db.usemaqi.save({
                area: data.area,
                data: usemdata,
                time_point: request_time,
                time_point_of_latest_data: time_point_of_latest_data
              } , function(error) {
                if (error) {
                  console.log('save usemaqi error: ', error);
                }
              });
            } else {
              db.usemaqi.update({'area': data.area, 'time_point': request_time}, 
                  {$set: {data: usemdata, time_point_of_latest_data: time_point_of_latest_data}},
                  function(err, updated) {
                    if (err || !updated) {
                      console.log('update usemaqi error: ', err);
                    } else {
                      console.log('usem data update');
                    }
                  }
              ); 
            }
          }
        });
      
      }
    });
  };

  var getChineseData = function(params) {
    db.aqi.find({'area': params.city, 'time_point': params.time_point}, function(error, result) {
      if (error) {
      } else if (result && result.length > 0 && params.time_point == result[0].time_point_of_latest_data ) {
        console.log('命中chinese cache');
        params.next(result[0]);
      } else {
        api.getAvgPm25ForCity({city: params.city, 
          callback: function(data){
            var time_point_of_latest_data = data.time_point.substring(0, 13).replace('T', '-');
            data.time_point = data.time_point.substring(11, data.time_point.length-1);
            params.next(data);
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
                      console.log('chinese data update');
                    }
                  }
              ); 
            }
          },
          errorCallback: function(data) {
            res.reply('该城市还没有pm2.5数据，试试别的城市~');
          }
        });
      } 
    });
  };

  getChineseData({
    city: message.Content,
    time_point: now_str,
    next: function(data) {
      getUsemData(data, now_str);
    }
  });

}));
var port = 3000;
http.createServer(app).listen(port);
console.log("Express server listening on port %d", port);
