import type { ControllerMessage, ExportSettings as PluginExportSettings, SelectedFrame, UiMessage } from './messages'

const run = async () => {

type ExportableNode = FrameNode | ComponentNode | InstanceNode

const findVideoHash = (node: ExportableNode) => {
  const candidates: SceneNode[] = [node, ...node.findAll()]
  for (const candidate of candidates) {
    if (!('fills' in candidate) || !Array.isArray(candidate.fills)) continue
    for (const paint of candidate.fills) {
      if (paint.type === 'VIDEO' && paint.videoHash) return paint.videoHash
    }
  }
  return null
}

const exportWithoutFrameRadius = async (node: ExportableNode, settings: PluginExportSettings) => {
  if (settings.format === 'MP4') throw new Error('Embedded videos are downloaded through the library server.')
  const clone = node.clone()
  try {
    // Remove only the frame radius while preserving its clipping behavior. The
    // source node stays untouched, so the user never sees its design change.
    clone.cornerRadius = 0
    clone.x = -100000 - clone.width
    clone.y = -100000 - clone.height
    return await clone.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: settings.scale } })
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
  const clone = node.clone()
  let preview: Uint8Array
  try {
    clone.cornerRadius = 0
    clone.x = -100000 - clone.width
    clone.y = -100000 - clone.height
    preview = await clone.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: Math.max(.05, previewScale) } })
  } finally {
    clone.remove()
  }
  const fileKey = figma.fileKey ?? null
  return { id: node.id, name: node.name, width: Math.round(node.width), height: Math.round(node.height), pageName: pageName(node), fileKey, figmaUrl: fileKey ? `https://www.figma.com/design/${fileKey}/_?node-id=${encodeURIComponent(node.id)}` : null, assetId: null, videoHash: findVideoHash(node), preview }
}
const postSelection = async () => {
  const frames = await Promise.all(selectedNodes().map(describe))
  const message: ControllerMessage = { type: 'selection', frames }
  figma.ui.postMessage(message)
}

const preferences = await figma.clientStorage.getAsync('contentLibraryPreferences') as { layout?: unknown } | null
const sessionToken = await figma.clientStorage.getAsync('contentLibrarySession')
const startsAsWidget = preferences?.layout === 'widget' && Boolean(sessionToken)
const selectionCount = selectedNodes().length
const widgetHeight = selectionCount > 0 ? 110 + (selectionCount - 1) * 57 : 231
const compactHeight = !sessionToken ? 281 : selectionCount === 0 ? 300 : 460
figma.showUI(__html__, {
  width: startsAsWidget ? 260 : 320,
  height: startsAsWidget ? widgetHeight : compactHeight,
  themeColors: true
})

figma.on('selectionchange', () => { void postSelection() })
void postSelection()

figma.ui.onmessage = async (message: UiMessage) => {
  if (message.type === 'refresh-selection') return postSelection()
  if (message.type === 'open-external') return figma.openExternal(message.url)
  if (message.type === 'resize') {
    const width = Math.max(260, Math.min(320, message.width))
    const minHeight = width <= 260 ? 120 : 240
    return figma.ui.resize(width, Math.max(minHeight, Math.min(800, message.height)))
  }
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
  if (message.type === 'export') {
    const node = await figma.getNodeByIdAsync(message.nodeId)
    if (!node || (node.type !== 'FRAME' && node.type !== 'COMPONENT' && node.type !== 'INSTANCE')) return figma.ui.postMessage({ type: 'export-result', requestId: message.requestId, nodeId: message.nodeId, error: 'This layer is no longer available.' } satisfies ControllerMessage)
    try {
      const bytes = await exportWithoutFrameRadius(node, message.settings)
      figma.ui.postMessage({ type: 'export-result', requestId: message.requestId, nodeId: message.nodeId, bytes } satisfies ControllerMessage)
    } catch (error) {
      const detail = typeof error === 'object' && error && 'message' in error ? String(error.message) : String(error)
      figma.ui.postMessage({ type: 'export-result', requestId: message.requestId, nodeId: message.nodeId, error: detail && detail !== '[object Object]' ? detail : 'Unable to export this frame.' } satisfies ControllerMessage)
    }
  }
}

}

void run()
