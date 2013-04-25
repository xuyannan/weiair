
/**
 * Module dependencies.
 */
var C = require('./config').config();
var express = require('express')
  , routes = require('./routes');
var url = require('url');
var sha1 = require('sha1');
var dateformat = require('dateformat');
var wechat = require('wechat');
var http = require('http');
var connect = require('connect');
var chinesecities = require('chinesecities');
var app = connect();
app.use(connect.query());

var tool = require('./aqitool.js');

app.use('/public', express.static(__dirname + "/public"));

app.use('/', wechat('weiair', function (req, res, next) {
  // 微信输入信息都在req.weixin上
  var welcome = '感谢您关注微空气！发送城市名称，如"北京"或"beijing"即可获取空气质量数据~\n\r您可以发送"?"或"help"来获取帮助';
  var help = '[查询] 发送城市名称，如"北京"或"beijing"即可获取空气质量数据。\n\r\n\r[订阅] 发送"城市@时间"来订阅您所关心的城市，如"北京@10:00"，微空气将会在每天的10:00左右向您推送北京的空气质量数据。\n\r\n\r[退订] 发送"北京@no"，即可退订北京的空气质量数据。\n\r\n\r[帮助] 发送"?"或"help"或"帮助"获得帮助';
  var message = req.weixin;
  if (message.MsgType == 'event' && message.Event == 'subscribe') {
    res.reply(welcome);
    return;
  }
  if (message.MsgType == 'event' && message.Event == 'unsubscribe') {
    console.log(message.FromUserName, ' say goodbye');
    return;
  }

  var subscribeCityReg = /^([^@]{2,8})@(([0-1][0-9]|2[0-4])(:|：)([0-5][0-9]$)|(60))/;
  var unsubscribeCityReg = /^([^@]{2,8})@NO/i;
  var querySubscribed = /\?\?/;
  var helpCommand = /^\?|？|help|帮助/i;
  var welcomeCommand = /^hello|^hi|^[您你]好|/i
  /*
  if (message.Content.match(welcomeCommand)) {
    res.reply(welcome);
    return;
  }*/

  if (message.Content.match(helpCommand)) {
    res.reply(help);
    return;
  }

  if (message.Content.match(subscribeCityReg)) {
    console.log(message.FromUserName, ' ', message.Content);
    var matched = message.Content.match(subscribeCityReg);
    var sUser = message.FromUserName;
    var sCity = matched[1];
    var sHour = matched[3];
    var sMinute = matched[5];
    var sTime = sHour + ':' + sMinute;
    if(!chinesecities.cn[sCity] && !chinesecities.py[sCity]) {
      res.reply('目前没有这个地区的数据，换个城市试试吧~');
      return ;
    }
    db.subscribe.find({userid: sUser, city: sCity, pushtime: sTime}, function(error, result){
      if(error) {
        console.log(error);
      } else if( result && result.length > 0 ) {
        res.reply('您已订阅过 ' + message.Content);
      } else {
        db.subscribe.save({
          userid: sUser,
          city: sCity,
          pushtime: sTime
        }, function(error){
          if (error) {
            console.log('save subscribe error: ', error);
          } else {
            res.reply('订阅成功，微空气将会在每天的 ' + sTime + ' 左右向您发送 ' + sCity + '的天气状况');
          }
        });
      }
    });
    return;
  }

  if (message.Content.match(unsubscribeCityReg)) {
    var matched = message.Content.match(unsubscribeCityReg);
    var sUser = message.FromUserName;
    var sCity = matched[1];
    db.subscribe.remove({userid: sUser, city: sCity}, function(error) {
      if (error) {
        console.log(error);
      } else {
        res.reply('操作成功，您已退订了 ' + sCity + ' 的天气状况~');
      }
    });
    return ;
  }

  var city = message.Content;
  console.log(dateformat(new Date(), 'yyyy-mm-dd HH:MM:ss'), '[', message.Content, ']', '\r\r');

  var now = new Date();
  var serverTime = now.getTime();
  var utcTime = serverTime + now.getTimezoneOffset() * 60000;
  var clientTime = utcTime + C.timezone * 3600000;
  var requestTime =  new Date(clientTime);
  var now_str = dateformat(requestTime, 'yyyy-mm-dd-HH');
  
  var requestCity = message.Content;
  requestCity = tool.getRealnameByNickname(requestCity);

  tool.getChineseData({
    city: requestCity,
    time_point: now_str,
    next: function(data) {
      //getUsemData(data, now_str);
      tool.getUsemData({
        data: data, 
        request_time: now_str,
        next: function(data) {
          tool.getWeatherData({
            data: data,
            callback: function(aqiData, weatherData){
              aqiData.weather = weatherData.weatherinfo;
              tool.sendMessage(aqiData, res);
            },
            errorCallback: function(aqiData) {
              tool.sendMessage(aqiData, res);
            }
          });
        }
      });
    }
  });

}));
var port = 3000;
http.createServer(app).listen(port);
console.log("Express server listening on port %d", port);
