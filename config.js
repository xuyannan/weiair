exports.config = function(){
    return {
        'db' : {
            'url' : 'weiair',
            'collections' : ['aqi', 'usemaqi', 'weather']
        },
        'timezone': 8,
        'PM25APPKEY': 'QfEJyi3oWKSBCnKrqp1v',
        'robotFrequency': 60 // min
    };
}
