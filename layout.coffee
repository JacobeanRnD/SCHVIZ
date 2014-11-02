drawState = (cell, state) ->
    if state.children?
        g = cell.append('g')
        size = drawChildren(g, state.children)

    else
        size = 100

    r = Math.sqrt(size)

    cell.insert('rect', ':first-child')
        .attr('class', 'border')
        .attr('x', -r / 2)
        .attr('y', -r / 2)
        .attr('width', r)
        .attr('height', r)
        .attr('rx', 15)
        .attr('ry', 15)
      .append('title')
        .text(state.name)

    return size


drawChildren = (g, children) ->
    childNodes = []
    childLinks = []
    stateMap = {}

    for child in children
        child._idx = childNodes.length
        stateMap[child.name] = child
        childNodes.push({name: child.name})

    for child in children
        for tr in child.transitions or []
            target = stateMap[tr.target]
            childLinks.push({source: child._idx, target: target._idx})

    link = g.selectAll('.link')
        .data(childLinks)
      .enter().append('line')
        .attr('class', 'link')
        .style('stroke-width', (d) -> Math.sqrt(d.value))

    cellList = []

    size = 0
    for child in children
        cell = g.append('g')
            .attr('class', 'cell')
        cellList.push(cell)

        size += drawState(cell, child) * 3

    r = Math.sqrt(size)

    force = d3.layout.force()
        .charge(-r * 6)
        .linkDistance(r * 1.5)

    force
        .nodes(childNodes)
        .links(childLinks)
        .start()

    force.on 'tick', ->
      link.attr('x1', (d) -> d.source.x)
          .attr('y1', (d) -> d.source.y)
          .attr('x2', (d) -> d.target.x)
          .attr('y2', (d) -> d.target.y)

      for child in children
          cell = cellList[child._idx]
          node = childNodes[child._idx]
          cell.attr('transform', "translate(#{node.x},#{node.y})")
              .attr('cy', node.y)

    return size


demo = (tree) ->
    width = 400
    height = 400

    svg = d3.select('body').append('svg')
        .attr('width', width)
        .attr('height', height)
      .append('g')
        .attr('transform', "translate(#{width/2}, #{height/2})")

    drawChildren(svg, tree)


demo([
    {name: "A", children: [
        {name: "A1", transitions: [{target: "A2"}]},
        {name: "A2", transitions: [{target: "A3"}]},
        {name: "A3", transitions: [{target: "A1"}]},
    ], transitions: [{target: "B"}]},
    {name: "B", children: [
        {name: "B1", transitions: [{target: "B2"}]},
        {name: "B2", transitions: [{target: "B3"}]},
        {name: "B3", transitions: [{target: "B1"}]},
    ], transitions: [{target: "C"}]},
    {name: "C", children: [
        {name: "C1", transitions: [{target: "C2"}]},
        {name: "C2", transitions: [{target: "C3"}]},
        {name: "C3", transitions: [{target: "C1"}]},
    ], transitions: [{target: "A"}]},
])


demo([
    {name: "A", children: [
        {name: "B", children: [
            {name: "C", children: [
                {name: "D", children: [
                    {name: "E"}
                ]}
            ]}
        ]}
    ]}
])


demo([
    {name: "A", children: [
        {name: "B1", children: [
            {name: "C11"}
            {name: "C12"}
        ]}
        {name: "B2", children: [
            {name: "C21"}
            {name: "C22"}
        ]}
    ]}
])


demo([
    {name: "O", children: [
        {name: "A"}
        {name: "B"}
        {name: "C"}
        {name: "D"}
        {name: "E"}
        {name: "F"}
        {name: "X", transitions: [
            {target: "A"}
            {target: "B"}
            {target: "C"}
            {target: "D"}
            {target: "E"}
            {target: "F"}
        ]}
    ]}
])
