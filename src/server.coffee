http = require('http')
express = require('express')
bodyParser = require('body-parser')
fs = require('fs')
child_process = require('child_process')
request = require('request')

module.exports = server = {}

INVALID_URL = [
  /^http[s]?:\/\/unix:/
  /^file:/
]


render = (src, callback) ->
  child = child_process.exec(
    'phantomjs src/render.js'
    {encoding: 'binary', maxBuffer: 1024*1024}
    (err, stdout, stderr) ->
      console.log stderr if stderr
      if err?
        callback(err, null)
      else
        callback(null, new Buffer(stdout, 'base64'))
  )

  child.stdin.end(src)


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

  app.get '/render', (req, res) ->
    unless (url = req.query.scxml)?
      return res.status(400).send("Missing 'url' parameter")

    for pattern in INVALID_URL
      if url.match(pattern)
        return res.status(400).send("Invalid URL")

    request url, (err, urlRes, src) ->
      if err?
        if err.code == 'ENOTFOUND'
          return res.status(400).send("Failed to retrieve URL")

        console.error err
        res.sendStatus(500)

      else
        if urlRes.statusCode != 200
          return res.status(400).send("Failed to retrieve URL")

        render src, (err, png) ->
          if err?
            console.error err
            res.sendStatus(500)
          else
            res.set('Content-Type', 'image/png')
            res.send(png)
