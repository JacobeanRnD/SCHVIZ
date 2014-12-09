treeFromXml = require('./treeFromXml.coffee')


force = window.forceLayout = module.exports = {}

MARGIN = 5
ROUND_CORNER = 5
CELL_MIN = {w: 40, h: 40}
CELL_PAD = {top: 20, bottom: 5, left: 5, right: 5}
LABEL_SPACE = 400
CONTROL_RADIUS = 20
LINK_STRENGTH = .1
LINK_DISTANCE = 30
DEBUG_FORCE_FACTOR = 50
MIN_ZOOM = 1/6
MAX_ZOOM = 6


nextId = (->
  last = 0
  return ->
    last += 1
    return "_force_id_#{last}_"
)()


def = (map, key, defaultValue) ->
  unless map[key]?
    map[key] = defaultValue
  return map[key]


walk = (state, callback, parent=null, postorder=false) ->
  callback(state, parent) unless postorder
  for child in state.children or []
    walk(child, callback, state, postorder)
  callback(state, parent) if postorder


parents = (node) ->
  if node.parent then parents(node.parent).concat([node.parent]) else []


path = (node1, node2) ->
  parents1 = parents(node1)
  parents2 = parents(node2)
  eq = 0
  for n in [0 .. d3.min([parents1.length, parents2.length]) - 1]
    if parents1[n] != parents2[n] then break
    eq = n
  return [node1, parents1[eq], node2]


exit = (cell, point) ->
  d = {x: point.x - cell.x, y: point.y - cell.y}
  ex = cell.w / 2 / d.x
  ey = cell.h / 2 / d.y
  e = d3.min([ex, ey], Math.abs)
  return {x: cell.x + d.x * e, y: cell.y + d.y * e}


toKielerFormat = (state) ->
  children = []
  edges = []
  for child in state.children or []
    children.push(toKielerFormat(child))
    for transition in child.transitions or []
      edges.push(
        source: child.id
        target: transition.target
      )
  rv = {
    id: state.id
    children: children
    edges: edges
  }
  if state.id?
    rv.labels = [{text: state.id}]
  if (state.children or []).length == 0
    rv.width = CELL_MIN.w
    rv.height = CELL_MIN.h
  return rv


applyKielerLayout = (state, kNode, x0 = null, y0 = null) ->
  i = state._initial = {
    w: kNode.width
    h: kNode.height
  }

  unless x0? and y0?
    x0 = -i.w/2
    y0 = -i.h/2

  i.x = x0 + kNode.x + i.w/2
  i.y = y0 + kNode.y + i.h/2

  for tr in state.transitions or []
    tr._initial = {
      x: x0 + 0
      y: y0 + 0
    }

  childMap = {}
  for child in state.children or []
    if child.id? then childMap[child.id] = child

  for kChild in kNode.children or []
    unless (child = childMap[kChild.id])? then continue
    applyKielerLayout(child, kChild, i.x - i.w/2, i.y - i.h/2)


force.kielerLayout = (tree) ->
  graph = toKielerFormat({id: 'root', children: tree})

  form = {
    graph: JSON.stringify(graph)
    config: JSON.stringify({})
    iFormat: 'org.json'
    oFormat: 'org.json'
    spacing: 100
    algorithm: 'de.cau.cs.kieler.klay.layered'
  }

  return Q($.post('/kieler', form))
    .then (resp) ->
      graphLayout = JSON.parse(resp)[0]
      treeCopy = JSON.parse(JSON.stringify(tree))
      applyKielerLayout({id: 'root', children: treeCopy}, graphLayout)
      return treeCopy


force.drawTree = (container, defs, tree, debug) ->
  new force.Layout(
    container: container
    defs: defs
    tree: tree
    debug: debug
  )


