walk = (state, callback, parent=null) ->
    callback(state, parent)
    for child in state.children or []
        walk(child, callback, state)


drawTree = (svg, tree) ->
    topNodes = []
    nodes = []
    nodeMap = {}
    links = []

    for topState in tree
        walk topState, (state, parent) ->
            node = {
                name: state.name
                width: 40
                height: 40
                children: []
            }
            nodes.push(node)
            nodeMap[state.name] = node
            if parent?
                parentNode = nodeMap[parent.name]
                node.parent = parentNode
                parentNode.children.push(node)
            else
                topNodes.push(node)

    for topState in tree
        walk topState, (state) ->
            for tr in state.transitions or []
                links.push(
                    source: nodeMap[state.name]
                    target: nodeMap[tr.target]
                )

    cell = svg.selectAll('.cell')
        .data(nodes)
      .enter().append('g')
        .attr('class', 'cell')

    cell.append('rect')
        .attr('class', 'border')
        .attr('x', (node) -> - node.width / 2)
        .attr('y', (node) -> - node.height / 2)
        .attr('width', (node) -> node.width)
        .attr('height', (node) -> node.height)
        .attr('rx', 5)
        .attr('ry', 5)

    cell.append('text')
        .text((node) -> node.name)

    link = svg.selectAll('.link')
        .data(links)
      .enter().append('line')
        .attr('class', 'link')

    force = d3.layout.force()
        .charge(0)
        .nodes(nodes)
        .start()

    svg.selectAll('.cell')
        .call(force.drag)

    force.on 'tick', ->
        for node in nodes
            if node.children.length > 0
                xMin = d3.min(node.children, (d) -> d.x - d.width / 2) - 5
                xMax = d3.max(node.children, (d) -> d.x + d.width / 2) + 5
                yMin = d3.min(node.children, (d) -> d.y - d.height / 2) - 5
                yMax = d3.max(node.children, (d) -> d.y + d.height / 2) + 5
                node.width = xMax - xMin
                node.height = yMax - yMin
                dx = xMin + node.width / 2 - node.x
                dy = yMin + node.height / 2 - node.y
                node.x += dx
                node.y += dy
                if node.fixed
                    move(node, -dx, -dy)

        for node in nodes
            doCollisions(node.children)

        doCollisions(topNodes)

        svg.selectAll('.cell')
            .attr('transform', (node) -> "translate(#{node.x},#{node.y})")

        svg.selectAll('.cell rect')
            .attr('x', (node) -> - node.width / 2)
            .attr('y', (node) -> - node.height / 2)
            .attr('width', (node) -> node.width)
            .attr('height', (node) -> node.height)

        link.attr('x1', (d) -> d.source.x)
            .attr('y1', (d) -> d.source.y)
            .attr('x2', (d) -> d.target.x)
            .attr('y2', (d) -> d.target.y)


doCollisions = (children) ->
    if children.length
        q = d3.geom.quadtree(children)
        for child in children
            q.visit(collide(child))


move = (node, dx, dy) ->
    node.x += dx
    node.y += dy
    for child in node.children
        move(child, dx, dy)


collide = (node) ->
    r = node.radius + 50
    nx1 = node.x - r
    nx2 = node.x + r
    ny1 = node.y - r
    ny2 = node.y + r

    fn = (quad, x1, y1, x2, y2) ->
        other = quad.point
        if other and (other != node)
            dx = node.x - other.x
            dy = node.y - other.y
            l = Math.sqrt(dx * dx + dy * dy)
            r = d3.max([node.width + other.width, node.height + other.height]) / 2
            if l < r  # found a collision
                l = (l - r) / l * .5
                move(node, - dx * l, - dy * l)
                move(other, dx * l, dy * l)
        return x1 > nx2 or x2 < nx1 or y1 > ny2 or y2 < ny1

    return fn


demo = (tree) ->
    width = 400
    height = 400

    svg = d3.select('body').append('svg')
        .attr('width', width)
        .attr('height', height)
      .append('g')
        .attr('transform', "translate(#{width/2}, #{height/2})")

    drawTree(svg, tree)


demo([
    {name: "A"}
    {name: "B"}
    {name: "C"}
    {name: "D"}
    {name: "E"}
    {name: "F"}
])


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
