(function() {
  var ANIMATION_SPEED, CELL_MIN, CELL_PAD, DEBUG_FORCE_FACTOR, EXPORT_PAD, GEOMETRY_VERSION, KIELER_URL, LABEL_SPACE, LINK_DISTANCE, LINK_STRENGTH, LoadingOverlay, MARGIN, MAX_ZOOM, MIN_ZOOM, NewNodesAnimation, ROUND_CORNER, actionBlockSvg, actionSvg, applyKielerLayout, envelope, findTransition, force, idMaker, kielerLayout, midpoint, nextId, parents, path, strip, toKielerFormat, treeFromXml, walk;

  force = window.forceLayout = {};

  KIELER_URL = 'http://kieler.herokuapp.com/live';

  MARGIN = 5;

  ROUND_CORNER = 5;

  CELL_MIN = {
    w: 15,
    h: 15
  };

  CELL_PAD = {
    top: 12,
    bottom: 12,
    left: 12,
    right: 12
  };

  EXPORT_PAD = {
    top: 10,
    bottom: 10,
    left: 10,
    right: 10
  };

  LABEL_SPACE = 400;

  LINK_STRENGTH = .1;

  LINK_DISTANCE = 30;

  DEBUG_FORCE_FACTOR = 50;

  MIN_ZOOM = 1 / 6;

  MAX_ZOOM = 6;

  ANIMATION_SPEED = 2;

  GEOMETRY_VERSION = 2;

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
            label: "<" + child.tagName + ">"
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

  midpoint = function(a, b) {
    return {
      x: ((a.x || 0) + (b.x || 0)) / 2,
      y: ((a.y || 0) + (b.y || 0)) / 2
    };
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

  envelope = function(node, pad) {
    var box, point, tr, xValues, yValues, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2;
    if (pad == null) {
      pad = {};
    }
    xValues = [];
    yValues = [];
    _ref = [].concat(node.children, node.controls);
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      box = _ref[_i];
      xValues.push(box.x - box.w / 2);
      xValues.push(box.x + box.w / 2);
      yValues.push(box.y - box.h / 2);
      yValues.push(box.y + box.h / 2);
    }
    _ref1 = node.controls;
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      tr = _ref1[_j];
      _ref2 = [].concat(tr.route.segment1, tr.route.segment2);
      for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
        point = _ref2[_k];
        xValues.push(point[0]);
        yValues.push(point[1]);
      }
    }
    return [d3.min(xValues) - (pad.left || 0), d3.max(xValues) + (pad.right || 0), d3.min(yValues) - (pad.top || 0) - (node.topPadding || 0), d3.max(yValues) + (pad.bottom || 0)];
  };

  actionSvg = function(options) {
    var actionR, actionT, h, w;
    actionR = options.g.append('rect');
    actionT = options.g.append('text').text(options.action.label).attr('y', 12);
    actionR.attr('height', h = $(actionT[0][0]).height()).attr('width', w = $(actionT[0][0]).width() + 10).attr('x', -w / 2).attr('rx', 10).attr('ry', 10);
    return [w, h];
  };

  actionBlockSvg = function(actions, parentG) {
    var action, actionG, h, maxw, w, y, _i, _len, _ref;
    y = 0;
    maxw = 0;
    for (_i = 0, _len = actions.length; _i < _len; _i++) {
      action = actions[_i];
      actionG = parentG.append('g').attr('class', 'action').attr('transform', "translate(0," + y + ")");
      _ref = actionSvg({
        action: action,
        g: actionG
      }), w = _ref[0], h = _ref[1];
      y += h;
      maxw = d3.max([maxw, w]);
    }
    return [maxw, y];
  };

  toKielerFormat = function(node) {
    var child, children, edges, node_header, rv, tr, _i, _j, _len, _len1, _ref, _ref1;
    children = [];
    edges = [];
    _ref = node.children || [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      child = _ref[_i];
      children.push(toKielerFormat(child));
    }
    _ref1 = node.controls || [];
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      tr = _ref1[_j];
      children.push({
        id: tr.id,
        desmTransition: true,
        width: tr.w,
        height: tr.h,
        ports: [
          {
            id: "" + tr.id + "#enter",
            x: 0,
            y: tr.yPort
          }, {
            id: "" + tr.id + "#exit",
            x: tr.w,
            y: tr.yPort
          }
        ],
        properties: {
          portConstraints: 'FIXED_POS'
        }
      });
      edges.push({
        id: "" + tr.id + "#1",
        source: tr.a.id,
        target: tr.id,
        targetPort: "" + tr.id + "#enter"
      });
      edges.push({
        id: "" + tr.id + "#2",
        source: tr.id,
        target: tr.b.id,
        sourcePort: "" + tr.id + "#exit"
      });
    }
    node_header = node.header || CELL_MIN;
    rv = {
      id: node.id,
      children: children,
      edges: edges,
      padding: {
        top: node_header.h || 0
      },
      width: node_header.w + 10,
      height: node_header.h + 10
    };
    return rv;
  };

  applyKielerLayout = function(options) {
    var graph, kEdgeMap, kNodeMap, offsetMap, s, traverse;
    s = options.s;
    graph = options.graph;
    kNodeMap = d3.map();
    kEdgeMap = d3.map();
    offsetMap = d3.map();
    offsetMap.set('__ROOT__', {
      x: -graph.width / 2,
      y: -graph.height / 2
    });
    walk(graph, (function(_this) {
      return function(kNode) {
        var kChild, kEdge, offset, padding, _i, _j, _len, _len1, _ref, _ref1, _results;
        kNodeMap.set(kNode.id, kNode);
        offset = offsetMap.get(kNode.id);
        padding = _.extend({
          top: 0,
          left: 0
        }, kNode.padding);
        _ref = kNode.children || [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          kChild = _ref[_i];
          offsetMap.set(kChild.id, {
            x: offset.x + (kNode.x || 0) + (padding.left || 0),
            y: offset.y + (kNode.y || 0) + (padding.top || 0)
          });
        }
        _ref1 = kNode.edges || [];
        _results = [];
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          kEdge = _ref1[_j];
          _results.push(kEdgeMap.set(kEdge.id, kEdge));
        }
        return _results;
      };
    })(this));
    traverse = function(kNode) {
      var e1, e2, kChild, kTr, node, offset, offset1, offset2, tr, translate1, translate2, _i, _len, _ref, _results;
      if (kNode.desmTransition) {
        tr = s.nodeMap.get(kNode.id);
        offset1 = offsetMap.get(tr.a.id);
        offset2 = offsetMap.get(tr.id);
        kTr = kNodeMap.get(tr.id);
        tr.x = offset2.x + kTr.x + kTr.width / 2;
        tr.y = offset2.y + kTr.y + kTr.height / 2;
        e1 = kEdgeMap.get("" + tr.id + "#1");
        e2 = kEdgeMap.get("" + tr.id + "#2");
        translate1 = function(d) {
          return [offset1.x + d.x, offset1.y + d.y];
        };
        translate2 = function(d) {
          return [offset2.x + d.x, offset2.y + d.y];
        };
        tr.route = {
          src: translate1(e1.sourcePoint),
          segment1: (e1.bendPoints || []).map(translate1),
          label1: translate1(e1.targetPoint),
          label2: translate2(e2.sourcePoint),
          segment2: (e2.bendPoints || []).map(translate2),
          dst: translate2(e2.targetPoint)
        };
      } else if (kNode.id !== '__ROOT__') {
        node = s.nodeMap.get(kNode.id);
        offset = offsetMap.get(kNode.id);
        node.w = kNode.width;
        node.h = kNode.height;
        node.x = offset.x + (kNode.x || 0) + node.w / 2;
        node.y = offset.y + (kNode.y || 0) + node.h / 2;
      }
      _ref = kNode.children || [];
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        kChild = _ref[_i];
        _results.push(traverse(kChild));
      }
      return _results;
    };
    return traverse(graph);
  };

  kielerLayout = function(s, options) {
    var algorithm, form, graph, klay_ready, layoutDone, top;
    algorithm = options.algorithm || '__klayjs';
    top = s.top;
    graph = toKielerFormat(top);
    if (algorithm === '__klayjs') {
      klay_ready = Q.defer();
      $klay.layout({
        graph: graph,
        options: {
          layoutHierarchy: true,
          edgeRouting: 'ORTHOGONAL',
          feedBackEdges: true
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
          algorithm: algorithm,
          edgeRouting: 'ORTHOGONAL',
          feedBackEdges: true,
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
    return layoutDone;
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
          var e, loading;
          try {
            _this.loadTree(tree);
            if (_this.options.geometry != null) {
              _this.applyGeometry(_this.options.geometry);
              _this.svgUpdate();
              cb();
              return deferred.resolve();
            } else {
              loading = new LoadingOverlay({
                svg: _this.el,
                text: "Loading Kieler layout ..."
              });
              return deferred.resolve(kielerLayout(_this.s, {
                algorithm: _this.options.kielerAlgorithm
              }).then(function(graph) {
                return applyKielerLayout({
                  s: _this.s,
                  graph: graph
                });
              }).then(function() {
                loading.destroy();
                _this.svgUpdate();
                return cb();
              }));
            }
          } catch (_error) {
            e = _error;
            deferred.reject(e);
            return cb();
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
            _this.loadTree(treeFromXml(doc).sc);
            return kielerLayout(_this.s, {
              algorithm: _this.options.kielerAlgorithm
            });
          }).then(function(graph) {
            return applyKielerLayout({
              s: _this.s,
              graph: graph
            });
          }).then(function() {
            return _this.svgUpdate({
              animate: true
            });
          })["catch"](function(e) {
            return console.error(e.stack);
          })["finally"](function() {
            return cb();
          }));
        };
      })(this));
      return deferred.promise;
    };

    Layout.prototype._emptyState = function() {
      var s;
      s = {
        nodes: [],
        cells: [],
        nodeMap: d3.map(),
        links: [],
        transitions: [],
        top: {
          id: '__ROOT__',
          children: [],
          controls: []
        },
        newNodes: [],
        dom: d3.map()
      };
      s.nodeMap.set(s.top.id, s.top);
      return s;
    };

    Layout.prototype.loadTree = function(tree) {
      this.mergeTree(tree);
      this.svgNodes();
      return this.registerMouseHandlers();
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
              node.header = oldNode.header;
            } else {
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
              tr.id = tr.id || makeId("_transition/" + node.id + "/" + target.id + "/");
              if ((oldTr = oldS.nodeMap.get(tr.id)) != null) {
                tr.w = oldTr.w;
                tr.h = oldTr.h;
                tr.yPort = oldTr.yPort;
              } else {
                tr.w = 0;
                tr.h = 0;
                tr.yPort = 0;
              }
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
      return this.s = newS;
    };

    Layout.prototype.saveGeometry = function() {
      var n, round, tr;
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
        }).call(this),
        transitions: (function() {
          var _i, _len, _ref, _results;
          _ref = this.s.transitions;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            tr = _ref[_i];
            _results.push({
              id: tr.id,
              route: tr.route
            });
          }
          return _results;
        }).call(this),
        version: GEOMETRY_VERSION
      });
    };

    Layout.prototype.applyGeometry = function(geom_json) {
      var geom, node, saved, tr, _i, _j, _len, _len1, _ref, _ref1;
      geom = JSON.parse(geom_json);
      if (geom.version !== GEOMETRY_VERSION) {
        return;
      }
      _ref = geom.nodes;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        saved = _ref[_i];
        if ((node = this.s.nodeMap.get(saved.id)) != null) {
          node.w = saved.w;
          node.h = saved.h;
        }
      }
      _ref1 = geom.transitions || [];
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        saved = _ref1[_j];
        if ((tr = this.s.nodeMap.get(saved.id)) != null) {
          tr.route = saved.route;
        }
      }
      return this.svgUpdate();
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
      var cellUpdate, dom, newCell, transitionLabelUpdate, transitionUpdate;
      cellUpdate = this.container.selectAll('.cell').data(this.s.cells, function(d) {
        return d.id;
      });
      newCell = cellUpdate.enter().append('g').attr('class', function(cell) {
        return "cell cell-" + (cell.type || 'state') + " draggable";
      }).classed('parallel-child', function(cell) {
        return cell.parent.type === 'parallel';
      });
      newCell.append('rect').attr('class', 'border').attr('rx', ROUND_CORNER).attr('ry', ROUND_CORNER);
      newCell.append('g').attr('class', 'cell-header');
      cellUpdate.each(function(node) {
        var h, hEntry, hExit, header, label, labelTextWidth, onentry, onexit, w, wEntry, wExit, wLabel, _ref, _ref1;
        header = d3.select(this).select('.cell-header');
        header.selectAll('*').remove();
        label = header.append('text').text(function(node) {
          return node.label;
        }).attr('y', 12);
        labelTextWidth = $(label[0][0]).width();
        wLabel = d3.min([labelTextWidth + 2 * ROUND_CORNER, LABEL_SPACE]);
        node.textWidth = wLabel;
        onentry = header.append('g');
        onexit = header.append('g');
        _ref = actionBlockSvg(node.onentry || [], onentry), wEntry = _ref[0], hEntry = _ref[1];
        _ref1 = actionBlockSvg(node.onexit || [], onexit), wExit = _ref1[0], hExit = _ref1[1];
        w = wEntry + wLabel + wExit;
        h = d3.max([16, hEntry, hExit]);
        label.attr('x', wEntry + wLabel / 2 - w / 2);
        onentry.attr('transform', "translate(" + (wEntry / 2 - w / 2) + ",0)");
        onexit.attr('transform', "translate(" + (w / 2 - wExit / 2) + ",0)");
        return node.header = {
          w: w,
          h: h
        };
      });
      cellUpdate.exit().remove();
      transitionUpdate = this.container.selectAll('.transition').data(this.s.transitions, function(d) {
        return d.id;
      });
      transitionUpdate.enter().append('g').attr('class', 'transition').append('path').attr('style', "marker-end: url(#" + this.id + "-arrow)").attr('id', (function(_this) {
        return function(tr) {
          return "" + _this.id + "-transition/" + tr.id;
        };
      })(this));
      transitionUpdate.exit().remove();
      transitionLabelUpdate = this.container.selectAll('.transition-label').data(this.s.transitions, function(d) {
        return d.id;
      });
      transitionLabelUpdate.enter().append('g').attr('class', 'transition-label draggable').append('g').attr('class', 'transition-label-offset');
      transitionLabelUpdate.each(function(tr) {
        var actionBlockG, h, offsetG, transitionRect, transitionText, w, y, _ref;
        offsetG = d3.select(this).select('.transition-label-offset');
        offsetG.selectAll('*').remove();
        transitionRect = offsetG.append('rect');
        transitionText = offsetG.append('text').attr('y', 16);
        transitionText.append('tspan').text(tr.label);
        if (tr.cond != null) {
          transitionText.append('tspan').text("[" + tr.cond + "]").attr('x', 0).attr('dy', 16);
          y += 16;
        }
        y = $(transitionText[0][0]).height() + 4;
        tr.yPort = y - 2;
        actionBlockG = offsetG.append('g').attr('transform', "translate(0," + y + ")");
        _ref = actionBlockSvg(tr.actions || [], actionBlockG), w = _ref[0], h = _ref[1];
        y += h;
        tr.textWidth = d3.min([$(transitionText[0][0]).width() + 5, LABEL_SPACE]);
        tr.w = d3.max([tr.w, tr.textWidth, w]);
        tr.h = y + 4;
        offsetG.attr('transform', "translate(0," + (-tr.h / 2) + ")");
        return transitionRect.attr('x', function(tr) {
          return -tr.w / 2;
        }).attr('width', function(tr) {
          return tr.w;
        }).attr('height', function(tr) {
          return tr.h;
        });
      });
      transitionLabelUpdate.exit().remove();
      dom = this.s.dom;
      this.container.selectAll('.cell').each(function(node) {
        return dom.set("cell-" + node.id, this);
      });
      return this.container.selectAll('.transition').each(function(node) {
        return dom.set("transition-" + node.id, this);
      });
    };

    Layout.prototype.svgUpdate = function(options) {
      var duration;
      options = _.extend({
        animate: false
      }, options);
      duration = options.animate ? 250 : 0;
      this.container.selectAll('.cell').classed('fixed', function(node) {
        return node.fixed;
      }).transition().duration(duration).attr('transform', function(node) {
        return "translate(" + node.x + "," + node.y + ")";
      });
      this.container.selectAll('.cell').each(function(node) {
        d3.select(this).select('rect').transition().duration(duration).attr('x', -node.w / 2).attr('y', -node.h / 2).attr('width', node.w).attr('height', node.h);
        return d3.select(this).select('.cell-header').transition().duration(duration).attr('transform', function(node) {
          return "translate(0," + (5 - node.h / 2) + ")";
        });
      });
      this.container.selectAll('.transition').select('path').transition().duration(duration).attr('d', function(tr) {
        return d3.svg.line()([].concat([tr.route.src], tr.route.segment1, [tr.route.label1], [tr.route.label2], tr.route.segment2, [tr.route.dst]));
      });
      return this.container.selectAll('.transition-label').transition().duration(duration).attr('transform', function(tr) {
        return "translate(" + tr.x + "," + tr.y + ")";
      });
    };

    Layout.prototype.registerMouseHandlers = function() {
      var drag, lock;
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
          _this.moveNode(node, d3.event.dx, d3.event.dy);
          _this.adjustLayout();
          return _this.svgUpdate();
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

    Layout.prototype.moveNode = function(node, dx, dy) {
      var child, control, tr, translate, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _results;
      node.x += dx;
      node.y += dy;
      translate = function(p, dx, dy) {
        p[0] += dx;
        return p[1] += dy;
      };
      if (node.route != null) {
        translate(node.route.label1, dx, dy);
        translate(node.route.label2, dx, dy);
      } else {
        _ref = this.s.transitions;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          tr = _ref[_i];
          if (tr.a.id === node.id) {
            translate(tr.route.src, dx, dy);
          }
          if (tr.b.id === node.id) {
            translate(tr.route.dst, dx, dy);
          }
        }
      }
      _ref1 = node.children || [];
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        child = _ref1[_j];
        this.moveNode(child, dx, dy);
      }
      _ref2 = node.controls || [];
      _results = [];
      for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
        control = _ref2[_k];
        _results.push(this.moveNode(control, dx, dy));
      }
      return _results;
    };

    Layout.prototype.adjustLayout = function() {
      var adjustNode, handleCollisions, node, _i, _len, _ref;
      handleCollisions = (function(_this) {
        return function(parent, center) {
          var collide, node, nx1, nx2, ny1, ny2, objects, q, _i, _len, _results;
          objects = [].concat(parent.children, parent.controls);
          q = d3.geom.quadtree(objects);
          _results = [];
          for (_i = 0, _len = objects.length; _i < _len; _i++) {
            node = objects[_i];
            nx1 = node.x - node.w - 100;
            nx2 = node.x + node.w + 100;
            ny1 = node.y - node.h - 100;
            ny2 = node.y + node.h + 100;
            collide = function(quad, x1, y1, x2, y2) {
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
                  _this.moveNode(node, dx1, dy1);
                  _this.moveNode(other, dx2, dy2);
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
          var dx, dy, grow, xMax, xMin, yMax, yMin, _ref;
          if (node.children.length > 0) {
            handleCollisions(node, node);
            _ref = envelope(node, CELL_PAD), xMin = _ref[0], xMax = _ref[1], yMin = _ref[2], yMax = _ref[3];
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
              _this.moveNode(node, -dx, -dy);
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
      return handleCollisions(this.s.top, {
        x: 0,
        y: 0
      });
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

    Layout.prototype.fit = function() {
      return this.queue.push((function(_this) {
        return function(cb) {
          var h, scale, w, xMax, xMin, yMax, yMin, _ref, _ref1;
          _ref = envelope(_this.s.top, EXPORT_PAD), xMin = _ref[0], xMax = _ref[1], yMin = _ref[2], yMax = _ref[3];
          _ref1 = _this.zoomBehavior.size(), w = _ref1[0], h = _ref1[1];
          scale = d3.min([w / (xMax - xMin), h / (yMax - yMin)]);
          _this.zoomBehavior.translate([w / 2 - (xMax + xMin) * scale / 2, h / 2 - (yMax + yMin) * scale / 2]);
          _this.zoomBehavior.scale(scale);
          _this.zoomBehavior.event(_this.zoomNode);
          return cb();
        };
      })(this));
    };

    Layout.prototype.exportSvg = function(options) {
      var div, svg, xMax, xMin, yMax, yMin, _ref;
      _ref = envelope(this.s.top, EXPORT_PAD), xMin = _ref[0], xMax = _ref[1], yMin = _ref[2], yMax = _ref[3];
      div = $('<div style="positoin:relative">')[0];
      svg = d3.select(div).append('svg').attr('xmlns', 'http://www.w3.org/2000/svg').attr('viewBox', "" + xMin + " " + yMin + " " + (xMax - xMin) + " " + (yMax - yMin)).classed('force-layout', true);
      svg.append('defs').html(d3.select(this.el).select('defs').html()).append('style').html(options.css);
      svg.append('g').html(this.container.html());
      $(div).find('.zoomRect').remove();
      return div.innerHTML;
    };

    return Layout;

  })();

  force.render = function(options) {
    return new force.Layout(options);
  };

}).call(this);

//# sourceMappingURL=forceLayout.js.map