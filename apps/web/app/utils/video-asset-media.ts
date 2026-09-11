import type { AssetMasonryItem } from '../types/asset-masonry'

// Keep requests same-origin for canvas export, but distinguish replaced files.
export const videoAssetMediaUrl = (asset: AssetMasonryItem, variant: 'preview2x' | 'preview' | 'original') => {
  const resources = [asset.previewUrl, asset.preview2xUrl, asset.originalUrl].map(value => {
    if (!value) return ''
    const url = new URL(value, 'http://local')
    // Signed URL credentials can rotate without the underlying file changing.
    return url.pathname + (url.searchParams.get('_refresh') ?? '')
  })
  const revision = JSON.stringify([asset.version, asset.updated_at, ...resources])
  return `/api/assets/${encodeURIComponent(asset.id)}/media?variant=${variant}&revision=${encodeURIComponent(revision)}`
}
