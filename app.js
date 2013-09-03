
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
var md5 = require('MD5');
var db = require('mongojs').connect(C.db.url , C.db.collections);
var weixinmp = require('./mp.weixin.js');

var app = connect();
app.use(connect.query());

var tool = require('./aqitool.js');

var saveOrUpdateUser = function(params){
  var userid = params.userid;
  var fakeid = params.fakeid;
  db.users.find({fakeid: fakeid}, function(error, result){
    if(error) {
      console.log('saveOrUpdateUser error');
      if(params.errorCallback && typeof(params.errorCallback) != 'undefined') {
        params.errorCallback();
      }

    } else if(result && result.length > 0) {
      if(params.callback && typeof(params.callback) != 'undefined') {
        params.callback(result[0]);
      }
    } else  {
      var user = {fakeid: params.fakeid, nickname: params.nickname};
      db.users.save( user
      , function(error){
        if(error) {
          console.log('save user error: ', error);
        } else {
          if(params.callback && typeof(params.callback) != 'undefined') {
            params.callback(user);
          }
        }
      });
    }
  });
};

app.use('/public', express.static(__dirname + "/public"));

app.use('/', wechat('weiair', function (req, res, next) {
  // 微信输入信息都在req.weixin上
  var welcome = '感谢您关注微空气！发送城市名称，如"北京"或"beijing"即可获取空气质量数据~\n\r您可以发送"?"或"help"来获取帮助';
  var help = '[查询] 发送城市名称，如"北京"或"beijing"即可获取空气质量数据。';
  help += '[订阅] 发送"城市@时间"来订阅您所关心的城市，如"北京@10"，微空气将会在每天的10点左右向您推送北京的空气质量数据。';
  help += '[退订] 发送"北京@no"，即可退订北京的空气质量数据。';
  help += '[帮助] 发送"?"或"help"或"帮助"获得帮助';
  var message = req.weixin;
  if (message.MsgType == 'event' && message.Event == 'subscribe') {
    res.reply(welcome);
    return;
  }
  if (message.MsgType == 'event' && message.Event == 'unsubscribe') {
    console.log(message.FromUserName, ' say goodbye');
    return;
  }

  var subscribeCityReg = /^([^@]{2,8})@(([1-9]|[0-1][0-9]|2[0-4]))$/;
  var unsubscribeCityReg = /^([^@]{2,8})@NO/i;
  var querySubscribed = /\?\?/;
  var helpCommand = /^\?|？|help|帮助/i;
  var welcomeCommand = /^hello|^hi|^[您你]好|hoho|haha/i
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
    var sHour = matched[2];
    var sTime = sHour;
    if(!chinesecities.cn[sCity] && !chinesecities.py[sCity]) {
      res.reply('目前没有这个地区的数据，换个城市试试吧~');
      return ;
    }
    weixinmp.login({
      username: C.mp.username,
      pwd: md5(C.mp.pwd),
      callback: function(cookie, token) {
        weixinmp.matchMessage({
          cookie: cookie,
          token: token,
          message: message,
          callback: function(m) {
            saveOrUpdateUser({
              fakeid: m.fakeId,
              nickname: m.nickName,
              callback: function(user) {
                db.subscribe.find({userid: user.fakeid, city: sCity, pushtime: sTime}, function(error, result){
                  if(error) {
                    console.log(error);
                  } else if( result && result.length > 0 ) {
                    res.reply('您之前订阅过了 ' + message.Content );
                  } else {
                    db.subscribe.save({
                      userid: user.fakeid,
                      city: sCity,
                      xxid: sUser,
                      pushtime: sTime
                    }, function(error){
                      if (error) {
                        console.log('save subscribe error: ', error);
                      } else {
                        res.reply('订阅成功，微空气将会在每天的 ' + sTime + ' 点左右向您发送 ' + sCity + ' 的空气质量状况');
                      }
                    });
                  }
                });
              },
              errorCallback: function() {
                res.reply('sorry，有点小意外，订阅失败，麻烦过一小会再试~');
              }
            });
          },
          errorCallback: function() {
            res.reply('sorry，有点小意外，订阅失败，麻烦再试一次~');
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
    db.subscribe.remove({xxid: sUser, city: sCity}, function(error) {
      if (error) {
        console.log('error while unsubscribe:', error);
        res.reply('sorry，有点小意外，操作失败，麻烦过一小会再试~');
      } else {
        res.reply('操作成功，您已退订了 ' + sCity + ' 的空气质量状况~');
      }
    });
    return ;
  }


  var now = new Date();
  var serverTime = now.getTime();
  var utcTime = serverTime + now.getTimezoneOffset() * 60000;
  var clientTime = utcTime + C.timezone * 3600000;
  var requestTime =  new Date(clientTime);
  var now_str = dateformat(requestTime, 'yyyy-mm-dd-HH');

  var city = message.Content;
  console.log(dateformat(requestTime, 'yyyy-mm-dd HH:MM:ss'), '[', message.Content, ']', '\r\r');
  
  var requestCity = message.Content;
  requestCity = tool.getRealnameByNickname(requestCity);

  tool.getChineseData({
    city: requestCity,
    time_point: now_str,
    next: function(data) {
      //getUsemData(data, now_str);
      tool.getUsemData({
        data: data, 
        method: C.usemresource,
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
