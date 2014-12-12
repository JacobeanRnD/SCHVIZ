(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var CELL_MIN, CELL_PAD, CONTROL_SIZE, DEBUG_FORCE_FACTOR, LABEL_SPACE, LINK_DISTANCE, LINK_STRENGTH, MARGIN, MAX_ZOOM, MIN_ZOOM, ROUND_CORNER, def, exit, force, nextId, parents, path, toKielerFormat, treeFromXml, walk;

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

LABEL_SPACE = 400;

CONTROL_SIZE = {
  w: 25,
  h: 25
};

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

walk = function(node, callback, parent, postorder) {
  var child, _i, _len, _ref;
  if (parent == null) {
    parent = null;
  }
  if (postorder == null) {
    postorder = false;
  }
  if (!postorder) {
    callback(node, parent);
  }
  _ref = node.children || [];
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    child = _ref[_i];
    walk(child, callback, node, postorder);
  }
  if (postorder) {
    return callback(node, parent);
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

toKielerFormat = function(node) {
  var child, children, edges, rv, transition, _i, _j, _len, _len1, _ref, _ref1;
  children = [];
  edges = [];
  _ref = node.children || [];
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    child = _ref[_i];
    children.push(toKielerFormat(child));
    _ref1 = child.transitions || [];
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      transition = _ref1[_j];
      edges.push({
        id: transition.id,
        source: child.id,
        target: transition.target
      });
    }
  }
  rv = {
    id: node.id,
    children: children,
    edges: edges
  };
  if (node.id != null) {
    rv.labels = [
      {
        text: node.id
      }
    ];
  }
  if ((node.children || []).length === 0) {
    rv.width = node.w;
    rv.height = node.h;
  }
  return rv;
};

force.kielerLayout = function(kielerURL, kielerAlgorithm, top) {
  var applyLayout, edgeMap, form, graph;
  edgeMap = {};
  applyLayout = function(node, kNode, x0, y0) {
    var child, childMap, edge, kChild, points, tr, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _results;
    if (x0 == null) {
      x0 = null;
    }
    if (y0 == null) {
      y0 = null;
    }
    node.w = kNode.width;
    node.h = kNode.height;
    if (!((x0 != null) && (y0 != null))) {
      x0 = -node.w / 2;
      y0 = -node.h / 2;
    }
    node.x = x0 + kNode.x + node.w / 2;
    node.y = y0 + kNode.y + node.h / 2;
    _ref = node.transitions || [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      tr = _ref[_i];
      edge = edgeMap[tr.id];
      if (edge.bendPoints.length) {
        points = edge.bendPoints;
      } else {
        points = [edge.sourcePoint, edge.targetPoint];
      }
      tr.x = x0 + d3.mean(points, function(p) {
        return p.x;
      });
      tr.y = y0 + d3.mean(points, function(p) {
        return p.y;
      });
    }
    childMap = {};
    _ref1 = node.children || [];
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      child = _ref1[_j];
      if (child.id != null) {
        childMap[child.id] = child;
      }
    }
    _ref2 = kNode.children || [];
    _results = [];
    for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
      kChild = _ref2[_k];
      if ((child = childMap[kChild.id]) == null) {
        continue;
      }
      _results.push(applyLayout(child, kChild, node.x - node.w / 2, node.y - node.h / 2));
    }
    return _results;
  };
  graph = toKielerFormat(top);
  form = {
    graph: JSON.stringify(graph),
    config: JSON.stringify({
      algorithm: kielerAlgorithm
    }),
    iFormat: 'org.json',
    oFormat: 'org.json'
  };
  return Q($.post(kielerURL, form)).then(function(resp) {
    var graphLayout;
    graphLayout = JSON.parse(resp)[0];
    walk(graphLayout, (function(_this) {
      return function(kNode) {
        var edge, _i, _len, _ref, _results;
        _ref = kNode.edges || [];
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          edge = _ref[_i];
          _results.push(edgeMap[edge.id] = edge);
        }
        return _results;
      };
    })(this));
    return applyLayout(top, graphLayout);
  })["catch"](function(resp) {
    throw Error(resp.responseText);
  });
};

