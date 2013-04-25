var md5 = require('MD5');
var request = require('superagent');

var login = function(params) {
  request.post('http://mp.weixin.qq.com/cgi-bin/login?lang=zh_CN')
    .send({username: params.username, pwd: params.pwd, imgcode: '', f: 'json'})
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .end(function(res){
      if (res.ok) {
        if(JSON.parse(res.text).ErrCode == 0) {
          var tmp = res.body.ErrMsg;
          var token = tmp.split('token=')[1];
          var cookie = '';
          var cookies =  res.headers['set-cookie'];
          for(var i = 0, iMax = cookies.length; i < iMax; i++) {
            cookie += cookies[i].replace(/Path=\//g, '');
          }
          if (params.callback && typeof(params.callback) == 'function') {
            params.callback(cookie, token);
          }
        } else {
          console.log('login error', res.text);
        }
      }
    });
};

var getMessages = function(params) {
  request.get('http://mp.weixin.qq.com/cgi-bin/getmessage?t=wxm-message&token='+params.token+'&lang=zh_CN&count=50')
    .set('Cookie', params.cookie)
    .end(function(res){
      var text = res.text;
      text = text.replace(/[\t\n]/g, '');
      text = text.match(/<script type="json" id="json-msgList">(.*?)<\/script>/)[1];
      var messageArray = eval(text);
      if (params.callback && typeof(params.callback) == 'function') {
        params.callback(params.cookie, params.token, messageArray);
      }
    });
};

// push test message
var pushTextMessage = function(params) {
  request.post('http://mp.weixin.qq.com/cgi-bin/singlesend?t=ajax-response&lang=zh_CN')
    .set('Cookie', params.cookie)
    .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
    .set('Accept-Charset', 'GBK,utf-8;q=0.7,*;q=0.3')
    .set('Accept-Encoding', 'gzip,deflate,sdch')
    .set('Cache-Control', 'max-age=0')
    .set('Connection', 'keep-alive')
    .set('Host', 'mp.weixin.qq.com')
    .set('Origin', 'mp.weixin.qq.com')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:20.0) Gecko/20100101 Firefox/20.0')
    .set('Referer', 'http://mp.weixin.qq.com/cgi-bin/singlemsgpage?token='+params.token+'&fromfakeid='+params.tofakeid+'&msgid=&source=&count=20&t=wxm-singlechat&lang=zh_CN')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send({
      ajax: 1,
      token: params.token,
      content: params.content,
      tofakeid: params.tofakeid,
      type: 1
    })
    .end(function(res){
      console.log(res.text);
    });
};

/* 将接收到的消息与公众平台的消息进行匹配，当服务器端接收到微信之后调用，以获得更多有用的信息
 * params.cookie
 * params.token
 * params.message: 接收到的微信
 **/
var matchMessage = function(params) {
  getMessages({
    cookie: params.cookie,
    token: params.token,
    callback: function(cookie, token, messages) {
      var matchedMessage = undefined;
      for(var i = 0, iMax = messages.length; i < iMax; i ++) {
        var m = messages[i];
        if (m.dateTime == params.message.CreateTime && m.content == params.message.Content) {
          matchedMessage = m;
          if (params.callback && typeof(params.callback) == 'function') {
            params.callback(m);
            break;
          }
        }
      }
      if (matchedMessage == undefined) {
        console.log('no message matched on mp.weixin');
        if (params.errorCallback && typeof(params.errorCallback) == 'function') {
          params.errorCallback();
        }
      }
    }
  });
};

/*
login({
  username: 'xyn0563@126.com',
  pwd: pwd,
  callback: function(cookie, token) {
    console.log('login success')
    getMessages({
      cookie: cookie,
      token: token
    });
    pushTextMessage({
      cookie: cookie,
      token: token,
      content: 'helloworld',
      tofakeid: '14114475'
    });
    matchMessage({
      cookie: cookie,
      token: token
    });
  }
});
*/

module.exports = {
  login: login,
  getMessages: getMessages,
  matchMessage: matchMessage,
  pushTextMessage: pushTextMessage
};

