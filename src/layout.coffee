force = window.forceLayout = {}

KIELER_URL = 'http://kieler.herokuapp.com/live'
MARGIN = 5
ROUND_CORNER = 5
CELL_MIN = {w: 15, h: 15}
CELL_PAD = {top: 12, bottom: 12, left: 12, right: 12}
EXPORT_PAD = {top: 10, bottom: 10, left: 10, right: 10}
LABEL_SPACE = 400
LINK_STRENGTH = .1
LINK_DISTANCE = 30
DEBUG_FORCE_FACTOR = 50
MIN_ZOOM = 1/6
MAX_ZOOM = 6
ANIMATION_SPEED = 2
GEOMETRY_VERSION = 2
BORDER_INSET = 3
SRC_PREVIEW_LIMIT = 40


strip = (obj) ->
  for key, value of obj
    if value?
      if _.isArray(value) and value.length == 0
        delete obj[key]
      else if _.isObject(value)
        strip(value)
        if _.isEmpty(value)
          delete obj[key]
    else
      delete obj[key]
  return obj


treeFromXml = (doc) ->
  parseActions = (container) ->
    rv = []
    for child in container.childNodes
      if child.tagName
        rv.push(action = {label: "<#{child.tagName}>"})
        if child.tagName == 'script'
          firstLine = $(child).text().trim().split(/\n/)[0]
          if firstLine.length > SRC_PREVIEW_LIMIT
            firstLine = firstLine.slice(0, SRC_PREVIEW_LIMIT - 4) + ' ...'
          action.preview = firstLine
    return rv

  parseChildNodes = (node) ->
    transitions = []
    onentry = []
    onexit = []

    for child in node.childNodes
      switch child.tagName
        when 'transition'
          target = child.getAttribute('target')
          if target and target.indexOf(' ') > -1
            throw new Error("not implemented: transition with multiple targets")
          unless target
            target = node.getAttribute('id')
          transitions.push(strip(
            target: target
            cond: child.getAttribute('cond') or null
            event: child.getAttribute('event') or null
            actions: parseActions(child)
          ))

        when 'onentry'
          onentry = onentry.concat(parseActions(child))

        when 'onexit'
          onexit = onexit.concat(parseActions(child))

    return {
      transitions: transitions
      onentry: onentry
      onexit: onexit
    }

  parseStates = (node) ->
    stateList = []
    for node in node.childNodes
      state = switch node.tagName
        when 'initial'
          {
            type: 'initial'
            id: node.getAttribute('id') or null
            children: parseStates(node)
          }

        when 'state'
          {
            type: 'state'
            id: node.getAttribute('id') or null
            children: parseStates(node)
          }

        when 'final'
          {
            type: 'final'
            id: node.getAttribute('id') or null
            children: parseStates(node)
          }

        when 'parallel'
          {
            type: 'parallel'
            id: node.getAttribute('id') or null
            children: parseStates(node)
          }

        when 'history'
          {
            type: 'history'
            id: node.getAttribute('id') or null
            deep: node.getAttribute('type') == 'deep' or null
          }

      if state?
        _.extend(state, parseChildNodes(node))
        stateList.push(strip(state))

    return stateList

  return {sc: parseStates(doc.documentElement)}


idMaker = ->
  counterMap = d3.map()
  return (prefix='_force_id_') ->
    counter = counterMap.get(prefix) or 0
    counter += 1
    counterMap.set(prefix, counter)
    return "#{prefix}#{counter}"


nextId = idMaker()


walk = (node, callback, parent=null, postorder=false) ->
  callback(node, parent) unless postorder
  for child in node.children or []
    walk(child, callback, node, postorder)
  callback(node, parent) if postorder


parents = (node) ->
  if node.parent then parents(node.parent).concat([node.parent]) else []


idPath = (node) ->
  parents(node).join('/')


path = (node1, node2) ->
  parents1 = parents(node1)
  parents2 = parents(node2)
  eq = 0
  for n in [0 .. d3.min([parents1.length, parents2.length]) - 1]
    if parents1[n] != parents2[n] then break
    eq = n
  return [node1, parents1[eq], node2]


