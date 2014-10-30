width = 960
height = 500

color = d3.scale.category20()

svg = d3.select('body').append('svg')
    .attr('width', width)
    .attr('height', height)

tree = [
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
]


layout = (g, stateList) ->
    nodes = []
    links = []
    stateMap = {}

    for state in stateList
        state._idx = nodes.length
        stateMap[state.name] = state
        nodes.push({name: state.name})

    for state in stateList
        for tr in state.transitions
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

    force = d3.layout.force()
        .charge(-120)
        .linkDistance(200)

    force
        .nodes(nodes)
        .links(links)
        .start()

    node.append('circle')
        .attr('r', 5)
        .style('fill', (d) -> color(d.group))
        .append('title')
          .text((d) -> d.name)

    force.on 'tick', ->
      link.attr('x1', (d) -> d.source.x)
          .attr('y1', (d) -> d.source.y)
          .attr('x2', (d) -> d.target.x)
          .attr('y2', (d) -> d.target.y)

      node.attr('transform', (d) -> "translate(#{d.x},#{d.y})")
          .attr('cy', (d) -> d.y)


top = svg.append('g')
    .attr('transform', "translate(#{width/2}, #{height/2})")
layout(top, tree)
