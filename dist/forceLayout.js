(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var CELL_MIN, CELL_PAD, CONTROL_RADIUS, DEBUG_FORCE_FACTOR, LABEL_SPACE, LINK_DISTANCE, LINK_STRENGTH, MARGIN, MAX_ZOOM, MIN_ZOOM, ROUND_CORNER, arrange, collide, def, exit, force, handleCollisions, move, nextId, parents, path, treeFromXml, walk;

treeFromXml = require('./treeFromXml.coffee');

force = window.forceLayout = module.exports = {};

MARGIN = 5;

ROUND_CORNER = 5;

CELL_MIN = {
  w: 40,
  h: 40
};

CELL_PAD = {
  top: 20,
  bottom: 5,
  left: 5,
  right: 5
};

LABEL_SPACE = 80;

CONTROL_RADIUS = 20;

LINK_STRENGTH = .1;

LINK_DISTANCE = 30;

DEBUG_FORCE_FACTOR = 50;

MIN_ZOOM = 1 / 6;

MAX_ZOOM = 6;

nextId = (function() {
  var last;
  last = 0;
  return function() {
    last += 1;
    return "_force_id_" + last + "_";
  };
})();

def = function(map, key, defaultValue) {
  if (map[key] == null) {
    map[key] = defaultValue;
  }
  return map[key];
};

walk = function(state, callback, parent, postorder) {
  var child, _i, _len, _ref;
  if (parent == null) {
    parent = null;
  }
  if (postorder == null) {
    postorder = false;
  }
  if (!postorder) {
    callback(state, parent);
  }
  _ref = state.children || [];
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    child = _ref[_i];
    walk(child, callback, state, postorder);
  }
  if (postorder) {
    return callback(state, parent);
  }
};

parents = function(node) {
  if (node.parent) {
    return parents(node.parent).concat([node.parent]);
  } else {
    return [];
  }
};

path = function(node1, node2) {
  var eq, n, parents1, parents2, _i, _ref;
  parents1 = parents(node1);
  parents2 = parents(node2);
  eq = 0;
  for (n = _i = 0, _ref = d3.min([parents1.length, parents2.length]) - 1; 0 <= _ref ? _i <= _ref : _i >= _ref; n = 0 <= _ref ? ++_i : --_i) {
    if (parents1[n] !== parents2[n]) {
      break;
    }
    eq = n;
  }
  return [node1, parents1[eq], node2];
};

exit = function(cell, point) {
  var d, e, ex, ey;
  d = {
    x: point.x - cell.x,
    y: point.y - cell.y
  };
  ex = cell.w / 2 / d.x;
  ey = cell.h / 2 / d.y;
  e = d3.min([ex, ey], Math.abs);
  return {
    x: cell.x + d.x * e,
    y: cell.y + d.y * e
  };
};

