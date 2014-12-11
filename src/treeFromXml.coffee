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


module.exports = (doc) ->
  parseActions = (container) ->
    rv = []
    for child in container.childNodes
      if child.tagName
        rv.push(xml: '' + child)
    return rv

  parseChildNodes = (node) ->
    transitions = []
    onentry = []
    onexit = []

    for child in node.childNodes
      switch child.tagName
        when 'transition'
          target = child.getAttribute('target')
          unless target
            throw new Error("not implemented: transition with no target")
          if target.indexOf(' ') > -1
            throw new Error("not implemented: transition with multiple targets")
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