midpoint = (a, b) -> {
  x: ((a.x or 0) + (b.x or 0)) / 2
  y: ((a.y or 0) + (b.y or 0)) / 2
}


findTransition = (transitions, source, target) ->
  for tr in transitions
    if tr.a.id == source and tr.b.id == target
      return tr


envelope = (node, pad={}) ->
  xValues = []
  yValues = []

  for box in [].concat(node.children, node.controls)
    xValues.push(box.x - box.w / 2)
    xValues.push(box.x + box.w / 2)
    yValues.push(box.y - box.h / 2)
    yValues.push(box.y + box.h / 2)

  for tr in node.controls
    for point in [].concat(tr.route.segment1, tr.route.segment2)
      xValues.push(point[0])
      yValues.push(point[1])

  return [
    d3.min(xValues) - (pad.left or 0)
    d3.max(xValues) + (pad.right or 0)
    d3.min(yValues) - (pad.top or 0) - (node.topPadding or 0)
    d3.max(yValues) + (pad.bottom or 0)
  ]


actionSvg = (options) ->
  actionR = options.g.append('rect')

  actionT = options.g.append('text')
      .attr('y', 12)

  actionT.append('tspan')
      .text(options.action.label)

  if options.action.preview
      actionT.append('tspan')
          .attr('x', 0)
          .attr('dy', 16)
          .text(options.action.preview)

  actionR
      .attr('height', h = $(actionT[0][0]).height())
      .attr('width', w = $(actionT[0][0]).width() + 10)
      .attr('x', -w/2)
      .attr('rx', 10)
      .attr('ry', 10)

  return [w, h]


actionBlockSvg = (actions, parentG) ->
  y = 0
  maxw = 0
  for action in actions
    actionG = parentG.append('g')
        .attr('class', 'action')
        .attr('transform', "translate(0,#{y})")

    [w, h] = actionSvg(action: action, g: actionG)
    y += h
    maxw = d3.max([maxw, w])

  return [maxw, y]


toKielerFormat = (node) ->
  children = []
  edges = []
  for child in node.children or []
    children.push(toKielerFormat(child))
  for tr in node.controls or []
    children.push(
      id: tr.id
      desmTransition: true
      width: tr.w
      height: tr.h
      ports: [
        {id: "#{tr.id}#enter", x: 0, y: tr.yPort}
        {id: "#{tr.id}#exit", x: tr.w, y: tr.yPort}
      ]
      properties:
        portConstraints: 'FIXED_POS'
    )
    edges.push(
      id: "#{tr.id}#1"
      source: tr.a.id
      target: tr.id
      targetPort: "#{tr.id}#enter"
    )
    edges.push(
      id: "#{tr.id}#2"
      source: tr.id
      target: tr.b.id
      sourcePort: "#{tr.id}#exit"
    )
  node_header = node.header or CELL_MIN
  node_min_size = node.minSize or {w: 0, h: 0}
  rv = {
    id: node.id
    children: children
    edges: edges
    padding: {top: node_header.h or 0}
    width: node_min_size.w
    height: node_min_size.h
    properties:
      minWidth: node_min_size.w
      minHeight: node_min_size.h
      sizeConstraint: 'MINIMUM_SIZE'
  }
  return rv