force.drawTree = function(container, defs, tree, debug) {
  var cell, cells, control, controls, drag, layout, links, lock, nodeMap, nodes, render, top, topState, transition, transitions, _arrow_id, _i, _j, _len, _len1;
  nodes = [];
  controls = [];
  cells = [];
  nodeMap = {};
  links = [];
  transitions = [];
  top = {
    children: [],
    controls: []
  };
  for (_i = 0, _len = tree.length; _i < _len; _i++) {
    topState = tree[_i];
    walk(topState, function(state, parent) {
      var node;
      node = {
        id: state.id,
        type: state.type || 'state',
        w: CELL_MIN.w,
        h: CELL_MIN.h,
        children: [],
        controls: []
      };
      nodes.push(node);
      cells.push(node);
      nodeMap[state.id] = node;
      node.parent = parent != null ? nodeMap[parent.id] : top;
      return node.parent.children.push(node);
    });
  }
  for (_j = 0, _len1 = tree.length; _j < _len1; _j++) {
    topState = tree[_j];
    walk(topState, function(state) {
      var a, b, c, label, source, target, tr, _k, _l, _len2, _len3, _ref, _ref1, _ref2, _ref3, _results;
      _ref = state.transitions || [];
      _results = [];
      for (_k = 0, _len2 = _ref.length; _k < _len2; _k++) {
        tr = _ref[_k];
        _ref1 = path(nodeMap[state.id], nodeMap[tr.target]), a = _ref1[0], c = _ref1[1], b = _ref1[2];
        c = {
          transition: tr,
          parent: c || top,
          w: CONTROL_RADIUS,
          h: CONTROL_RADIUS
        };
        c.parent.controls.push(c);
        nodes.push(c);
        controls.push(c);
        _ref2 = d3.pairs([a, c, b]);
        for (_l = 0, _len3 = _ref2.length; _l < _len3; _l++) {
          _ref3 = _ref2[_l], source = _ref3[0], target = _ref3[1];
          links.push({
            source: source,
            target: target
          });
        }
        label = tr.event || '';
        if (tr.cond != null) {
          label += "[" + tr.cond + "]";
        }
        _results.push(transitions.push({
          a: a,
          b: b,
          c: c,
          selfie: state.id === tr.target,
          label: label
        }));
      }
      return _results;
    });
  }
  defs.append('marker').attr('id', (_arrow_id = nextId())).attr('refX', '7').attr('refY', '5').attr('markerWidth', '10').attr('markerHeight', '10').attr('orient', 'auto').append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z').attr('class', 'arrow');
  cell = container.selectAll('.cell').data(cells).enter().append('g').attr('class', function(cell) {
    return "cell cell-" + (cell.type || 'state');
  }).classed('parallel-child', function(cell) {
    return cell.parent.type === 'parallel';
  });
  cell.append('rect').attr('class', 'border').attr('x', function(node) {
    return -node.w / 2;
  }).attr('y', function(node) {
    return -node.h / 2;
  }).attr('width', function(node) {
    return node.w;
  }).attr('height', function(node) {
    return node.h;
  }).attr('rx', ROUND_CORNER).attr('ry', ROUND_CORNER);
  cell.append('text').text(function(node) {
    return node.id;
  }).each(function(node) {
    node.textWidth = d3.min([$(this).width() + 2 * ROUND_CORNER, LABEL_SPACE]);
    return node.w = d3.max([node.w, node.textWidth]);
  });
  transition = container.selectAll('.transition').data(transitions).enter().append('g').attr('class', 'transition');
  transition.append('path').attr('style', "marker-end: url(#" + _arrow_id + ")");
  transition.append('text').attr('class', 'transition-label').text(function(tr) {
    return tr.label;
  });
  if (debug) {
    control = container.selectAll('.control').data(controls).enter().append('circle').attr('class', 'control').attr('r', CONTROL_RADIUS);
  }
  layout = d3.layout.force().charge(0).gravity(0).linkStrength(LINK_STRENGTH).linkDistance(LINK_DISTANCE).nodes(nodes).links(links).start();
  lock = {
    node: null,
    drag: false
  };
  drag = d3.behavior.drag().origin(function(node) {
    return node;
  }).on('dragstart', function(node) {
    d3.event.sourceEvent.stopPropagation();
    (lock.node = node).fixed = true;
    return lock.drag = true;
  }).on('drag', function(node) {
    d3.event.sourceEvent.stopPropagation();
    node.px = d3.event.x;
    node.py = d3.event.y;
    return layout.resume();
  }).on('dragend', function(node) {
    d3.event.sourceEvent.stopPropagation();
    lock.drag = false;
    lock.node = null;
    return node.fixed = false;
  });
  container.selectAll('.cell').on('mouseover', function(node) {
    if (lock.drag) {
      return;
    }
    if (lock.node) {
      lock.node.fixed = false;
    }
    (lock.node = node).fixed = true;
    node.px = node.x;
    node.py = node.y;
    return render();
  }).on('mouseout', function(node) {
    if (lock.drag) {
      return;
    }
    lock.node = null;
    node.fixed = false;
    return render();
  }).call(drag);
  render = function() {
    container.selectAll('.cell').attr('transform', function(node) {
      return "translate(" + node.x + "," + node.y + ")";
    }).classed('fixed', function(node) {
      return node.fixed;
    });
    container.selectAll('.cell').each(function(node) {
      d3.select(this).select('rect').attr('x', -node.w / 2).attr('y', -node.h / 2).attr('width', node.w).attr('height', node.h);
      return d3.select(this).select('text').attr('y', function(node) {
        return CELL_PAD.top - node.h / 2 - 5;
      });
    });
    container.selectAll('.selfie').remove();
    transition.classed('highlight', function(tr) {
      return tr.a.fixed || tr.b.fixed;
    }).selectAll('path').attr('d', function(tr) {
      var a, b, c, c1, c2, h, s, t, w, _ref;
      _ref = [tr.a, tr.b, tr.c], a = _ref[0], b = _ref[1], c = _ref[2];
      if (tr.selfie) {
        w = c.x - a.x;
        h = c.y - a.y;
        c1 = {
          x: c.x - h / 2,
          y: c.y + w / 2
        };
        c2 = {
          x: c.x + h / 2,
          y: c.y - w / 2
        };
        s = exit(a, c1);
        t = exit(b, c2);
        return "M" + s.x + "," + s.y + " C" + c1.x + "," + c1.y + " " + c2.x + "," + c2.y + " " + t.x + "," + t.y;
      } else {
        s = exit(a, c);
        t = exit(b, c);
        return "M" + s.x + "," + s.y + " S" + c.x + "," + c.y + " " + t.x + "," + t.y;
      }
    });
    transition.selectAll('text').attr('x', function(tr) {
      return tr.c.x;
    }).attr('y', function(tr) {
      return tr.c.y;
    });
    if (debug) {
      return control.attr('cx', function(d) {
        return d.x;
      }).attr('cy', function(d) {
        return d.y;
      });
    }
  };
  return layout.on('tick', function() {
    var node, tick, _k, _len2, _ref;
    render();
    tick = {
      gravity: layout.alpha() * 0.1,
      forces: {}
    };
    _ref = top.children;
    for (_k = 0, _len2 = _ref.length; _k < _len2; _k++) {
      node = _ref[_k];
      walk(node, (function(node) {
        return arrange(node, tick);
      }), null, true);
    }
    handleCollisions(top, {
      x: 0,
      y: 0
    }, tick);
    if (debug) {
      container.selectAll('.cell .force').remove();
      return container.selectAll('.cell').each(function(node) {
        var _l, _len3, _ref1, _results;
        _ref1 = tick.forces[node.id] || [];
        _results = [];
        for (_l = 0, _len3 = _ref1.length; _l < _len3; _l++) {
          force = _ref1[_l];
          _results.push(d3.select(this).append('line').attr('class', "force " + force.cls).attr('x1', 0).attr('y1', 0).attr('x2', force.value[0] * DEBUG_FORCE_FACTOR).attr('y2', force.value[1] * DEBUG_FORCE_FACTOR));
        }
        return _results;
      });
    }
  });
};