class force.Layout

  constructor: (options) ->
    @container = options.container
    @debug = options.debug

    @loadTree(options.tree)
    @renderDefs(options.defs)
    @renderTree()
    @setupD3Layout()

  loadTree: (tree) ->
    @nodes = []
    @controls = []
    @cells = []
    @nodeMap = {}
    @links = []
    @transitions = []
    @top = {
      children: []
      controls: []
    }

    for topState in tree
      walk topState, (state, parent) =>
        node = {
          id: state.id
          type: state.type or 'state'
          x: state._initial.x
          y: state._initial.y
          w: state._initial.w
          h: state._initial.h
          children: []
          controls: []
        }
        @nodes.push(node)
        @cells.push(node)
        @nodeMap[state.id] = node
        node.parent = if parent? then @nodeMap[parent.id] else @top
        node.parent.children.push(node)

    for topState in tree
      walk topState, (state) =>
        for tr in state.transitions or []
          [a, c, b] = path(@nodeMap[state.id], @nodeMap[tr.target])
          c = {
            transition: tr
            parent: c or @top
            w: CONTROL_RADIUS
            h: CONTROL_RADIUS
            x: tr._initial.x
            y: tr._initial.y
          }
          c.parent.controls.push(c)
          @nodes.push(c)
          @controls.push(c)
          for [source, target] in d3.pairs([a, c, b])
            @links.push(
              source: source
              target: target
            )
          label = tr.event or ''
          @transitions.push({
            a: a
            b: b
            c: c
            selfie: state.id == tr.target
            label: label
          })

  renderDefs: (defs) ->
    defs.append('marker')
        .attr('id', (@_arrow_id = nextId()))
        .attr('refX', '7')
        .attr('refY', '5')
        .attr('markerWidth', '10')
        .attr('markerHeight', '10')
        .attr('orient', 'auto')
      .append('path')
        .attr('d', 'M 0 0 L 10 5 L 0 10 z')
        .attr('class', 'arrow')

  renderTree: ->
    cell = @container.selectAll('.cell')
        .data(@cells)
      .enter().append('g')
        .attr('class', (cell) -> "cell cell-#{cell.type or 'state'}")
        .classed('parallel-child', (cell) -> cell.parent.type == 'parallel')

    cell.append('rect')
        .attr('class', 'border')
        .attr('x', (node) -> - node.w / 2)
        .attr('y', (node) -> - node.h / 2)
        .attr('width', (node) -> node.w)
        .attr('height', (node) -> node.h)
        .attr('rx', ROUND_CORNER)
        .attr('ry', ROUND_CORNER)

    cell.append('text')
        .text((node) -> node.id)
        .each (node) ->
          node.textWidth = d3.min([$(@).width() + 2 * ROUND_CORNER, LABEL_SPACE])
          node.w = d3.max([node.w, node.textWidth])

    @transition = @container.selectAll('.transition')
        .data(@transitions)
      .enter().append('g')
        .attr('class', 'transition')

    @transition.append('path')
        .attr('style', "marker-end: url(##{@_arrow_id})")

    @transition.append('text')
        .attr('class', 'transition-label')
        .text((tr) -> tr.label)

    if @debug
      control = @container.selectAll('.control')
          .data(@controls)
        .enter().append('circle')
          .attr('class', 'control')
          .attr('r', CONTROL_RADIUS)

  setupD3Layout: ->
    @layout = d3.layout.force()
        .charge(0)
        .gravity(0)
        .linkStrength(LINK_STRENGTH)
        .linkDistance(LINK_DISTANCE)
        .nodes(@nodes)
        .links(@links)
        .start()

    lock = {node: null, drag: false}

    drag = d3.behavior.drag()
        .origin((node) -> node)
        .on 'dragstart', (node) =>
          d3.event.sourceEvent.stopPropagation()
          (lock.node = node).fixed = true
          lock.drag = true
        .on 'drag', (node) =>
          d3.event.sourceEvent.stopPropagation()
          node.px = d3.event.x
          node.py = d3.event.y
          @layout.resume()
        .on 'dragend', (node) =>
          d3.event.sourceEvent.stopPropagation()
          lock.drag = false
          lock.node = null
          node.fixed = false

    @container.selectAll('.cell')
        .on 'mouseover', (node) =>
          if lock.drag then return
          if lock.node then lock.node.fixed = false
          (lock.node = node).fixed = true
          node.px = node.x
          node.py = node.y
          render()
        .on 'mouseout', (node) =>
          if lock.drag then return
          lock.node = null
          node.fixed = false
          render()
        .call(drag)

    render = =>
      @container.selectAll('.cell')
          .attr('transform', (node) -> "translate(#{node.x},#{node.y})")
          .classed('fixed', (node) -> node.fixed)

      @container.selectAll('.cell').each (node) ->
          d3.select(this).select('rect')
              .attr('x', - node.w / 2)
              .attr('y', - node.h / 2)
              .attr('width', node.w)
              .attr('height', node.h)

          d3.select(this).select('text')
              .attr('y', (node) -> CELL_PAD.top - node.h / 2 - 5)

      @container.selectAll('.selfie').remove()

      @transition
          .classed('highlight', (tr) -> tr.a.fixed or tr.b.fixed)
        .selectAll('path')
          .attr 'd', (tr) ->
            [a, b, c] = [tr.a, tr.b, tr.c]

            if tr.selfie
              w = c.x - a.x
              h = c.y - a.y
              c1 = {x: c.x - h/2, y: c.y + w/2}
              c2 = {x: c.x + h/2, y: c.y - w/2}
              s = exit(a, c1)
              t = exit(b, c2)
              return "M#{s.x},#{s.y} C#{c1.x},#{c1.y} #{c2.x},#{c2.y} #{t.x},#{t.y}"

            else
              s = exit(a, c)
              t = exit(b, c)
              return "M#{s.x},#{s.y} S#{c.x},#{c.y} #{t.x},#{t.y}"

      @transition.selectAll('text')
          .attr('x', (tr) -> tr.c.x)
          .attr('y', (tr) -> tr.c.y)

      if @debug
        control
            .attr('cx', (d) -> d.x)
            .attr('cy', (d) -> d.y)

    @layout.on 'tick', =>
      render()

      tick = {
        gravity: @layout.alpha() * 0.1
        forces: {}
      }

      for node in @top.children
        walk(node, ((node) => arrange(node, tick)), null, true)
      handleCollisions(@top, {x: 0, y: 0}, tick)

      if @debug
        @container.selectAll('.cell .force').remove()

        @container.selectAll('.cell')
            .each (node) ->
              for force in tick.forces[node.id] or []
                d3.select(@).append('line')
                    .attr('class', "force #{force.cls}")
                    .attr('x1', 0)
                    .attr('y1', 0)
                    .attr('x2', force.value[0] * DEBUG_FORCE_FACTOR)
                    .attr('y2', force.value[1] * DEBUG_FORCE_FACTOR)

    render()


