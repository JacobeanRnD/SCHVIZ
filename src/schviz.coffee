SCHVIZ_URL = window.SCHVIZ_URL
delete window.SCHVIZ_URL

FORM =
  """
  loading ...
  <form action="#{SCHVIZ_URL}" method="POST">
    <input type="hidden" name="src">
  </form>
  """

schviz = window.schviz = {}

schviz.visualize = (container, src) ->
  iframe = document.createElement('iframe')
  iframe.setAttribute('style', 'border: none; width: 100%; height: 100%;')
  container.appendChild(iframe)
  doc = iframe.contentDocument
  doc.querySelector('body').innerHTML = FORM
  doc.querySelector('input').value = src
  doc.querySelector('form').submit()