arrange = function(node, tick) {
  var dx, dy, grow, xMax, xMin, yMax, yMin;
  if (node.children.length > 0) {
    handleCollisions(node, node, tick);
    xMin = d3.min(node.children, function(d) {
      return d.x - d.w / 2;
    }) - CELL_PAD.left;
    xMax = d3.max(node.children, function(d) {
      return d.x + d.w / 2;
    }) + CELL_PAD.right;
    yMin = d3.min(node.children, function(d) {
      return d.y - d.h / 2;
    }) - CELL_PAD.top;
    yMax = d3.max(node.children, function(d) {
      return d.y + d.h / 2;
    }) + CELL_PAD.bottom;
    grow = node.textWidth - (xMax - xMin);
    if (grow > 0) {
      xMin -= grow / 2;
      xMax += grow / 2;
    }
    node.w = xMax - xMin;
    node.h = yMax - yMin;
    dx = xMin + node.w / 2 - node.x;
    dy = yMin + node.h / 2 - node.y;
    node.x += dx;
    node.y += dy;
    if (node.fixed) {
      move(node, -dx, -dy);
    }
  }
  return node.weight = node.w * node.h;
};

move = function(node, dx, dy) {
  var child, control, _i, _j, _len, _len1, _ref, _ref1, _results;
  node.x += dx;
  node.y += dy;
  _ref = node.children || [];
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    child = _ref[_i];
    move(child, dx, dy);
  }
  _ref1 = node.controls || [];
  _results = [];
  for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
    control = _ref1[_j];
    _results.push(move(control, dx, dy));
  }
  return _results;
};