arrange = (node, tick) ->
  if node.children.length > 0
    handleCollisions(node, node, tick)

    xMin = d3.min(node.children, (d) -> d.x - d.w / 2) - CELL_PAD.left
    xMax = d3.max(node.children, (d) -> d.x + d.w / 2) + CELL_PAD.right
    yMin = d3.min(node.children, (d) -> d.y - d.h / 2) - CELL_PAD.top
    yMax = d3.max(node.children, (d) -> d.y + d.h / 2) + CELL_PAD.bottom
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
      move(node, -dx, -dy)

  node.weight = node.w * node.h


move = (node, dx, dy) ->
  node.x += dx
  node.y += dy
  for child in node.children or []
    move(child, dx, dy)
  for control in node.controls or []
    move(control, dx, dy)


handleCollisions = (parent, center, tick) ->
  for child in parent.children
    dx = (center.x - child.x) * tick.gravity
    dy = (center.y - child.y) * tick.gravity
    move(child, dx, dy)
    def(tick.forces, child.id, []).push(value: [dx, dy], cls: 'gravity')

  objects = [].concat(parent.children, parent.controls)
  q = d3.geom.quadtree(objects)
  for obj in objects
    q.visit(collide(obj, tick))


collide = (node, tick) ->
  nx1 = node.x - node.w - 100
  nx2 = node.x + node.w + 100
  ny1 = node.y - node.h - 100
  ny2 = node.y + node.h + 100

  fn = (quad, x1, y1, x2, y2) ->
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

        move(node, dx1, dy1)
        move(other, dx2, dy2)
        def(tick.forces, node.id, []).push(value: [dx1, dy1], cls: 'collision')
        def(tick.forces, other.id, []).push(value: [dx2, dy2], cls: 'collision')

    return x1 > nx2 or x2 < nx1 or y1 > ny2 or y2 < ny1

  return fn


force.render = (options) ->
  if options.tree?
    tree = options.tree
  else
    tree = treeFromXml(options.doc).sc

  debug = options.debug or false
  width = $(options.parent).width() - 5
  height = $(options.parent).height() - 5

  zoom = d3.behavior.zoom()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])

  svg = d3.select(options.parent).append('svg')
      .classed('force-layout', true)
      .classed('debug', debug)
  defs = svg.append('defs')
  zoomNode = svg.append('g')
  container = zoomNode.call(zoom).append('g')
  zoomRect = container.append('rect')
      .attr('class', 'zoomRect')

  svg.attr('width', width).attr('height', height)

  zoomRect
      .attr('width', width / MIN_ZOOM)
      .attr('height', height / MIN_ZOOM)
      .attr('x', - width / 2 / MIN_ZOOM)
      .attr('y', - height / 2 / MIN_ZOOM)

  zoom.on 'zoom', ->
      e = d3.event
      container.attr('transform', "translate(#{e.translate}),scale(#{e.scale})")

  zoom.size([width, height])
      .translate([width / 2, height / 2])
      .event(zoomNode)

  force.kielerLayout(tree)
    .done (treeWithLayout) ->
      force.drawTree(container, defs, treeWithLayout, debug=debug)
