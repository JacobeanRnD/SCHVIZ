## deus-ex-state-machine-visualization

```javascript
var layout = new forceLayout.Layout({
    parent: document.getElementById('visualization'),
    doc: xmlDocument,
    kielerAlgorithm: 'de.cau.cs.kieler.klay.layered',
    debug: false,
    geometry: null
});

// begin the force layout simulation
layout.start();

// add/remove state highlight
layout.highlightState('state-id', true);
layout.highlightState('state-id', false);

// add/remove transition highlight
layout.highlightTransition('src', 'dst', true);
layout.highlightTransition('src', 'dst', false);

// update the visualization with a new scxml
layout.update(newXmlDocument);

// save state positions
var geometry = layout.saveGeometry();
// pass "geometry" argument to Layout constructor to use the saved geometry
// and skip kieler layout
```