handleCollisions = function(parent, center, tick) {
  var child, dx, dy, obj, objects, q, _i, _j, _len, _len1, _ref, _results;
  _ref = parent.children;
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    child = _ref[_i];
    dx = (center.x - child.x) * tick.gravity;
    dy = (center.y - child.y) * tick.gravity;
    move(child, dx, dy);
    def(tick.forces, child.id, []).push({
      value: [dx, dy],
      cls: 'gravity'
    });
  }
  objects = [].concat(parent.children, parent.controls);
  q = d3.geom.quadtree(objects);
  _results = [];
  for (_j = 0, _len1 = objects.length; _j < _len1; _j++) {
    obj = objects[_j];
    _results.push(q.visit(collide(obj, tick)));
  }
  return _results;
};

collide = function(node, tick) {
  var fn, nx1, nx2, ny1, ny2;
  nx1 = node.x - node.w - 100;
  nx2 = node.x + node.w + 100;
  ny1 = node.y - node.h - 100;
  ny2 = node.y + node.h + 100;
  fn = function(quad, x1, y1, x2, y2) {
    var cx, cy, dx, dx1, dx2, dy, dy1, dy2, f, h, na, oa, other, s, w;
    other = quad.point;
    if (other && (other !== node)) {
      dx = node.x - other.x;
      dy = node.y - other.y;
      w = (node.w + other.w) / 2 + MARGIN;
      h = (node.h + other.h) / 2 + MARGIN;
      cx = w - Math.abs(dx);
      cy = h - Math.abs(dy);
      if (cx > 0 && cy > 0) {
        na = node.w * node.h;
        oa = other.w * other.h;
        f = oa / (oa + na);
        if (cx / w < cy / h) {
          dy1 = dy2 = 0;
          s = dx > 0 ? 1 : -1;
          dx1 = s * f * cx;
          dx2 = s * (f - 1) * cx;
        } else {
          dx1 = dx2 = 0;
          s = dy > 0 ? 1 : -1;
          dy1 = s * f * cy;
          dy2 = s * (f - 1) * cy;
        }
        move(node, dx1, dy1);
        move(other, dx2, dy2);
        def(tick.forces, node.id, []).push({
          value: [dx1, dy1],
          cls: 'collision'
        });
        def(tick.forces, other.id, []).push({
          value: [dx2, dy2],
          cls: 'collision'
        });
      }
    }
    return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
  };
  return fn;
};

