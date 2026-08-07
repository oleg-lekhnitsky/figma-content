export interface AssetMasonryItem {
  id: string
  title: string
  description?: string | null
  previewUrl: string
  preview2xUrl?: string | null
  width: number
  height: number
  status?: string
  figma_url?: string
  created_at?: string
  projects?: { name: string } | null
  asset_tags?: Array<{ tags: { name: string } | null }>
}
