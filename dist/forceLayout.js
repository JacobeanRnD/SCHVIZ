(function() {
  var ANIMATION_SPEED, BORDER_INSET, CELL_MIN, CELL_PAD, DEBUG_FORCE_FACTOR, EXPORT_PAD, GEOMETRY_VERSION, KIELER_URL, LABEL_SPACE, LINK_DISTANCE, LINK_STRENGTH, LoadingOverlay, MARGIN, MAX_ZOOM, MIN_ZOOM, NewNodesAnimation, ROUND_CORNER, SRC_PREVIEW_LIMIT, actionBlockSvg, actionSvg, applyKielerLayout, envelope, findTransition, force, idMaker, idPath, kielerLayout, midpoint, nextId, parents, path, strip, toKielerFormat, treeFromXml, walk;

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

  BORDER_INSET = 3;

  SRC_PREVIEW_LIMIT = 40;

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
      var action, child, firstLine, i, len, ref, rv;
      rv = [];
      ref = container.childNodes;
      for (i = 0, len = ref.length; i < len; i++) {
        child = ref[i];
        if (child.tagName) {
          rv.push(action = {
            label: "<" + child.tagName + ">"
          });
          if (child.tagName === 'script') {
            firstLine = $(child).text().trim().split(/\n/)[0];
            if (firstLine.length > SRC_PREVIEW_LIMIT) {
              firstLine = firstLine.slice(0, SRC_PREVIEW_LIMIT - 4) + ' ...';
            }
            action.preview = firstLine;
          }
        }
      }
      return rv;
    };
    parseChildNodes = function(node) {
      var child, i, len, onentry, onexit, ref, target, transitions;
      transitions = [];
      onentry = [];
      onexit = [];
      ref = node.childNodes;
      for (i = 0, len = ref.length; i < len; i++) {
        child = ref[i];
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
      var i, len, ref, state, stateList;
      stateList = [];
      ref = node.childNodes;
      for (i = 0, len = ref.length; i < len; i++) {
        node = ref[i];
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
    var child, i, len, ref;
    if (parent == null) {
      parent = null;
    }
    if (postorder == null) {
      postorder = false;
    }
    if (!postorder) {
      callback(node, parent);
    }
    ref = node.children || [];
    for (i = 0, len = ref.length; i < len; i++) {
      child = ref[i];
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

  idPath = function(node) {
    return parents(node).join('/');
  };

  path = function(node1, node2) {
    var eq, i, n, parents1, parents2, ref;
    parents1 = parents(node1);
    parents2 = parents(node2);
    eq = 0;
    for (n = i = 0, ref = d3.min([parents1.length, parents2.length]) - 1; 0 <= ref ? i <= ref : i >= ref; n = 0 <= ref ? ++i : --i) {
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
    var i, len, tr;
    for (i = 0, len = transitions.length; i < len; i++) {
      tr = transitions[i];
      if (tr.a.id === source && tr.b.id === target) {
        return tr;
      }
    }
  };

  envelope = function(node, pad) {
    var box, i, j, k, len, len1, len2, point, ref, ref1, ref2, tr, xValues, yValues;
    if (pad == null) {
      pad = {};
    }
    xValues = [];
    yValues = [];
    ref = [].concat(node.children, node.controls);
    for (i = 0, len = ref.length; i < len; i++) {
      box = ref[i];
      xValues.push(box.x - box.w / 2);
      xValues.push(box.x + box.w / 2);
      yValues.push(box.y - box.h / 2);
      yValues.push(box.y + box.h / 2);
    }
    ref1 = node.controls;
    for (j = 0, len1 = ref1.length; j < len1; j++) {
      tr = ref1[j];
      ref2 = [].concat(tr.route.segment1, tr.route.segment2);
      for (k = 0, len2 = ref2.length; k < len2; k++) {
        point = ref2[k];
        xValues.push(point[0]);
        yValues.push(point[1]);
      }
    }
    return [d3.min(xValues) - (pad.left || 0), d3.max(xValues) + (pad.right || 0), d3.min(yValues) - (pad.top || 0) - (node.topPadding || 0), d3.max(yValues) + (pad.bottom || 0)];
  };

  actionSvg = function(options) {
    var actionR, actionT, bbox, h, w;
    actionR = options.g.append('rect');
    actionT = options.g.append('text').attr('y', 12);
    actionT.append('tspan').text(options.action.label);
    if (options.action.preview) {
      actionT.append('tspan').attr('x', 0).attr('dy', 16).text(options.action.preview);
    }
    bbox = actionT[0][0].getBBox();
    h = bbox.height;
    w = bbox.width + 10;
    actionR.attr('height', h).attr('width', w).attr('x', -w / 2).attr('rx', 10).attr('ry', 10);
    return [w, h];
  };

  actionBlockSvg = function(actions, parentG) {
    var action, actionG, h, i, len, maxw, ref, w, y;
    y = 0;
    maxw = 0;
    for (i = 0, len = actions.length; i < len; i++) {
      action = actions[i];
      actionG = parentG.append('g').attr('class', 'action').attr('transform', "translate(0," + y + ")");
      ref = actionSvg({
        action: action,
        g: actionG
      }), w = ref[0], h = ref[1];
      y += h;
      maxw = d3.max([maxw, w]);
    }
    return [maxw, y];
  };

  toKielerFormat = function(node) {
    var child, children, edges, i, j, len, len1, node_header, node_min_size, ref, ref1, rv, tr;
    children = [];
    edges = [];
    ref = node.children || [];
    for (i = 0, len = ref.length; i < len; i++) {
      child = ref[i];
      children.push(toKielerFormat(child));
    }
    ref1 = node.controls || [];
    for (j = 0, len1 = ref1.length; j < len1; j++) {
      tr = ref1[j];
      children.push({
        id: tr.id,
        desmTransition: true,
        width: tr.w,
        height: tr.h,
        ports: [
          {
            id: tr.id + "#enter",
            x: 0,
            y: tr.yPort
          }, {
            id: tr.id + "#exit",
            x: tr.w,
            y: tr.yPort
          }
        ],
        properties: {
          portConstraints: 'FIXED_POS'
        }
      });
      edges.push({
        id: tr.id + "#1",
        source: tr.a.id,
        target: tr.id,
        targetPort: tr.id + "#enter"
      });
      edges.push({
        id: tr.id + "#2",
        source: tr.id,
        target: tr.b.id,
        sourcePort: tr.id + "#exit"
      });
    }
    node_header = node.header || CELL_MIN;
    node_min_size = node.minSize || {
      w: 0,
      h: 0
    };
    rv = {
      id: node.id,
      children: children,
      edges: edges,
      padding: {
        top: node_header.h || 0
      },
      width: node_min_size.w,
      height: node_min_size.h,
      properties: {
        minWidth: node_min_size.w,
        minHeight: node_min_size.h,
        sizeConstraint: 'MINIMUM_SIZE'
      }
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
        var i, j, kChild, kEdge, len, len1, offset, padding, ref, ref1, results;
        kNodeMap.set(kNode.id, kNode);
        offset = offsetMap.get(kNode.id);
        padding = _.extend({
          top: 0,
          left: 0
        }, kNode.padding);
        ref = kNode.children || [];
        for (i = 0, len = ref.length; i < len; i++) {
          kChild = ref[i];
          offsetMap.set(kChild.id, {
            x: offset.x + (kNode.x || 0) + (padding.left || 0),
            y: offset.y + (kNode.y || 0) + (padding.top || 0)
          });
        }
        ref1 = kNode.edges || [];
        results = [];
        for (j = 0, len1 = ref1.length; j < len1; j++) {
          kEdge = ref1[j];
          results.push(kEdgeMap.set(kEdge.id, kEdge));
        }
        return results;
      };
    })(this));
    traverse = function(kNode) {
      var e1, e2, i, kChild, kTr, len, node, offset, offset1, offset2, ref, results, tr, translate1, translate2;
      if (kNode.desmTransition) {
        tr = s.nodeMap.get(kNode.id);
        offset1 = offsetMap.get(tr.a.id);
        offset2 = offsetMap.get(tr.id);
        kTr = kNodeMap.get(tr.id);
        tr.x = offset2.x + kTr.x + kTr.width / 2;
        tr.y = offset2.y + kTr.y + kTr.height / 2;
        e1 = kEdgeMap.get(tr.id + "#1");
        e2 = kEdgeMap.get(tr.id + "#2");
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
      ref = kNode.children || [];
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        kChild = ref[i];
        results.push(traverse(kChild));
      }
      return results;
    };
    return traverse(graph);
  };

  kielerLayout = function(s, options) {
    var algorithm, form, graph, klay_ready, layoutDone, top;
    algorithm = options.algorithm || '__klayjs';
    top = s.top;
    graph = toKielerFormat(top);
    console.log('graph ', graph);
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
      var i, len, node, ref;
      this.newNodes = newNodes;
      this.deferred = Q.defer();
      this.promise = this.deferred.promise;
      this.done = false;
      this.targetMap = d3.map();
      if (!(this.newNodes.length > 0)) {
        this.abort();
      }
      ref = this.newNodes;
      for (i = 0, len = ref.length; i < len; i++) {
        node = ref[i];
        this.targetMap.set(node.id, {
          w: node.w,
          h: node.h
        });
        node.w = node.h = 5;
      }
    }

    NewNodesAnimation.prototype.tick = function() {
      var changed, i, len, node, ref, target;
      if (this.done) {
        return;
      }
      changed = false;
      ref = this.newNodes;
      for (i = 0, len = ref.length; i < len; i++) {
        node = ref[i];
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
              return deferred.resolve(_this._kielerLayout().then(function() {
                loading.destroy();
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

    Layout.prototype._kielerLayout = function(options) {
      if (options == null) {
        options = {};
      }
      return kielerLayout(this.s, {
        algorithm: this.options.kielerAlgorithm
      }).then((function(_this) {
        return function(graph) {
          return applyKielerLayout({
            s: _this.s,
            graph: graph
          });
        };
      })(this)).then((function(_this) {
        return function() {
          return _this.svgUpdate({
            animate: options.animate
          });
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
            return _this._kielerLayout({
              animate: true
            });
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
      return this.svgNodes();
    };

    Layout.prototype.mergeTree = function(tree) {
      var i, j, len, len1, makeId, newS, oldS, topNode;
      oldS = this.s;
      newS = this._emptyState();
      newS.top.children = tree;
      makeId = idMaker();
      for (i = 0, len = tree.length; i < len; i++) {
        topNode = tree[i];
        walk(topNode, (function(_this) {
          return function(node, parent) {
            var oldNode;
            if (node.id) {
              node.label = node.id;
              node.autoId = false;
            } else {
              node.id = makeId("_node_");
              node.autoId = true;
              node.label = "<" + node.type + ">";
            }
            node.isInitial = false;
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
      for (j = 0, len1 = tree.length; j < len1; j++) {
        topNode = tree[j];
        walk(topNode, (function(_this) {
          return function(node) {
            var a, b, c, k, l, label, len2, len3, link_source, link_target, oldTr, ref, ref1, ref2, ref3, results, target, tr;
            ref = node.transitions || [];
            results = [];
            for (k = 0, len2 = ref.length; k < len2; k++) {
              tr = ref[k];
              if ((target = newS.nodeMap.get(tr.target)) == null) {
                throw Error("missing transition target: " + tr.target);
              }
              ref1 = path(node, target), a = ref1[0], c = ref1[1], b = ref1[2];
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
              ref2 = d3.pairs([a, tr, b]);
              for (l = 0, len3 = ref2.length; l < len3; l++) {
                ref3 = ref2[l], link_source = ref3[0], link_target = ref3[1];
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
                results.push(_.extend(tr, {
                  x: oldTr.x,
                  y: oldTr.y
                }));
              } else {
                results.push(_.extend(tr, midpoint(tr.a, tr.b)));
              }
            }
            return results;
          };
        })(this));
      }
      walk({
        children: tree
      }, (function(_this) {
        return function(node) {
          var child, first, k, len2, ref;
          if (!node.children.length) {
            return;
          }
          ref = node.children;
          for (k = 0, len2 = ref.length; k < len2; k++) {
            child = ref[k];
            if (child.type === 'initial') {
              child.isInitial = true;
              return;
            }
            if (child.id === '@initial' && !child.children.length) {
              child.isInitial = true;
              return;
            }
          }
          first = node.children[0];
          if (first.autoId && first.children.length === 0) {
            return first.isInitial = true;
          }
        };
      })(this));
      return this.s = newS;
    };

    Layout.prototype.saveGeometry = function() {
      var n, round, tr;
      round = function(x) {
        return Math.round(x);
      };
      return JSON.stringify({
        nodes: (function() {
          var i, len, ref, results;
          ref = this.s.nodes;
          results = [];
          for (i = 0, len = ref.length; i < len; i++) {
            n = ref[i];
            results.push({
              id: n.id,
              w: round(n.w),
              h: round(n.h),
              x: round(n.x),
              y: round(n.y)
            });
          }
          return results;
        }).call(this),
        transitions: (function() {
          var i, len, ref, results;
          ref = this.s.transitions;
          results = [];
          for (i = 0, len = ref.length; i < len; i++) {
            tr = ref[i];
            results.push({
              id: tr.id,
              route: tr.route
            });
          }
          return results;
        }).call(this),
        version: GEOMETRY_VERSION
      });
    };

    Layout.prototype.applyGeometry = function(geom_json) {
      var geom, i, j, len, len1, node, ref, ref1, saved, tr;
      geom = JSON.parse(geom_json);
      if (geom.version !== GEOMETRY_VERSION) {
        return;
      }
      ref = geom.nodes;
      for (i = 0, len = ref.length; i < len; i++) {
        saved = ref[i];
        if ((node = this.s.nodeMap.get(saved.id)) != null) {
          node.w = saved.w;
          node.h = saved.h;
        }
      }
      ref1 = geom.transitions || [];
      for (j = 0, len1 = ref1.length; j < len1; j++) {
        saved = ref1[j];
        if ((tr = this.s.nodeMap.get(saved.id)) != null) {
          tr.route = saved.route;
        }
      }
      return this.svgUpdate();
    };

    Layout.prototype.svgCreate = function(parent) {
      var defs;
      this.zoomBehavior = d3.behavior.zoom().scaleExtent([MIN_ZOOM, MAX_ZOOM]);
      this.svg = d3.select(parent).append('svg').attr('xmlns:xmlns:xlink', 'http://www.w3.org/1999/xlink').classed('force-layout', true).classed('debug', this.debug);
      this.el = this.svg[0][0];
      defs = this.svg.append('defs');
      this.svg.call(this.zoomBehavior);
      this.container = this.svg.append('g');
      this.zoomBehavior.on('zoom', (function(_this) {
        return function() {
          var e;
          e = d3.event;
          return _this.container.attr('transform', "translate(" + e.translate + "),scale(" + e.scale + ")");
        };
      })(this));
      defs.append('marker').attr('id', this.id + "-arrow").attr('refX', '7').attr('refY', '5').attr('markerWidth', '10').attr('markerHeight', '10').attr('orient', 'auto').append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z').attr('class', 'arrow');
      return this.invalidateSize();
    };

    Layout.prototype.invalidateSize = function() {
      var $parent, height, width;
      $parent = $(this.el).parent();
      width = $parent.width() - 5;
      height = $parent.height() - 5;
      d3.select(this.el).attr('width', width).attr('height', height);
      this.zoomBehavior.size([width, height]).translate([width / 2, height / 2]);
      return this.zoomBehavior.event(this.svg);
    };

    Layout.prototype.svgNodes = function() {
      var cellUpdate, dom, newCell, transitionG, transitionUpdate;
      cellUpdate = this.container.selectAll('.cell').data(this.s.cells, function(d) {
        return d.id;
      });
      newCell = cellUpdate.enter().append('g');
      newCell.append('rect').attr('class', 'border');
      newCell.append('g').attr('class', 'cell-header');
      cellUpdate.each(function(node) {
        var corner_radius, h, hEntry, hExit, header, label, labelTextWidth, label_text, onentry, onexit, ref, ref1, w, wEntry, wExit, wLabel;
        d3.select(this).attr('class', "cell cell-" + (node.type || 'state') + " " + (node.isInitial ? 'cell-isInitial' : '')).classed('parallel-child', node.parent.type === 'parallel');
        header = d3.select(this).select('.cell-header');
        header.selectAll('*').remove();
        if (node.isInitial) {
          node.minSize = {
            w: 10,
            h: 10
          };
          return;
        }
        if (node.type === 'final') {
          d3.select(this).selectAll('.border-inset').remove();
          d3.select(this).append('rect').attr('class', 'border-inset').attr('rx', ROUND_CORNER).attr('ry', ROUND_CORNER);
        }
        if (node.type === 'history') {
          label_text = 'H';
          corner_radius = 100;
        } else {
          label_text = node.label;
          corner_radius = ROUND_CORNER;
        }
        d3.select(this).select('.border').attr('rx', corner_radius).attr('ry', corner_radius);
        label = header.append('text').text(label_text).attr('y', 12);
        labelTextWidth = label[0][0].getBBox().width;
        wLabel = d3.min([labelTextWidth + 2 * ROUND_CORNER, LABEL_SPACE]);
        node.textWidth = wLabel;
        onentry = header.append('g');
        onexit = header.append('g');
        ref = actionBlockSvg(node.onentry || [], onentry), wEntry = ref[0], hEntry = ref[1];
        ref1 = actionBlockSvg(node.onexit || [], onexit), wExit = ref1[0], hExit = ref1[1];
        w = wEntry + wLabel + wExit;
        h = d3.max([16, hEntry, hExit]);
        if (node.type === 'history') {
          h = w;
        }
        label.attr('x', wEntry + wLabel / 2 - w / 2);
        onentry.attr('transform', "translate(" + (wEntry / 2 - w / 2) + ",0)");
        onexit.attr('transform', "translate(" + (w / 2 - wExit / 2) + ",0)");
        node.header = {
          w: w,
          h: h
        };
        return node.minSize = {
          w: w + 10,
          h: h + 10
        };
      });
      cellUpdate.exit().remove();
      this.container.selectAll('.cell').sort(function(a, b) {
        return d3.ascending(idPath(a), idPath(b));
      });
      transitionUpdate = this.container.selectAll('.transition').data(this.s.transitions, function(d) {
        return d.id;
      });
      transitionG = transitionUpdate.enter().append('g').attr('class', 'transition');
      transitionG.append('path').attr('class', 'transitionMask');
      transitionG.append('path').attr('class', 'transitionLine').attr('style', "marker-end: url(#" + this.id + "-arrow)").attr('id', (function(_this) {
        return function(tr) {
          return _this.id + "-transition/" + tr.id;
        };
      })(this));
      transitionG.append('g').attr('class', 'transition-label').append('g').attr('class', 'transition-label-offset');
      transitionUpdate.exit().remove();
      transitionUpdate.each(function(tr) {
        var actionBlockG, h, offsetG, ref, transitionRect, transitionText, w, y;
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
        ref = actionBlockSvg(tr.actions || [], actionBlockG), w = ref[0], h = ref[1];
        y += h;
        tr.textWidth = d3.min([transitionText[0][0].getBBox().width + 5, LABEL_SPACE]);
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
      dom = this.s.dom;
      this.container.selectAll('.cell').each(function(node) {
        return dom.set("cell-" + node.id, this);
      });
      return this.container.selectAll('.transition').each(function(node) {
        return dom.set("transition-" + node.id, this);
      });
    };

    Layout.prototype.svgUpdate = function(options) {
      var animate, trPath;
      options = _.extend({
        animate: false
      }, options);
      if (options.animate) {
        animate = function(sel) {
          return sel.transition();
        };
      } else {
        animate = function(sel) {
          return sel;
        };
      }
      this.container.selectAll('.cell').classed('fixed', function(node) {
        return node.fixed;
      });
      animate(this.container.selectAll('.cell')).attr('transform', function(node) {
        return "translate(" + node.x + "," + node.y + ")";
      });
      this.container.selectAll('.cell').each(function(node) {
        animate(d3.select(this).select('.border')).attr('x', -node.w / 2).attr('y', -node.h / 2).attr('width', node.w).attr('height', node.h);
        animate(d3.select(this).select('.border-inset')).attr('x', -node.w / 2 + BORDER_INSET).attr('y', -node.h / 2 + BORDER_INSET).attr('width', node.w - 2 * BORDER_INSET).attr('height', node.h - 2 * BORDER_INSET);
        return animate(d3.select(this).select('.cell-header')).attr('transform', function(node) {
          return "translate(0," + (5 - node.h / 2) + ")";
        });
      });
      trPath = function(tr) {
        return d3.svg.line()([].concat([tr.route.src], tr.route.segment1, [tr.route.label1], [tr.route.label2], tr.route.segment2, [tr.route.dst]));
      };
      animate(this.container.selectAll('.transition').select('.transitionMask')).attr('d', trPath);
      animate(this.container.selectAll('.transition').select('.transitionLine')).attr('d', trPath);
      return animate(this.container.selectAll('.transition').select('.transition-label')).attr('transform', function(tr) {
        return "translate(" + tr.x + "," + tr.y + ")";
      });
    };

    Layout.prototype.moveNode = function(node, dx, dy) {
      var child, control, i, j, k, len, len1, len2, ref, ref1, ref2, results, tr, translate;
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
        ref = this.s.transitions;
        for (i = 0, len = ref.length; i < len; i++) {
          tr = ref[i];
          if (tr.a.id === node.id) {
            translate(tr.route.src, dx, dy);
          }
          if (tr.b.id === node.id) {
            translate(tr.route.dst, dx, dy);
          }
        }
      }
      ref1 = node.children || [];
      for (j = 0, len1 = ref1.length; j < len1; j++) {
        child = ref1[j];
        this.moveNode(child, dx, dy);
      }
      ref2 = node.controls || [];
      results = [];
      for (k = 0, len2 = ref2.length; k < len2; k++) {
        control = ref2[k];
        results.push(this.moveNode(control, dx, dy));
      }
      return results;
    };

    Layout.prototype.adjustLayout = function() {
      var adjustNode, handleCollisions, i, len, node, ref;
      handleCollisions = (function(_this) {
        return function(parent, center) {
          var collide, i, len, node, nx1, nx2, ny1, ny2, objects, q, results;
          objects = [].concat(parent.children, parent.controls);
          q = d3.geom.quadtree(objects);
          results = [];
          for (i = 0, len = objects.length; i < len; i++) {
            node = objects[i];
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
            results.push(q.visit(collide));
          }
          return results;
        };
      })(this);
      adjustNode = (function(_this) {
        return function(node) {
          var dx, dy, grow, ref, xMax, xMin, yMax, yMin;
          if (node.children.length > 0) {
            handleCollisions(node, node);
            ref = envelope(node, CELL_PAD), xMin = ref[0], xMax = ref[1], yMin = ref[2], yMax = ref[3];
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
      ref = this.s.top.children;
      for (i = 0, len = ref.length; i < len; i++) {
        node = ref[i];
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

    Layout.prototype.unhighlightAllStates = function() {
      return this.queue.push((function(_this) {
        return function(cb) {
          d3.select(_this.el).selectAll('.cell.highlight').classed('highlight', false);
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
          var h, ref, ref1, scale, w, xMax, xMin, yMax, yMin;
          ref = envelope(_this.s.top, EXPORT_PAD), xMin = ref[0], xMax = ref[1], yMin = ref[2], yMax = ref[3];
          ref1 = _this.zoomBehavior.size(), w = ref1[0], h = ref1[1];
          scale = d3.min([w / (xMax - xMin), h / (yMax - yMin)]);
          _this.zoomBehavior.translate([w / 2 - (xMax + xMin) * scale / 2, h / 2 - (yMax + yMin) * scale / 2]);
          _this.zoomBehavior.scale(scale);
          _this.zoomBehavior.event(_this.svg);
          return cb();
        };
      })(this));
    };

    Layout.prototype.exportSvg = function(options) {
      var bbox, container, defs, div, ref, svg, xMax, xMin, yMax, yMin;
      ref = envelope(this.s.top, EXPORT_PAD), xMin = ref[0], xMax = ref[1], yMin = ref[2], yMax = ref[3];
      div = $('<div style="positoin:relative">')[0];
      svg = d3.select(div).append('svg').attr('xmlns', 'http://www.w3.org/2000/svg').classed('force-layout', true);
      defs = d3.select(this.el).select('defs')[0][0].cloneNode(true);
      svg[0][0].appendChild(defs);
      d3.select(defs).append('style').text(options.css);
      container = this.container[0][0].cloneNode(true);
      d3.select(container).attr('transform', null);
      svg[0][0].appendChild(container);
      $('body').append(div);
      bbox = container.getBBox();
      $(div).remove();
      svg.attr('viewBox', bbox.x + " " + bbox.y + " " + bbox.width + " " + bbox.height);
      return div.innerHTML;
    };

    return Layout;

  })();

  force.render = function(options) {
    return new force.Layout(options);
  };

}).call(this);

//# sourceMappingURL=forceLayout.js.map