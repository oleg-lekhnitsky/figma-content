import { getHeader, getRequestURL, sendNoContent, setHeader } from 'h3'

const isAllowedPluginPath = (pathname: string) =>
  pathname.startsWith('/api/plugin/') || pathname === '/api/assets' || pathname.startsWith('/api/assets/') || pathname === '/api/projects'

export default defineEventHandler((event) => {
  const origin = getHeader(event, 'origin')
  const pathname = getRequestURL(event).pathname
  const isPluginRoute = isAllowedPluginPath(pathname)

  // Figma loads a bundled plugin iframe from a data: URL, which browsers expose
  // as the opaque `null` origin. These routes still require a one-time code or
  // application Bearer token; cookies and arbitrary origins are not allowed.
  if (origin !== 'null' || !isPluginRoute) return

  setHeader(event, 'Access-Control-Allow-Origin', 'null')
  setHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  setHeader(event, 'Access-Control-Allow-Headers', 'Authorization, Content-Type')
  setHeader(event, 'Access-Control-Max-Age', 600)
  setHeader(event, 'Vary', 'Origin')

  if (event.method === 'OPTIONS') return sendNoContent(event, 204)
})
