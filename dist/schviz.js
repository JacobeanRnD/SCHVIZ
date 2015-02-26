(function() {
  var FORM, SCHVIZ_URL, schviz;

  SCHVIZ_URL = window.SCHVIZ_URL;

  delete window.SCHVIZ_URL;

  FORM = "loading ...\n<form action=\"" + SCHVIZ_URL + "\" method=\"POST\">\n  <input type=\"hidden\" name=\"src\">\n</form>";

  schviz = window.schviz = {};

  schviz.visualize = function(container, src) {
    var doc, iframe;
    iframe = document.createElement('iframe');
    iframe.setAttribute('style', 'border: none; width: 100%; height: 100%;');
    container.appendChild(iframe);
    doc = iframe.contentDocument;
    doc.querySelector('body').innerHTML = FORM;
    doc.querySelector('input').value = src;
    return doc.querySelector('form').submit();
  };

}).call(this);
