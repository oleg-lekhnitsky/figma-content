import { describe, expect, it } from 'vitest'
import { videoAssetMediaUrl } from './video-asset-media'

const asset = {
  id: 'asset-1', title: 'Asset', width: 100, height: 100,
  previewUrl: 'https://storage.example/assets/versions/1/preview.jpg?token=old',
  originalUrl: 'https://storage.example/assets/versions/1/original.mp4?token=old'
}

describe('video editor media URLs', () => {
  it('invalidates every media variant when an asset is replaced', () => {
    const replacement = { ...asset, originalUrl: asset.originalUrl.replace('/1/', '/2/') }
    for (const variant of ['preview2x', 'preview', 'original'] as const) {
      const previous = videoAssetMediaUrl(asset, variant)
      const next = videoAssetMediaUrl(replacement, variant)
      expect(next).not.toBe(previous)
      expect(next.startsWith(`/api/assets/asset-1/media?variant=${variant}&`)).toBe(true)
    }
  })

  it('keeps the cache when only storage credentials rotate', () => {
    expect(videoAssetMediaUrl({ ...asset, previewUrl: asset.previewUrl.replace('token=old', 'token=new') }, 'preview'))
      .toBe(videoAssetMediaUrl(asset, 'preview'))
    expect(videoAssetMediaUrl(asset, 'original')).not.toContain('token')
  })

  it('invalidates fallback media URLs on version changes and forced refresh', () => {
    const fallback = { ...asset, previewUrl: '/api/assets/asset-1/media?variant=preview', originalUrl: undefined, version: 1 }
    const previous = videoAssetMediaUrl(fallback, 'original')
    expect(videoAssetMediaUrl({ ...fallback, version: 2 }, 'original')).not.toBe(previous)
    expect(videoAssetMediaUrl({ ...fallback, previewUrl: `${fallback.previewUrl}&_refresh=new` }, 'original')).not.toBe(previous)
  })
})
