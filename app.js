var express = require('express');
var app = express();
var path = require('path')
var bodyParser = require('body-parser')

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(express.static('public'));


app.set('views', path.join(__dirname, 'view'))
app.set('view engine', 'ejs');

app.get('/', function (req, res) {
    res.render('index')
});

// error 처리...
// err 파라미터가 있으면 다른 미들웨어는 건너 뛰고 바로 이 미들웨어로 온다.
app.use(function (err, req, res, next) {
	console.error(err);
	res.end("<h1>ERROR!</h1>")
});

app.listen(3000, function () {
  console.log('3000번 포트 구동중..');
});

