import { appError, databaseError } from './app-error'

export const signedAssetUrl = async (path: string, expiresIn = 900) => {
  const { data, error } = await useSupabaseAdmin().storage.from('assets').createSignedUrl(path, expiresIn)
  if (error) throw databaseError('sign asset URL', error)
  return data.signedUrl
}

export const requireAsset = async (id: string, organizationId: string) => {
  const { data, error } = await useSupabaseAdmin().from('assets')
    .select('*, projects(name), campaigns(name), asset_tags(tags(id,name,slug)), allowed_users!assets_uploaded_by_fkey(id,figma_handle,avatar_url)')
    .eq('id', id).eq('organization_id', organizationId).maybeSingle()
  if (error) throw databaseError('read asset', error)
  if (!data) throw appError(404, 'ASSET_NOT_FOUND', 'Asset not found.')
  return data
}

export const slugify = (value: string) => value.toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
