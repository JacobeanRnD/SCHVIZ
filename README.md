## deus-ex-state-machine-visualization

### API

```javascript
var layout = new forceLayout.Layout({
    parent: document.getElementById('visualization'),
    doc: xmlDocument,
    kielerAlgorithm: 'de.cau.cs.kieler.klay.layered',
    debug: false,
    geometry: null
});

// see if the simulation initialized correctly using the `initialized` promise
layout.initalized
  .done(null, function(e) { console.log('error!', e); });

// zoom to fit chart in parent bounding box
layout.fit();

// add/remove state highlight
layout.highlightState('state-id', true);
layout.highlightState('state-id', false);
layout.unhighlightAllStates();

// add/remove transition highlight
layout.highlightTransition('src', 'dst', true);
layout.highlightTransition('src', 'dst', false);

// update the visualization with a new scxml; the `update` method returns a
// promise that can be checked for errors.
layout.update(newXmlDocument)
  .done(null, function(e) { console.log('update failed!', e) });

// save state positions
var geometry = layout.saveGeometry();
// pass "geometry" argument to Layout constructor to use the saved geometry
// and skip kieler layout

// export as SVG
var svg = layout.exportSvg({
  css: css // the contents of forceLayout.css, it will be embedded in the SVG
});
```

### Embedding

#### JavaScript API

```html
<!DOCTYPE html>
<meta charset="utf-8">
<body>
<script src="http://desm-visualization.herokuapp.com/schviz.js"></script>
<script>
var src = '<?xml version="1.0" encoding="UTF-8"?><scxml xmlns="http://www.w3.org/2005/07/scxml"><state id="a"><transition target="b" event="e1"/></state><state id="b"/></scxml>';
schviz.visualize(document.querySelector('body'), src);
</script>
```

#### Image API

```html
<img src="http://desm-visualization.herokuapp.com/render?scxml=https://dl.dropboxusercontent.com/u/103063/static/desm-devel/archive.xml">
```