force.Layout = (function() {
  function Layout(options) {
    this.debug = options.debug || false;
    this.svgCreate(options.parent);
    this.runSimulation = false;
    this.loadTree(options.tree || treeFromXml(options.doc).sc);
    this.svgNodes();
    force.kielerLayout(options.kielerURL, options.kielerAlgorithm, this.top).then((function(_this) {
      return function(treeWithLayout) {
        _this.setupD3Layout();
        _this.layout.on('tick', function() {
          _this.adjustLayout();
          return _this.svgUpdate();
        });
        return _this.svgUpdate();
      };
    })(this))["catch"]((function(_this) {
      return function(e) {
        return _this.el = $('<div>').text(e.message).replaceAll(_this.el)[0];
      };
    })(this));
  }

  Layout.prototype.loadTree = function(tree) {
    var topNode, _i, _j, _len, _len1, _results;
    this.nodes = [];
    this.controls = [];
    this.cells = [];
    this.nodeMap = {};
    this.links = [];
    this.transitions = [];
    this.top = {
      children: tree,
      controls: []
    };
    for (_i = 0, _len = tree.length; _i < _len; _i++) {
      topNode = tree[_i];
      walk(topNode, (function(_this) {
        return function(node, parent) {
          node.controls = [];
          node.children = node.children || [];
          node.w = node.w || CELL_MIN.w;
          node.h = node.h || CELL_MIN.h;
          _this.nodes.push(node);
          _this.cells.push(node);
          _this.nodeMap[node.id] = node;
          return node.parent = parent != null ? _this.nodeMap[parent.id] : _this.top;
        };
      })(this));
    }
    _results = [];
    for (_j = 0, _len1 = tree.length; _j < _len1; _j++) {
      topNode = tree[_j];
      _results.push(walk(topNode, (function(_this) {
        return function(node) {
          var a, b, c, label, source, target, tr, _k, _l, _len2, _len3, _ref, _ref1, _ref2, _ref3, _results1;
          _ref = node.transitions || [];
          _results1 = [];
          for (_k = 0, _len2 = _ref.length; _k < _len2; _k++) {
            tr = _ref[_k];
            _ref1 = path(node, _this.nodeMap[tr.target]), a = _ref1[0], c = _ref1[1], b = _ref1[2];
            tr.parent = c || _this.top;
            tr.w = CONTROL_SIZE.w;
            tr.h = CONTROL_SIZE.h;
            tr.id = tr.id || nextId();
            tr.parent.controls.push(tr);
            _this.nodes.push(tr);
            _this.controls.push(tr);
            _ref2 = d3.pairs([a, tr, b]);
            for (_l = 0, _len3 = _ref2.length; _l < _len3; _l++) {
              _ref3 = _ref2[_l], source = _ref3[0], target = _ref3[1];
              _this.links.push({
                source: source,
                target: target
              });
            }
            label = tr.event || '';
            _results1.push(_this.transitions.push({
              a: a,
              b: b,
              c: tr,
              selfie: node.id === tr.target,
              label: label
            }));
          }
          return _results1;
        };
      })(this)));
    }
    return _results;
  };

  Layout.prototype.svgCreate = function(parent) {
    var defs, height, svg, width, zoom, zoomNode, zoomRect;
    width = $(parent).width() - 5;
    height = $(parent).height() - 5;
    zoom = d3.behavior.zoom().scaleExtent([MIN_ZOOM, MAX_ZOOM]);
    svg = d3.select(parent).append('svg').classed('force-layout', true).classed('debug', this.debug);
    this.el = svg[0][0];
    defs = svg.append('defs');
    zoomNode = svg.append('g');
    this.container = zoomNode.call(zoom).append('g');
    zoomRect = this.container.append('rect').attr('class', 'zoomRect');
    svg.attr('width', width).attr('height', height);
    zoomRect.attr('width', width / MIN_ZOOM).attr('height', height / MIN_ZOOM).attr('x', -width / 2 / MIN_ZOOM).attr('y', -height / 2 / MIN_ZOOM);
    zoom.on('zoom', (function(_this) {
      return function() {
        var e;
        e = d3.event;
        return _this.container.attr('transform', "translate(" + e.translate + "),scale(" + e.scale + ")");
      };
    })(this));
    zoom.size([width, height]).translate([width / 2, height / 2]).event(zoomNode);
    return defs.append('marker').attr('id', (this._arrow_id = nextId())).attr('refX', '7').attr('refY', '5').attr('markerWidth', '10').attr('markerHeight', '10').attr('orient', 'auto').append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z').attr('class', 'arrow');
  };

  Layout.prototype.svgNodes = function() {
    var cell, transition;
    cell = this.container.selectAll('.cell').data(this.cells).enter().append('g').attr('class', function(cell) {
      return "cell cell-" + (cell.type || 'state');
    }).attr('id', function(cell) {
      return "force-layout-cell-" + cell.id;
    }).classed('parallel-child', function(cell) {
      return cell.parent.type === 'parallel';
    });
    cell.append('rect').attr('class', 'border').attr('rx', ROUND_CORNER).attr('ry', ROUND_CORNER);
    cell.append('text').text(function(node) {
      return node.id;
    }).each(function(node) {
      node.textWidth = d3.min([$(this).width() + 2 * ROUND_CORNER, LABEL_SPACE]);
      return node.w = d3.max([node.w, node.textWidth]);
    });
    transition = this.container.selectAll('.transition').data(this.transitions).enter().append('g').attr('class', 'transition').attr('id', function(tr) {
      return "force-layout-transition-" + tr.c.id;
    });
    transition.append('path').attr('style', "marker-end: url(#" + this._arrow_id + ")");
    transition.append('g').attr('class', 'transition-label').append('text').text(function(tr) {
      return tr.label;
    }).each(function(tr) {
      tr.c.textWidth = d3.min([$(this).width() + 5, LABEL_SPACE]);
      return tr.c.w = d3.max([tr.c.w, tr.c.textWidth]);
    }).attr('dy', '.3em');
    if (this.debug) {
      return transition.selectAll('.transition-label').append('rect').attr('class', 'control').attr('x', function(tr) {
        return -tr.c.w / 2;
      }).attr('y', function(tr) {
        return -tr.c.h / 2;
      }).attr('width', function(tr) {
        return tr.c.w;
      }).attr('height', function(tr) {
        return tr.c.h;
      });
    }
  };

  Layout.prototype.svgUpdate = function() {
    this.container.selectAll('.cell').attr('transform', function(node) {
      return "translate(" + node.x + "," + node.y + ")";
    }).classed('fixed', function(node) {
      return node.fixed;
    });
    this.container.selectAll('.cell').each(function(node) {
      d3.select(this).select('rect').attr('x', -node.w / 2).attr('y', -node.h / 2).attr('width', node.w).attr('height', node.h);
      return d3.select(this).select('text').attr('y', function(node) {
        return CELL_PAD.top - node.h / 2 - 5;
      });
    });
    this.container.selectAll('.selfie').remove();
    this.container.selectAll('.transition').selectAll('path').attr('d', function(tr) {
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
    return this.container.selectAll('.transition').selectAll('.transition-label').attr('transform', function(tr) {
      return "translate(" + tr.c.x + "," + tr.c.y + ")";
    });
  };

  Layout.prototype.setupD3Layout = function() {
    var drag, lock;
    this.layout = d3.layout.force().charge(0).gravity(0).linkStrength(LINK_STRENGTH).linkDistance(LINK_DISTANCE).nodes(this.nodes).links(this.links).start();
    if (!this.runSimulation) {
      this.layout.stop();
    }
    lock = {
      node: null,
      drag: false
    };
    drag = d3.behavior.drag().origin(function(node) {
      return node;
    }).on('dragstart', (function(_this) {
      return function(node) {
        d3.event.sourceEvent.stopPropagation();
        (lock.node = node).fixed = true;
        return lock.drag = true;
      };
    })(this)).on('drag', (function(_this) {
      return function(node) {
        d3.event.sourceEvent.stopPropagation();
        node.px = d3.event.x;
        node.py = d3.event.y;
        if (_this.runSimulation) {
          return _this.layout.resume();
        } else {
          node.x = node.px;
          node.y = node.py;
          _this.adjustLayout();
          return _this.svgUpdate();
        }
      };
    })(this)).on('dragend', (function(_this) {
      return function(node) {
        d3.event.sourceEvent.stopPropagation();
        lock.drag = false;
        lock.node = null;
        return node.fixed = false;
      };
    })(this));
    return this.container.selectAll('.cell').on('mouseover', (function(_this) {
      return function(node) {
        if (lock.drag) {
          return;
        }
        if (lock.node) {
          lock.node.fixed = false;
        }
        (lock.node = node).fixed = true;
        node.px = node.x;
        node.py = node.y;
        return _this.svgUpdate();
      };
    })(this)).on('mouseout', (function(_this) {
      return function(node) {
        if (lock.drag) {
          return;
        }
        lock.node = null;
        node.fixed = false;
        return _this.svgUpdate();
      };
    })(this)).call(drag);
  };

  Layout.prototype.adjustLayout = function() {
    var adjustNode, handleCollisions, move, node, tick, _i, _len, _ref;
    tick = {
      gravity: this.layout.alpha() * 0.1,
      forces: {}
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
    handleCollisions = (function(_this) {
      return function(parent, center, tick) {
        var child, collide, dx, dy, node, nx1, nx2, ny1, ny2, objects, q, _i, _j, _len, _len1, _ref, _results;
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
          node = objects[_j];
          nx1 = node.x - node.w - 100;
          nx2 = node.x + node.w + 100;
          ny1 = node.y - node.h - 100;
          ny2 = node.y + node.h + 100;
          collide = function(quad, x1, y1, x2, y2) {
            var cx, cy, dx1, dx2, dy1, dy2, f, h, na, oa, other, s, w;
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
          _results.push(q.visit(collide));
        }
        return _results;
      };
    })(this);
    adjustNode = (function(_this) {
      return function(node) {
        var contents, dx, dy, grow, xMax, xMin, yMax, yMin;
        if (node.children.length > 0) {
          handleCollisions(node, node, tick);
          contents = [].concat(node.children, node.controls);
          xMin = d3.min(contents, function(d) {
            return d.x - d.w / 2;
          }) - CELL_PAD.left;
          xMax = d3.max(contents, function(d) {
            return d.x + d.w / 2;
          }) + CELL_PAD.right;
          yMin = d3.min(contents, function(d) {
            return d.y - d.h / 2;
          }) - CELL_PAD.top;
          yMax = d3.max(contents, function(d) {
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
    })(this);
    _ref = this.top.children;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      node = _ref[_i];
      walk(node, adjustNode, null, true);
    }
    handleCollisions(this.top, {
      x: 0,
      y: 0
    }, tick);
    if (this.debug) {
      this.container.selectAll('.cell .force').remove();
      return this.container.selectAll('.cell').each(function(node) {
        var _j, _len1, _ref1, _results;
        _ref1 = tick.forces[node.id] || [];
        _results = [];
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          force = _ref1[_j];
          _results.push(d3.select(this).append('line').attr('class', "force " + force.cls).attr('x1', 0).attr('y1', 0).attr('x2', force.value[0] * DEBUG_FORCE_FACTOR).attr('y2', force.value[1] * DEBUG_FORCE_FACTOR));
        }
        return _results;
      });
    }
  };

  Layout.prototype.start = function() {
    this.runSimulation = true;
    if (this.layout != null) {
      return this.layout.start();
    }
  };

  Layout.prototype.stop = function() {
    this.runSimulation = false;
    if (this.layout != null) {
      return this.layout.stop();
    }
  };

  Layout.prototype.highlightState = function(id, highlight) {
    if (highlight == null) {
      highlight = true;
    }
    return this.container.selectAll("#force-layout-cell-" + id).classed('highlight', highlight);
  };

  Layout.prototype.highlightTransition = function(source, target, highlight) {
    var tr, _i, _len, _ref, _results;
    if (highlight == null) {
      highlight = true;
    }
    _ref = this.transitions;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      tr = _ref[_i];
      if (tr.a.id === source && tr.b.id === target) {
        _results.push(this.container.selectAll("#force-layout-transition-" + tr.c.id).classed('highlight', highlight));
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  return Layout;

})();

force.render = function(options) {
  return new force.Layout(options);
};



},{"./treeFromXml.coffee":2}],2:[function(require,module,exports){
var strip;

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
    var state, stateList, _i, _len, _ref;
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