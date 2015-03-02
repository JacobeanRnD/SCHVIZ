var system = require('system');
var webpage = require('webpage');
var fs = require('fs');

var src = system.stdin.read();
var css = fs.read(phantom.libraryPath + '/../dist/forceLayout.css');

var page = webpage.create();

page.onConsoleMessage = function(msg) {
  console.log('CONSOLE:', msg);
};

page.onError = function(err) {
  console.log('ERROR:', JSON.stringify(err));
};

page.onCallback = function(type, data) {
  if(type == 'exit') {
    phantom.exit();
  }

  if(type == 'result') {
    svgToPng(data);
  }
};

page.open('file://' + phantom.libraryPath + '/render.html', function(status) {
  page.evaluate(function(src, css) {
    renderToSvg(src, css);
  }, src, css);
});

function svgToPng(svg) {
  var m = svg.match(/viewBox="\S+ \S+ (\S+) (\S+)"/);
  pngPage = webpage.create();
  pngPage.viewportSize = {width: +m[1], height: +m[2]};
  pngPage.setContent(svg, '');
  var b64png = pngPage.renderBase64('PNG');
  system.stdout.write(b64png);
}
