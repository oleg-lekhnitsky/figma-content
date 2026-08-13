import type { ControllerMessage, SelectedFrame, UiMessage } from './messages'

figma.showUI(__html__, { width: 420, height: 680, themeColors: true })

type ExportableNode = FrameNode | ComponentNode | InstanceNode

const exportWithoutFrameMask = async (node: ExportableNode, settings: ExportSettings) => {
  const clone = node.clone()
  try {
    // Export the selected frame as a flat canvas: its children may overflow and
    // the frame itself must not round the uploaded image. The source node stays
    // untouched, so the user never sees its design change during export.
    clone.clipsContent = false
    clone.cornerRadius = 0
    clone.x = -100000 - clone.width
    clone.y = -100000 - clone.height
    return await clone.exportAsync(settings)
  } finally {
    clone.remove()
  }
}

const selectedNodes = () => {
  const nodes: ExportableNode[] = []
  for (const node of figma.currentPage.selection) {
    if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') nodes.push(node)
    else if (node.type === 'SECTION') {
      for (const child of node.children) {
        if (child.type === 'FRAME' || child.type === 'COMPONENT' || child.type === 'INSTANCE') nodes.push(child)
      }
    }
  }
  return nodes
}
const pageName = (node: BaseNode) => {
  let current: BaseNode | null = node
  while (current && current.type !== 'PAGE') current = current.parent
  return current?.type === 'PAGE' ? current.name : figma.currentPage.name
}
const describe = async (node: ExportableNode): Promise<SelectedFrame> => {
  const previewScale = Math.min(.5, 360 / Math.max(node.width, node.height))
  const preview = await exportWithoutFrameMask(node, { format: 'PNG', constraint: { type: 'SCALE', value: Math.max(.05, previewScale) } })
  const fileKey = figma.fileKey ?? null
  return { id: node.id, name: node.name, width: Math.round(node.width), height: Math.round(node.height), pageName: pageName(node), fileKey, figmaUrl: fileKey ? `https://www.figma.com/design/${fileKey}/_?node-id=${encodeURIComponent(node.id)}` : null, assetId: node.getPluginData('contentLibraryAssetId') || null, preview }
}
const postSelection = async () => {
  const frames = await Promise.all(selectedNodes().map(describe))
  const message: ControllerMessage = { type: 'selection', frames }
  figma.ui.postMessage(message)
}

figma.on('selectionchange', () => { void postSelection() })
void postSelection()

figma.ui.onmessage = async (message: UiMessage) => {
  if (message.type === 'refresh-selection') return postSelection()
  if (message.type === 'open-external') return figma.openExternal(message.url)
  if (message.type === 'resize') return figma.ui.resize(420, Math.max(520, Math.min(800, message.height)))
  if (message.type === 'load-state') return figma.ui.postMessage({
    type: 'stored-state',
    value: await figma.clientStorage.getAsync('contentLibraryPreferences'),
    sessionToken: await figma.clientStorage.getAsync('contentLibrarySession') ?? null
  } satisfies ControllerMessage)
  if (message.type === 'save-state') return figma.clientStorage.setAsync('contentLibraryPreferences', message.value)
  if (message.type === 'save-session') {
    if (message.token) return figma.clientStorage.setAsync('contentLibrarySession', message.token)
    return figma.clientStorage.deleteAsync('contentLibrarySession')
  }
  if (message.type === 'bind-asset') {
    const node = await figma.getNodeByIdAsync(message.nodeId)
    if (node && 'setPluginData' in node) node.setPluginData('contentLibraryAssetId', message.assetId)
    return
  }
  if (message.type === 'export') {
    const node = await figma.getNodeByIdAsync(message.nodeId)
    if (!node || (node.type !== 'FRAME' && node.type !== 'COMPONENT' && node.type !== 'INSTANCE')) return figma.ui.postMessage({ type: 'export-result', requestId: message.requestId, nodeId: message.nodeId, error: 'This layer is no longer available.' } satisfies ControllerMessage)
    try {
      const bytes = await exportWithoutFrameMask(node, { format: 'PNG', constraint: { type: 'SCALE', value: message.settings.scale } })
      figma.ui.postMessage({ type: 'export-result', requestId: message.requestId, nodeId: message.nodeId, bytes } satisfies ControllerMessage)
    } catch {
      figma.ui.postMessage({ type: 'export-result', requestId: message.requestId, nodeId: message.nodeId, error: 'Unable to export this frame.' } satisfies ControllerMessage)
    }
  }
}
