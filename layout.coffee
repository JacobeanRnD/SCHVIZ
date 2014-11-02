layout = (g, stateList) ->
    nodes = []
    links = []
    stateMap = {}

    for state in stateList
        state._idx = nodes.length
        stateMap[state.name] = state
        nodes.push({name: state.name})

    for state in stateList
        for tr in state.transitions or []
            target = stateMap[tr.target]
            links.push({source: state._idx, target: target._idx})

    link = g.selectAll('.link')
        .data(links)
      .enter().append('line')
        .attr('class', 'link')
        .style('stroke-width', (d) -> Math.sqrt(d.value))

    node = g.selectAll('.node')
        .data(nodes)
      .enter().append('g')
        .attr('class', 'node')

    size = 30
    for state in stateList
        if state.children?
            size += layout(node, state.children)

    force = d3.layout.force()
        .charge(-120)
        .linkDistance(size * 1.3)

    force
        .nodes(nodes)
        .links(links)
        .start()

    node.insert('circle', ':first-child')
        .attr('r', size / 2)
        .append('title')
          .text((d) -> d.name)

    force.on 'tick', ->
      link.attr('x1', (d) -> d.source.x)
          .attr('y1', (d) -> d.source.y)
          .attr('x2', (d) -> d.target.x)
          .attr('y2', (d) -> d.target.y)

      node.attr('transform', (d) -> "translate(#{d.x},#{d.y})")
          .attr('cy', (d) -> d.y)

    node.call(force.drag)

    return size


demo = (tree) ->
    width = 400
    height = 400

    svg = d3.select('body').append('svg')
        .attr('width', width)
        .attr('height', height)
      .append('g')
        .attr('transform', "translate(#{width/2}, #{height/2})")

    layout(svg, tree)


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
