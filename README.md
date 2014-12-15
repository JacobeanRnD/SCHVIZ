## deus-ex-state-machine-visualization

```javascript
var layout = new forceLayout.Layout({
    parent: document.getElementById('visualization'),
    doc: xmlDocument,
    kielerURL: '/kieler/layout',
    kielerAlgorithm: 'de.cau.cs.kieler.klay.layered',
    debug: false
});

// begin the force layout simulation
layout.start();

// add/remove state highlight
layout.highlightState('state-id', true);
layout.highlightState('state-id', false);

// add/remove transition highlight
layout.highlightTransition('src', 'dst', true);
layout.highlightTransition('src', 'dst', false);
```
