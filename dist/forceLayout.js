(function() {
  var ANIMATION_SPEED, CELL_MIN, CELL_PAD, CONTROL_SIZE, DEBUG_FORCE_FACTOR, KIELER_URL, LABEL_SPACE, LINK_DISTANCE, LINK_STRENGTH, LoadingOverlay, MARGIN, MAX_ZOOM, MIN_ZOOM, NewNodesAnimation, ROUND_CORNER, def, exit, findTransition, force, idMaker, midpoint, nextId, parents, path, strip, toKielerFormat, transitionPath, treeFromXml, walk;

  force = window.forceLayout = {};

  KIELER_URL = 'http://kieler.herokuapp.com/live';

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

  ANIMATION_SPEED = 2;

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

  treeFromXml = function(doc) {
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
            if (target && target.indexOf(' ') > -1) {
              throw new Error("not implemented: transition with multiple targets");
            }
            if (!target) {
              target = node.getAttribute('id');
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

  idMaker = function() {
    var counterMap;
    counterMap = d3.map();
    return function(prefix) {
      var counter;
      if (prefix == null) {
        prefix = '_force_id_';
      }
      counter = counterMap.get(prefix) || 0;
      counter += 1;
      counterMap.set(prefix, counter);
      return "" + prefix + counter;
    };
  };

  nextId = idMaker();

  def = function(map, key, defaultValue) {
    if (!map.has(key)) {
      map.set(key, defaultValue);
    }
    return map.get(key);
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

  midpoint = function(a, b) {
    return {
      x: ((a.x || 0) + (b.x || 0)) / 2,
      y: ((a.y || 0) + (b.y || 0)) / 2
    };
  };

  transitionPath = function(tr) {
    var a, b, c, c1, c2, d, h, i, j, m, s, sc, sm, t, tc, tm, w, _ref;
    _ref = [tr.a, tr.b, tr], a = _ref[0], b = _ref[1], c = _ref[2];
    if (tr.selfie) {
      w = c.x - a.x;
      h = c.y - a.y;
      c1 = {
        x: c.x - h / 4,
        y: c.y + w / 4
      };
      c2 = {
        x: c.x + h / 4,
        y: c.y - w / 4
      };
      s = exit(a, c1);
      t = exit(a, c2);
      return "M" + s.x + "," + s.y + " C" + c1.x + "," + c1.y + " " + c1.x + "," + c1.y + " " + c.x + "," + c.y + " C" + c2.x + "," + c2.y + " " + c2.x + "," + c2.y + " " + t.x + "," + t.y;
    } else {
      s = exit(a, c);
      t = exit(b, c);
      m = midpoint(c, midpoint(s, t));
      d = {
        x: c.x - m.x,
        y: c.y - m.y
      };
      sm = midpoint(s, m);
      tm = midpoint(t, m);
      i = sc = {
        x: sm.x + d.x,
        y: sm.y + d.y
      };
      j = tc = {
        x: tm.x + d.x,
        y: tm.y + d.y
      };
      return "M" + s.x + "," + s.y + " S" + i.x + "," + i.y + " " + c.x + "," + c.y + " S" + j.x + "," + j.y + " " + t.x + "," + t.y;
    }
  };

  findTransition = function(transitions, source, target) {
    var tr, _i, _len;
    for (_i = 0, _len = transitions.length; _i < _len; _i++) {
      tr = transitions[_i];
      if (tr.a.id === source && tr.b.id === target) {
        return tr;
      }
    }
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
        children.push({
          id: transition.id,
          desmTransition: true,
          width: transition.textWidth,
          height: 25
        });
        edges.push({
          id: "" + transition.id + "#1",
          source: child.id,
          target: transition.id
        });
        edges.push({
          id: "" + transition.id + "#2",
          source: transition.id,
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

  force.kielerLayout = function(kielerAlgorithm, top) {
    var applyLayout, form, graph, kNodeMap, klay_ready, layoutDone;
    kNodeMap = d3.map();
    applyLayout = function(node, kNode, x0, y0) {
      var child, childMap, kChild, kTr, tr, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _results;
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
      node.x = x0 + (kNode.x || 0) + node.w / 2;
      node.y = y0 + (kNode.y || 0) + node.h / 2;
      _ref = node.transitions || [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        tr = _ref[_i];
        kTr = kNodeMap.get(tr.id);
        tr.x = x0 + kTr.x + kTr.width / 2;
        tr.y = y0 + kTr.y + kTr.height / 2;
      }
      childMap = d3.map();
      _ref1 = node.children || [];
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        child = _ref1[_j];
        if (child.id != null) {
          childMap.set(child.id, child);
        }
      }
      _ref2 = kNode.children || [];
      _results = [];
      for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
        kChild = _ref2[_k];
        if ((child = childMap.get(kChild.id)) == null) {
          continue;
        }
        if (!kChild.desmTransition) {
          _results.push(applyLayout(child, kChild, node.x - node.w / 2, node.y - node.h / 2));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };
    graph = toKielerFormat(top);
    if (kielerAlgorithm === '__klayjs') {
      klay_ready = Q.defer();
      $klay.layout({
        graph: graph,
        options: {
          layoutHierarchy: true,
          edgeRouting: 'ORTHOGONAL'
        },
        success: klay_ready.resolve,
        error: function(err) {
          return klay_ready.reject(new Error(err.text));
        }
      });
      layoutDone = klay_ready.promise;
    } else {
      form = {
        graph: JSON.stringify(graph),
        config: JSON.stringify({
          algorithm: kielerAlgorithm,
          edgeRouting: 'ORTHOGONAL',
          layoutHierarchy: true
        }),
        iFormat: 'org.json',
        oFormat: 'org.json'
      };
      layoutDone = Q($.post(KIELER_URL, form))["catch"](function(resp) {
        throw Error(resp.responseText);
      }).then(function(resp) {
        return JSON.parse(resp)[0];
      });
    }
    return layoutDone.then(function(graphLayout) {
      walk(graphLayout, (function(_this) {
        return function(kNode) {
          return kNodeMap.set(kNode.id, kNode);
        };
      })(this));
      return applyLayout(top, graphLayout);
    });
  };

  NewNodesAnimation = (function() {
    function NewNodesAnimation(newNodes) {
      var node, _i, _len, _ref;
      this.newNodes = newNodes;
      this.deferred = Q.defer();
      this.promise = this.deferred.promise;
      this.done = false;
      this.targetMap = d3.map();
      if (!(this.newNodes.length > 0)) {
        this.abort();
      }
      _ref = this.newNodes;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        node = _ref[_i];
        this.targetMap.set(node.id, {
          w: node.w,
          h: node.h
        });
        node.w = node.h = 5;
      }
    }

    NewNodesAnimation.prototype.tick = function() {
      var changed, node, target, _i, _len, _ref;
      if (this.done) {
        return;
      }
      changed = false;
      _ref = this.newNodes;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        node = _ref[_i];
        target = this.targetMap.get(node.id);
        if (node.w < target.w) {
          node.w += ANIMATION_SPEED;
          changed = true;
        }
        if (node.h < target.h) {
          node.h += ANIMATION_SPEED;
          changed = true;
        }
      }
      if (!changed) {
        return this.abort();
      }
    };

    NewNodesAnimation.prototype.abort = function() {
      this.done = true;
      return this.deferred.resolve();
    };

    return NewNodesAnimation;

  })();

  LoadingOverlay = (function() {
    function LoadingOverlay(options) {
      var h, w;
      w = $(options.svg).width();
      h = $(options.svg).height();
      this.el = d3.select(options.svg).append('g').attr('class', "loadingOverlay");
      this.el.append('rect').attr('width', w).attr('height', h);
      this.el.append('text').attr('x', w / 2).attr('y', h / 2).text(options.text);
    }

    LoadingOverlay.prototype.destroy = function() {
      return this.el.remove();
    };

    return LoadingOverlay;

  })();

  force.Layout = (function() {
    function Layout(options) {
      this.id = nextId();
      this.queue = async.queue((function(task, cb) {
        return task(cb);
      }), 1);
      this.options = options;
      this.debug = options.debug || false;
      this.svgCreate(options.parent);
      this.runSimulation = false;
      this.s = this._emptyState();
      this.animation = new NewNodesAnimation([]);
      this._initialTree(options.tree || treeFromXml(options.doc).sc);
    }

    Layout.prototype._initialTree = function(tree) {
      var deferred;
      deferred = Q.defer();
      this.initialized = deferred.promise;
      return this.queue.push((function(_this) {
        return function(cb) {
          var loading;
          _this.loadTree(tree);
          if (_this.options.geometry != null) {
            _this.applyGeometry(_this.options.geometry);
            _this.beginSimulation();
            cb();
            return deferred.resolve();
          } else {
            loading = new LoadingOverlay({
              svg: _this.el,
              text: "Loading Kieler layout ..."
            });
            return deferred.resolve(force.kielerLayout(_this.options.kielerAlgorithm, _this.s.top).then(function(treeWithLayout) {
              loading.destroy();
              _this.beginSimulation();
              return cb();
            }));
          }
        };
      })(this));
    };

    Layout.prototype.update = function(doc) {
      var deferred;
      deferred = Q.defer();
      this.queue.push((function(_this) {
        return function(cb) {
          return deferred.resolve(Q().then(function() {
            return _this.loadTree(treeFromXml(doc).sc);
          }).then(function() {
            _this.beginSimulation();
            if (!_this.runSimulation) {
              return _this.s.newNodes = [];
            }
          }).then(function() {
            _this.animation = new NewNodesAnimation(_this.s.newNodes);
            return _this.animation.promise;
          })["catch"](function(e) {
            return console.error(e);
          })["finally"](function() {
            return cb();
          }));
        };
      })(this));
      return deferred.promise;
    };

    Layout.prototype._emptyState = function() {
      return {
        nodes: [],
        cells: [],
        nodeMap: d3.map(),
        links: [],
        transitions: [],
        top: {
          children: [],
          controls: []
        },
        newNodes: [],
        dom: d3.map()
      };
    };

    Layout.prototype.loadTree = function(tree) {
      this.mergeTree(tree);
      return this.svgNodes();
    };

    Layout.prototype.beginSimulation = function() {
      this.setupD3Layout();
      this.layout.on('tick', (function(_this) {
        return function() {
          _this.adjustLayout();
          _this.svgUpdate();
          return _this.animation.tick();
        };
      })(this));
      return this.svgUpdate();
    };

    Layout.prototype.mergeTree = function(tree) {
      var makeId, newS, oldS, topNode, _i, _j, _len, _len1;
      oldS = this.s;
      newS = this._emptyState();
      newS.top.children = tree;
      makeId = idMaker();
      for (_i = 0, _len = tree.length; _i < _len; _i++) {
        topNode = tree[_i];
        walk(topNode, (function(_this) {
          return function(node, parent) {
            var oldNode;
            if (node.id) {
              node.label = node.id;
            } else {
              node.id = makeId("_node_");
              node.label = "<" + node.type + ">";
            }
            node.controls = [];
            node.children = node.children || [];
            if ((oldNode = oldS.nodeMap.get(node.id)) != null) {
              node.x = oldNode.x;
              node.y = oldNode.y;
              node.w = oldNode.w;
              node.h = oldNode.h;
            } else {
              node.w = CELL_MIN.w;
              node.h = CELL_MIN.h;
              if (parent != null) {
                node.x = parent.x;
                node.y = parent.y;
              }
              newS.newNodes.push(node);
            }
            newS.nodes.push(node);
            newS.cells.push(node);
            newS.nodeMap.set(node.id, node);
            return node.parent = parent != null ? newS.nodeMap.get(parent.id) : newS.top;
          };
        })(this));
      }
      for (_j = 0, _len1 = tree.length; _j < _len1; _j++) {
        topNode = tree[_j];
        walk(topNode, (function(_this) {
          return function(node) {
            var a, b, c, label, link_source, link_target, oldTr, target, tr, _k, _l, _len2, _len3, _ref, _ref1, _ref2, _ref3, _results;
            _ref = node.transitions || [];
            _results = [];
            for (_k = 0, _len2 = _ref.length; _k < _len2; _k++) {
              tr = _ref[_k];
              if ((target = newS.nodeMap.get(tr.target)) == null) {
                throw Error("missing transition target: " + tr.target);
              }
              _ref1 = path(node, target), a = _ref1[0], c = _ref1[1], b = _ref1[2];
              tr.parent = c || newS.top;
              tr.w = CONTROL_SIZE.w;
              tr.h = CONTROL_SIZE.h;
              tr.id = tr.id || makeId("_transition/" + node.id + "/" + target.id + "/");
              newS.nodeMap.set(tr.id, tr);
              tr.parent.controls.push(tr);
              newS.nodes.push(tr);
              _ref2 = d3.pairs([a, tr, b]);
              for (_l = 0, _len3 = _ref2.length; _l < _len3; _l++) {
                _ref3 = _ref2[_l], link_source = _ref3[0], link_target = _ref3[1];
                newS.links.push({
                  source: link_source,
                  target: link_target
                });
              }
              label = tr.event || '';
              tr.a = a;
              tr.b = b;
              tr.selfie = node.id === tr.target;
              tr.label = label;
              newS.transitions.push(tr);
              if ((oldTr = findTransition(oldS.transitions, tr.a.id, tr.b.id)) != null) {
                _results.push(_.extend(tr, {
                  x: oldTr.x,
                  y: oldTr.y
                }));
              } else {
                _results.push(_.extend(tr, midpoint(tr.a, tr.b)));
              }
            }
            return _results;
          };
        })(this));
      }
      if (this.layout) {
        this.layout.stop();
      }
      return this.s = newS;
    };

    Layout.prototype.saveGeometry = function() {
      var n, round;
      round = function(x) {
        return Math.round(x);
      };
      return JSON.stringify({
        nodes: (function() {
          var _i, _len, _ref, _results;
          _ref = this.s.nodes;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            n = _ref[_i];
            _results.push({
              id: n.id,
              w: round(n.w),
              h: round(n.h),
              x: round(n.x),
              y: round(n.y)
            });
          }
          return _results;
        }).call(this)
      });
    };

    Layout.prototype.applyGeometry = function(geom) {
      var node, saved, _i, _len, _ref;
      _ref = JSON.parse(geom).nodes;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        saved = _ref[_i];
        if ((node = this.s.nodeMap.get(saved.id)) != null) {
          node.w = saved.w;
          node.h = saved.h;
          node.px = node.x = saved.x;
          node.py = node.y = saved.y;
        }
      }
      this.svgUpdate();
      if (this.layout && this.runSimulation) {
        return this.layout.start();
      }
    };

    Layout.prototype.svgCreate = function(parent) {
      var defs, svg;
      this.zoomBehavior = d3.behavior.zoom().scaleExtent([MIN_ZOOM, MAX_ZOOM]);
      svg = d3.select(parent).append('svg').attr('xmlns:xmlns:xlink', 'http://www.w3.org/1999/xlink').classed('force-layout', true).classed('debug', this.debug);
      this.el = svg[0][0];
      defs = svg.append('defs');
      this.zoomNode = svg.append('g').call(this.zoomBehavior);
      this.container = this.zoomNode.append('g');
      this.container.append('rect').attr('class', 'zoomRect');
      this.zoomBehavior.on('zoom', (function(_this) {
        return function() {
          var e;
          e = d3.event;
          return _this.container.attr('transform', "translate(" + e.translate + "),scale(" + e.scale + ")");
        };
      })(this));
      defs.append('marker').attr('id', "" + this.id + "-arrow").attr('refX', '7').attr('refY', '5').attr('markerWidth', '10').attr('markerHeight', '10').attr('orient', 'auto').append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z').attr('class', 'arrow');
      return this.invalidateSize();
    };

    Layout.prototype.invalidateSize = function() {
      var $parent, height, width;
      $parent = $(this.el).parent();
      width = $parent.width() - 5;
      height = $parent.height() - 5;
      d3.select(this.el).attr('width', width).attr('height', height);
      this.container.select('.zoomRect').attr('width', width / MIN_ZOOM).attr('height', height / MIN_ZOOM).attr('x', -width / 2 / MIN_ZOOM).attr('y', -height / 2 / MIN_ZOOM);
      this.zoomBehavior.size([width, height]).translate([width / 2, height / 2]);
      return this.zoomBehavior.event(this.zoomNode);
    };

    Layout.prototype.svgNodes = function() {
      var cell, dom, transitionLabel;
      this.container.selectAll('.cell').remove();
      this.container.selectAll('.transition').remove();
      this.container.selectAll('.transition-label').remove();
      cell = this.container.selectAll('.cell').data(this.s.cells).enter().append('g').attr('class', function(cell) {
        return "cell cell-" + (cell.type || 'state') + " draggable";
      }).classed('parallel-child', function(cell) {
        return cell.parent.type === 'parallel';
      });
      cell.append('rect').attr('class', 'border').attr('rx', ROUND_CORNER).attr('ry', ROUND_CORNER);
      cell.append('text').text(function(node) {
        return node.label;
      }).each(function(node) {
        node.textWidth = d3.min([$(this).width() + 2 * ROUND_CORNER, LABEL_SPACE]);
        return node.w = d3.max([node.w, node.textWidth]);
      });
      this.container.selectAll('.transition').data(this.s.transitions).enter().append('g').attr('class', 'transition').append('path').attr('style', "marker-end: url(#" + this.id + "-arrow)").attr('id', (function(_this) {
        return function(tr) {
          return "" + _this.id + "-transition/" + tr.id;
        };
      })(this));
      transitionLabel = this.container.selectAll('.transition-label').data(this.s.transitions).enter().append('g').attr('class', 'transition-label draggable');
      if (this.options.textOnPath) {
        transitionLabel.append('text').append('textPath').attr('xlink:href', (function(_this) {
          return function(tr) {
            return "#" + _this.id + "-transition/" + tr.id;
          };
        })(this)).attr('startOffset', '50%').text(function(tr) {
          return tr.label;
        });
      } else {
        transitionLabel.append('text').text(function(tr) {
          return tr.label;
        }).each(function(tr) {
          tr.textWidth = d3.min([$(this).width() + 5, LABEL_SPACE]);
          return tr.w = d3.max([tr.w, tr.textWidth]);
        }).attr('dy', '.3em');
        transitionLabel.append('rect').attr('x', function(tr) {
          return -tr.w / 2;
        }).attr('y', function(tr) {
          return -tr.h / 2;
        }).attr('width', function(tr) {
          return tr.w;
        }).attr('height', function(tr) {
          return tr.h;
        });
      }
      dom = this.s.dom;
      this.container.selectAll('.cell').each(function(node) {
        return dom.set("cell-" + node.id, this);
      });
      return this.container.selectAll('.transition').each(function(node) {
        return dom.set("transition-" + node.id, this);
      });
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
      this.container.selectAll('.transition').selectAll('path').attr('d', transitionPath);
      if (!this.options.textOnPath) {
        return this.container.selectAll('.transition-label').attr('transform', function(tr) {
          return "translate(" + tr.x + "," + tr.y + ")";
        });
      }
    };

    Layout.prototype.setupD3Layout = function() {
      var drag, lock;
      this.layout = d3.layout.force().charge(0).gravity(0).linkStrength(LINK_STRENGTH).linkDistance(LINK_DISTANCE).nodes(this.s.nodes).links(this.s.links).start();
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
      return this.container.selectAll('.draggable').on('mouseover', (function(_this) {
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
        forces: d3.map()
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
      _ref = this.s.top.children;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        node = _ref[_i];
        walk(node, adjustNode, null, true);
      }
      handleCollisions(this.s.top, {
        x: 0,
        y: 0
      }, tick);
      if (this.debug) {
        this.container.selectAll('.cell .force').remove();
        return this.container.selectAll('.cell').each(function(node) {
          var _j, _len1, _ref1, _results;
          _ref1 = tick.forces.get(node.id) || [];
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
      return this.queue.push((function(_this) {
        return function(cb) {
          d3.select(_this.s.dom.get("cell-" + id)).classed('highlight', highlight);
          return cb();
        };
      })(this));
    };

    Layout.prototype.highlightTransition = function(source, target, highlight) {
      if (highlight == null) {
        highlight = true;
      }
      return this.queue.push((function(_this) {
        return function(cb) {
          var tr;
          if ((tr = findTransition(_this.s.transitions, source, target)) != null) {
            d3.select(_this.s.dom.get("transition-" + tr.id)).classed('highlight', highlight);
          }
          return cb();
        };
      })(this));
    };

    return Layout;

  })();

  force.render = function(options) {
    return new force.Layout(options);
  };

}).call(this);

//# sourceMappingURL=forceLayout.js.map