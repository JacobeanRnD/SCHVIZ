http = require('http')
express = require('express')
bodyParser = require('body-parser')
fs = require('fs')

module.exports = server = {}


server.serve = (host, port) ->
  app = express()

  app.get '/schviz.js', (req, res) ->
    jsUrl = req.protocol + '://' + req.get('host') + req.originalUrl
    apiUrl = jsUrl.slice(0, jsUrl.length - 3)
    src = fs.readFileSync(__dirname + '/../dist/schviz.js')
    res.type('.js').send('window.SCHVIZ_URL = "' + apiUrl + '";\n\n' + src)

  app.use('/bower_components', express.static(__dirname + '/../bower_components'))

  app.use('/', express.static(__dirname + '/../dist'))

  app.use(bodyParser.urlencoded(extended: true))

  app.post '/schviz', (req, res) ->
    html = fs.readFileSync(__dirname + '/schviz.html', encoding: 'utf8')
    json = JSON.stringify(req.body.src)
    res.send(html.replace('//CALL', 'show(' + json + ');'))

  http.createServer(app).listen port, host, ->
    console.log('devel server listening on ' + host + ':' + port)