force.render = function(options) {
  var container, debug, defs, height, svg, tree, width, zoom, zoomNode, zoomRect;
  if (options.tree != null) {
    tree = options.tree;
  } else {
    tree = treeFromXml(options.doc).sc;
  }
  debug = options.debug || false;
  width = $(options.parent).width() - 5;
  height = $(options.parent).height() - 5;
  zoom = d3.behavior.zoom().scaleExtent([MIN_ZOOM, MAX_ZOOM]);
  svg = d3.select(options.parent).append('svg').classed('force-layout', true).classed('debug', debug);
  defs = svg.append('defs');
  zoomNode = svg.append('g');
  container = zoomNode.call(zoom).append('g');
  zoomRect = container.append('rect').attr('class', 'zoomRect');
  svg.attr('width', width).attr('height', height);
  zoomRect.attr('width', width / MIN_ZOOM).attr('height', height / MIN_ZOOM).attr('x', -width / 2 / MIN_ZOOM).attr('y', -height / 2 / MIN_ZOOM);
  zoom.on('zoom', function() {
    var e;
    e = d3.event;
    return container.attr('transform', "translate(" + e.translate + "),scale(" + e.scale + ")");
  });
  zoom.size([width, height]).translate([width / 2, height / 2]).event(zoomNode);
  return force.drawTree(container, defs, tree, debug = debug);
};



},{"./treeFromXml.coffee":2}],2:[function(require,module,exports){
var DESM, strip;

DESM = 'http://scxml.io/desm';

strip = function(obj) {
  var key, value;
  for (key in obj) {
    value = obj[key];
    if (value != null) {
      if (_.isArray(value) && value.length === 0) {
        delete obj[key];
      } else if (_.isObject(value)) {
        strip(value);
        if (_.isEmpty(value)) {
          delete obj[key];
        }
      }
    } else {
      delete obj[key];
    }
  }
  return obj;
};

module.exports = function(doc) {
  var parseActions, parseChildNodes, parseStates;
  parseActions = function(container) {
    var child, rv, _i, _len, _ref;
    rv = [];
    _ref = container.childNodes;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      child = _ref[_i];
      if (child.tagName) {
        rv.push({
          xml: '' + child
        });
      }
    }
    return rv;
  };
  parseChildNodes = function(node) {
    var child, onentry, onexit, target, transitions, _i, _len, _ref;
    transitions = [];
    onentry = [];
    onexit = [];
    _ref = node.childNodes;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      child = _ref[_i];
      switch (child.tagName) {
        case 'transition':
          target = child.getAttribute('target');
          if (!target) {
            throw new Error("not implemented: transition with no target");
          }
          if (target.indexOf(' ') > -1) {
            throw new Error("not implemented: transition with multiple targets");
          }
          transitions.push(strip({
            target: target,
            cond: child.getAttribute('cond') || null,
            event: child.getAttribute('event') || null,
            actions: parseActions(child)
          }));
          break;
        case 'onentry':
          onentry = onentry.concat(parseActions(child));
          break;
        case 'onexit':
          onexit = onexit.concat(parseActions(child));
      }
    }
    return {
      transitions: transitions,
      onentry: onentry,
      onexit: onexit
    };
  };
  parseStates = function(node) {
    var geometry, state, stateList, _i, _len, _ref;
    stateList = [];
    _ref = node.childNodes;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      node = _ref[_i];
      state = (function() {
        switch (node.tagName) {
          case 'initial':
            return {
              type: 'initial',
              id: node.getAttribute('id') || null,
              children: parseStates(node)
            };
          case 'state':
            return {
              type: 'state',
              id: node.getAttribute('id') || null,
              children: parseStates(node)
            };
          case 'final':
            return {
              type: 'final',
              id: node.getAttribute('id') || null,
              children: parseStates(node)
            };
          case 'parallel':
            return {
              type: 'parallel',
              id: node.getAttribute('id') || null,
              children: parseStates(node)
            };
          case 'history':
            return {
              type: 'history',
              id: node.getAttribute('id') || null,
              deep: node.getAttribute('type') === 'deep' || null
            };
        }
      })();
      if (state != null) {
        geometry = node.getAttributeNS(DESM, 'geometry') || null;
        state.uuid = node.getAttributeNS(DESM, 'uuid') || null;
        state.geom = (geometry != null) && trees.unpackGeom(geometry) || null;
        _.extend(state, parseChildNodes(node));
        stateList.push(strip(state));
      }
    }
    return stateList;
  };
  return {
    sc: parseStates(doc.documentElement)
  };
};



},{}]},{},[1])