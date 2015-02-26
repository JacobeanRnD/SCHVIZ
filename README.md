## deus-ex-state-machine-visualization

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
