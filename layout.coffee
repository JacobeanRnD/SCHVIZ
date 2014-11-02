drawState = (cell, state) ->
    node = {
        name: state.name
        cell: cell
        children: []
    }

    if state.children?
        g = cell.append('g').attr('class', 'children')
        node.children = drawChildren(g, state.children)

    r = 20

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

    return node


drawChildren = (g, childStates) ->
    children = []
    childMap = {}

    linkGroup = g.append('g').attr('class', 'linkGroup')

    links = []

    for state in childStates
        cell = g.append('g').attr('class', 'cell')
        child = drawState(cell, state)
        child._idx = children.length
        children.push(child)
        childMap[child.name] = child

    for child in children
        for tr in state.transitions or []
            target = childMap[tr.target]
            links.push({source: child._idx, target: target._idx})

    link = linkGroup
        .selectAll('.link')
        .data(links)
      .enter().append('line')
        .attr('class', 'link')
        .style('stroke-width', (d) -> Math.sqrt(d.value))

    r = 10

    force = d3.layout.force()
        .charge(-r * 6)
        .linkDistance(r * 1.5)

    force
        .nodes(children)
        .links(links)
        .start()

    force.on 'tick', ->
      link.attr('x1', (d) -> d.source.x)
          .attr('y1', (d) -> d.source.y)
          .attr('x2', (d) -> d.target.x)
          .attr('y2', (d) -> d.target.y)

      for node in children
          node.cell.attr('transform', "translate(#{node.x},#{node.y})")

    return children


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