applyKielerLayout = (options) ->
  s = options.s
  graph = options.graph
  kNodeMap = d3.map()
  kEdgeMap = d3.map()
  offsetMap = d3.map()

  offsetMap.set('__ROOT__', {
    x: -graph.width / 2
    y: -graph.height / 2
  })
  walk graph, (kNode) =>
    kNodeMap.set(kNode.id, kNode)
    offset = offsetMap.get(kNode.id)
    padding = _.extend({top: 0, left: 0}, kNode.padding)
    for kChild in kNode.children or []
      offsetMap.set(kChild.id, {
        x: offset.x + (kNode.x or 0) + (padding.left or 0)
        y: offset.y + (kNode.y or 0) + (padding.top or 0)
      })
    for kEdge in kNode.edges or []
      kEdgeMap.set(kEdge.id, kEdge)

  traverse = (kNode) ->
    if kNode.desmTransition
      tr = s.nodeMap.get(kNode.id)
      offset1 = offsetMap.get(tr.a.id)
      offset2 = offsetMap.get(tr.id)
      kTr = kNodeMap.get(tr.id)
      tr.x = offset2.x + kTr.x + kTr.width/2
      tr.y = offset2.y + kTr.y + kTr.height/2

      e1 = kEdgeMap.get("#{tr.id}#1")
      e2 = kEdgeMap.get("#{tr.id}#2")

      translate1 = (d) -> [offset1.x + d.x, offset1.y + d.y]
      translate2 = (d) -> [offset2.x + d.x, offset2.y + d.y]

      tr.route = {
        src: translate1(e1.sourcePoint)
        segment1: (e1.bendPoints or []).map(translate1)
        label1: translate1(e1.targetPoint)
        label2: translate2(e2.sourcePoint)
        segment2: (e2.bendPoints or []).map(translate2)
        dst: translate2(e2.targetPoint)
      }

    else if kNode.id != '__ROOT__'
      node = s.nodeMap.get(kNode.id)
      offset = offsetMap.get(kNode.id)
      node.w = kNode.width
      node.h = kNode.height
      node.x = offset.x + (kNode.x or 0) + node.w/2
      node.y = offset.y + (kNode.y or 0) + node.h/2

    for kChild in kNode.children or []
      traverse(kChild)

  traverse(graph)


kielerLayout = (s, options) ->
  algorithm = options.algorithm or '__klayjs'
  top = s.top

  graph = toKielerFormat(top)

  if algorithm == '__klayjs'
    klay_ready = Q.defer()
    $klay.layout(
      graph: graph
      options:
        layoutHierarchy: true
        edgeRouting: 'ORTHOGONAL'
        feedBackEdges: true
      success: klay_ready.resolve
      error: (err) -> klay_ready.reject(new Error(err.text))
    )

    layoutDone = klay_ready.promise

  else
    form = {
      graph: JSON.stringify(graph)
      config: JSON.stringify(
        algorithm: algorithm
        edgeRouting: 'ORTHOGONAL'
        feedBackEdges: true
        layoutHierarchy: true
      )
      iFormat: 'org.json'
      oFormat: 'org.json'
    }

    layoutDone = Q($.post(KIELER_URL, form))
      .catch (resp) ->
        throw Error(resp.responseText)
      .then (resp) ->
        return JSON.parse(resp)[0]

  return layoutDone


class NewNodesAnimation

  constructor: (@newNodes) ->
    @deferred = Q.defer()
    @promise = @deferred.promise
    @done = no
    @targetMap = d3.map()
    @abort() unless @newNodes.length > 0

    for node in @newNodes
      @targetMap.set(node.id, {w: node.w, h: node.h})
      node.w = node.h = 5

  tick: ->
    return if @done
    changed = no
    for node in @newNodes
      target = @targetMap.get(node.id)
      (node.w += ANIMATION_SPEED; changed = yes) if node.w < target.w
      (node.h += ANIMATION_SPEED; changed = yes) if node.h < target.h

    @abort() unless changed

  abort: ->
    @done = yes
    @deferred.resolve()


class LoadingOverlay

  constructor: (options) ->
    w = $(options.svg).width()
    h = $(options.svg).height()
    @el = d3.select(options.svg).append('g')
        .attr('class', "loadingOverlay")
    @el.append('rect')
        .attr('width', w)
        .attr('height', h)
    @el.append('text')
        .attr('x', w/2)
        .attr('y', h/2)
        .text(options.text)

  destroy: ->
    @el.remove()


class force.Layout

  constructor: (options) ->
    @id = nextId()
    @queue = async.queue(((task, cb) -> task(cb)), 1)
    @options = options
    @debug = options.debug or false
    @svgCreate(options.parent)
    @s = @_emptyState()
    @animation = new NewNodesAnimation([])
    @_initialTree(options.tree or treeFromXml(options.doc).sc)

  _initialTree: (tree) ->
    deferred = Q.defer()
    @initialized = deferred.promise

    @queue.push (cb) =>
      try
        @loadTree(tree)

        if @options.geometry?
          @applyGeometry(@options.geometry)
          @svgUpdate()
          cb()
          deferred.resolve()

        else
          loading = new LoadingOverlay(svg: @el, text: "Loading Kieler layout ...")
          deferred.resolve(
            @_kielerLayout()
            .then =>
              loading.destroy()
              cb()
          )

      catch e
        deferred.reject(e)
        cb()

  _kielerLayout: (options={}) ->
    kielerLayout(@s, algorithm: @options.kielerAlgorithm)
      .then (graph) =>
        applyKielerLayout(s: @s, graph: graph)
      .then =>
        @svgUpdate(animate: options.animate)

  update: (doc) ->
    deferred = Q.defer()
    @queue.push (cb) =>
      deferred.resolve(
        Q()
        .then =>
          @loadTree(treeFromXml(doc).sc)
          @_kielerLayout(animate: true)
        .finally =>
          cb()
      )

    return deferred.promise

  _emptyState: ->
    s = {
      nodes: []
      cells: []
      nodeMap: d3.map()
      links: []
      transitions: []
      top: {
        id: '__ROOT__'
        children: []
        controls: []
      }
      newNodes: []
      dom: d3.map()
    }
    s.nodeMap.set(s.top.id, s.top)
    return s

  loadTree: (tree) ->
    @mergeTree(tree)
    @svgNodes()

  mergeTree: (tree) ->
    oldS = @s
    newS = @_emptyState()
    newS.top.children = tree

    makeId = idMaker()

    for topNode in tree
      walk topNode, (node, parent) =>
        if node.id
          node.label = node.id
          node.autoId = false
        else
          node.id = makeId("_node_")
          node.autoId = true
          node.label = "<#{node.type}>"
        node.isInitial = false
        node.controls = []
        node.children = node.children or []
        if (oldNode = oldS.nodeMap.get(node.id))?
          node.x = oldNode.x
          node.y = oldNode.y
          node.header = oldNode.header
        else
          if parent?
            node.x = parent.x
            node.y = parent.y
          newS.newNodes.push(node)
        newS.nodes.push(node)
        newS.cells.push(node)
        newS.nodeMap.set(node.id, node)
        node.parent = if parent? then newS.nodeMap.get(parent.id) else newS.top

    for topNode in tree
      walk topNode, (node) =>
        for tr in node.transitions or []
          unless (target = newS.nodeMap.get(tr.target))?
            throw Error("missing transition target: #{tr.target}")
          [a, c, b] = path(node, target)
          tr.parent = c or newS.top
          tr.id = tr.id or makeId("_transition/#{node.id}/#{target.id}/")
          if (oldTr = oldS.nodeMap.get(tr.id))?
            tr.w = oldTr.w
            tr.h = oldTr.h
            tr.yPort = oldTr.yPort
          else
            tr.w = 0
            tr.h = 0
            tr.yPort = 0
          newS.nodeMap.set(tr.id, tr)
          tr.parent.controls.push(tr)
          newS.nodes.push(tr)
          for [link_source, link_target] in d3.pairs([a, tr, b])
            newS.links.push(
              source: link_source
              target: link_target
            )
          label = tr.event or ''
          tr.a = a
          tr.b = b
          tr.selfie = node.id == tr.target
          tr.label = label
          newS.transitions.push(tr)
          if (oldTr = findTransition(oldS.transitions, tr.a.id, tr.b.id))?
            _.extend(tr, {x: oldTr.x, y: oldTr.y})
          else
            _.extend(tr, midpoint(tr.a, tr.b))

    walk {children: tree}, (node) =>
      return unless node.children.length

      for child in node.children
        if child.type == 'initial'
          child.isInitial = true
          return

        if child.id == '@initial' and not child.children.length
          child.isInitial = true
          return

      first = node.children[0]
      if first.autoId and first.children.length == 0
        first.isInitial = true

    @s = newS

  saveGeometry: ->
    round = (x) -> Math.round(x)
    return JSON.stringify({
      nodes: {
        id: n.id
        w: round(n.w)
        h: round(n.h)
        x: round(n.x)
        y: round(n.y)
      } for n in @s.nodes
      transitions: {
        id: tr.id
        route: tr.route
      } for tr in @s.transitions
      version: GEOMETRY_VERSION
    })

  applyGeometry: (geom_json) ->
    geom = JSON.parse(geom_json)
    return if geom.version != GEOMETRY_VERSION
    for saved in geom.nodes
      if (node = @s.nodeMap.get(saved.id))?
        node.w = saved.w
        node.h = saved.h
    for saved in geom.transitions or []
      if (tr = @s.nodeMap.get(saved.id))?
        tr.route = saved.route
    @svgUpdate()

  svgCreate: (parent) ->
    @zoomBehavior = d3.behavior.zoom()
        .scaleExtent([MIN_ZOOM, MAX_ZOOM])

    @svg = d3.select(parent).append('svg')
        .attr('xmlns:xmlns:xlink', 'http://www.w3.org/1999/xlink')
        .classed('force-layout', true)
        .classed('debug', @debug)
    @el = @svg[0][0]
    defs = @svg.append('defs')
    @svg.call(@zoomBehavior)
    @container = @svg.append('g')

    @zoomBehavior.on 'zoom', =>
        e = d3.event
        @container.attr('transform', "translate(#{e.translate}),scale(#{e.scale})")

    defs.append('marker')
        .attr('id', "#{@id}-arrow")
        .attr('refX', '7')
        .attr('refY', '5')
        .attr('markerWidth', '10')
        .attr('markerHeight', '10')
        .attr('orient', 'auto')
      .append('path')
        .attr('d', 'M 0 0 L 10 5 L 0 10 z')
        .attr('class', 'arrow')

    @invalidateSize()

  invalidateSize: ->
    $parent = $(@el).parent()
    width = $parent.width() - 5
    height = $parent.height() - 5

    d3.select(@el)
        .attr('width', width)
        .attr('height', height)

    @zoomBehavior
        .size([width, height])
        .translate([width / 2, height / 2])

    @zoomBehavior.event(@svg)

  svgNodes: ->
    cellUpdate = @container.selectAll('.cell')
        .data(@s.cells, (d) -> d.id)

    newCell = cellUpdate.enter().append('g')

    newCell.append('rect')
        .attr('class', 'border')

    newCell.append('g')
        .attr('class', 'cell-header')

    cellUpdate.each (node) ->
        d3.select(@)
            .attr('class',
              "cell cell-#{node.type or 'state'}
               #{if node.isInitial then 'cell-isInitial' else ''}")
            .classed('parallel-child', node.parent.type == 'parallel')

        header = d3.select(@).select('.cell-header')
        header.selectAll('*').remove()

        if node.isInitial
          node.minSize = {w: 10, h: 10}
          return

        if node.type == 'final'
          d3.select(@).selectAll('.border-inset').remove()

          d3.select(@).append('rect')
            .attr('class', 'border-inset')
            .attr('rx', ROUND_CORNER)
            .attr('ry', ROUND_CORNER)

        if node.type == 'history'
          label_text = 'H'
          corner_radius = 100
        else
          label_text = node.label
          corner_radius = ROUND_CORNER

        d3.select(@).select('.border')
            .attr('rx', corner_radius)
            .attr('ry', corner_radius)

        label = header.append('text')
          .text(label_text)
          .attr('y', 12)

        labelTextWidth = $(label[0][0]).width()
        wLabel = d3.min([labelTextWidth + 2 * ROUND_CORNER, LABEL_SPACE])
        node.textWidth = wLabel

        onentry = header.append('g')
        onexit = header.append('g')
        [wEntry, hEntry] = actionBlockSvg(node.onentry or [], onentry)
        [wExit, hExit] = actionBlockSvg(node.onexit or [], onexit)

        w = wEntry + wLabel + wExit
        h = d3.max([16, hEntry, hExit])
        if node.type == 'history'
          h = w

        label.attr('x', wEntry + wLabel / 2 - w/2)
        onentry.attr('transform', "translate(#{wEntry/2 - w/2},0)")
        onexit.attr('transform', "translate(#{w/2 - wExit/2},0)")
        node.header = {w: w, h: h}
        node.minSize = {w: w + 10, h: h + 10}

    cellUpdate.exit().remove()

    @container.selectAll('.cell').sort (a, b) ->
        d3.ascending(idPath(a), idPath(b))

    transitionUpdate = @container.selectAll('.transition')
        .data(@s.transitions, (d) -> d.id)

    transitionUpdate.enter()
      .append('g')
        .attr('class', 'transition')
      .append('path')
        .attr('style', "marker-end: url(##{@id}-arrow)")
        .attr('id', (tr) => "#{@id}-transition/#{tr.id}")

    transitionUpdate.exit().remove()

    transitionLabelUpdate = @container.selectAll('.transition-label')
        .data(@s.transitions, (d) -> d.id)

    transitionLabelUpdate.enter()
      .append('g')
        .attr('class', 'transition-label')
      .append('g')
        .attr('class', 'transition-label-offset')

    transitionLabelUpdate.each (tr) ->
        offsetG = d3.select(@).select('.transition-label-offset')
        offsetG.selectAll('*').remove()

        transitionRect = offsetG.append('rect')

        transitionText = offsetG.append('text')
            .attr('y', 16)

        transitionText.append('tspan')
            .text(tr.label)

        if tr.cond?
          transitionText.append('tspan')
              .text("[#{tr.cond}]")
              .attr('x', 0)
              .attr('dy', 16)
          y += 16

        y = $(transitionText[0][0]).height() + 4
        tr.yPort = y - 2

        actionBlockG = offsetG.append('g')
            .attr('transform', "translate(0,#{y})")
        [w, h] = actionBlockSvg(tr.actions or [], actionBlockG)
        y += h
        tr.textWidth = d3.min([$(transitionText[0][0]).width() + 5, LABEL_SPACE])
        tr.w = d3.max([tr.w, tr.textWidth, w])
        tr.h = y + 4

        offsetG.attr('transform', "translate(0,#{-tr.h/2})")

        transitionRect
            .attr('x', (tr) -> -tr.w / 2)
            .attr('width', (tr) -> tr.w)
            .attr('height', (tr) -> tr.h)

    transitionLabelUpdate.exit().remove()

    dom = @s.dom

    @container.selectAll('.cell')
        .each (node) ->
          dom.set("cell-#{node.id}", @)

    @container.selectAll('.transition')
        .each (node) ->
          dom.set("transition-#{node.id}", @)

  svgUpdate: (options) ->
    options = _.extend({animate: false}, options)

    if options.animate
      animate = (sel) -> sel.transition()
    else
      animate = (sel) -> sel

    @container.selectAll('.cell')
        .classed('fixed', (node) -> node.fixed)

    animate(@container.selectAll('.cell'))
        .attr('transform', (node) -> "translate(#{node.x},#{node.y})")

    @container.selectAll('.cell').each (node) ->
        animate(d3.select(this).select('.border'))
            .attr('x', - node.w / 2)
            .attr('y', - node.h / 2)
            .attr('width', node.w)
            .attr('height', node.h)

        animate(d3.select(this).select('.border-inset'))
            .attr('x', - node.w / 2 + BORDER_INSET)
            .attr('y', - node.h / 2 + BORDER_INSET)
            .attr('width', node.w - 2 * BORDER_INSET)
            .attr('height', node.h - 2 * BORDER_INSET)

        animate(d3.select(this).select('.cell-header'))
            .attr 'transform', (node) ->
              "translate(0,#{5 - node.h / 2})"

    animate(@container.selectAll('.transition').select('path'))
        .attr 'd', (tr) ->
          d3.svg.line()([].concat(
            [tr.route.src]
            tr.route.segment1
            [tr.route.label1]
            [tr.route.label2]
            tr.route.segment2
            [tr.route.dst]
          ))

    animate(@container.selectAll('.transition-label'))
        .attr('transform', (tr) -> "translate(#{tr.x},#{tr.y})")

  moveNode: (node, dx, dy) ->
    node.x += dx
    node.y += dy

    translate = (p, dx, dy) -> p[0] += dx; p[1] += dy

    if node.route?
      translate(node.route.label1, dx, dy)
      translate(node.route.label2, dx, dy)

    else
      for tr in @s.transitions
        if tr.a.id == node.id
          translate(tr.route.src, dx, dy)
        if tr.b.id == node.id
          translate(tr.route.dst, dx, dy)

    for child in node.children or []
      @moveNode(child, dx, dy)
    for control in node.controls or []
      @moveNode(control, dx, dy)

  adjustLayout: ->
    handleCollisions = (parent, center) =>
      objects = [].concat(parent.children, parent.controls)
      q = d3.geom.quadtree(objects)

      for node in objects
        nx1 = node.x - node.w - 100
        nx2 = node.x + node.w + 100
        ny1 = node.y - node.h - 100
        ny2 = node.y + node.h + 100

        collide = (quad, x1, y1, x2, y2) =>
          other = quad.point
          if other and (other != node)
            dx = node.x - other.x
            dy = node.y - other.y
            w = (node.w + other.w) / 2 + MARGIN
            h = (node.h + other.h) / 2 + MARGIN

            cx = w - Math.abs(dx)
            cy = h - Math.abs(dy)
            if cx > 0 and cy > 0
              na = node.w * node.h
              oa = other.w * other.h
              f = oa / (oa + na)

              if cx/w < cy/h
                dy1 = dy2 = 0
                s = if dx > 0 then 1 else -1
                dx1 = s * f * cx
                dx2 = s * (f-1) * cx

              else
                dx1 = dx2 = 0
                s = if dy > 0 then 1 else -1
                dy1 = s * f * cy
                dy2 = s * (f-1) * cy

              @moveNode(node, dx1, dy1)
              @moveNode(other, dx2, dy2)

          return x1 > nx2 or x2 < nx1 or y1 > ny2 or y2 < ny1

        q.visit(collide)


    adjustNode = (node) =>
      if node.children.length > 0
        handleCollisions(node, node)
        [xMin, xMax, yMin, yMax] = envelope(node, CELL_PAD)
        grow = node.textWidth - (xMax - xMin)
        if grow > 0
          xMin -= grow / 2
          xMax += grow / 2
        node.w = xMax - xMin
        node.h = yMax - yMin
        dx = xMin + node.w / 2 - node.x
        dy = yMin + node.h / 2 - node.y
        node.x += dx
        node.y += dy
        if node.fixed
          @moveNode(node, -dx, -dy)

      node.weight = node.w * node.h

    for node in @s.top.children
      walk(node, adjustNode, null, true)

    handleCollisions(@s.top, {x: 0, y: 0})

  highlightState: (id, highlight=true) ->
    @queue.push (cb) =>
      d3.select(@s.dom.get("cell-#{id}"))
          .classed('highlight', highlight)
      cb()

  unhighlightAllStates: ->
    @queue.push (cb) =>
      d3.select(@el).selectAll('.cell.highlight')
          .classed('highlight', false)
      cb()

  highlightTransition: (source, target, highlight=true) ->
    @queue.push (cb) =>
      if (tr = findTransition(@s.transitions, source, target))?
        d3.select(@s.dom.get("transition-#{tr.id}"))
            .classed('highlight', highlight)
      cb()

  fit: ->
    @queue.push (cb) =>
      [xMin, xMax, yMin, yMax] = envelope(@s.top, EXPORT_PAD)
      [w, h] = @zoomBehavior.size()
      scale = d3.min([w / (xMax - xMin), h / (yMax - yMin)])
      @zoomBehavior.translate([
        w / 2 - (xMax + xMin) * scale / 2
        h / 2 - (yMax + yMin) * scale / 2
      ])
      @zoomBehavior.scale(scale)
      @zoomBehavior.event(@svg)
      cb()

  exportSvg: (options) ->
    [xMin, xMax, yMin, yMax] = envelope(@s.top, EXPORT_PAD)
    div = $('<div style="positoin:relative">')[0]
    svg = d3.select(div).append('svg')
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .classed('force-layout', true)
    defs = d3.select(@el).select('defs')[0][0].cloneNode(true)
    svg[0][0].appendChild(defs)
    d3.select(defs).append('style').text(options.css)
    container = @container[0][0].cloneNode(true)
    d3.select(container).attr('transform', null)
    svg[0][0].appendChild(container)
    $('body').append(div)
    bbox = container.getBBox()
    $(div).remove()
    svg.attr('viewBox', "#{bbox.x} #{bbox.y} #{bbox.width} #{bbox.height}")
    return div.innerHTML

force.render = (options) ->
  return new force.Layout(options)
