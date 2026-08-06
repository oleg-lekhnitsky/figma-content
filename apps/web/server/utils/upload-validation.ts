export const uploadMimeTypes = ['image/png', 'image/jpeg'] as const
export type UploadMimeType = (typeof uploadMimeTypes)[number]

export const isAllowedUploadMime = (value: string): value is UploadMimeType =>
  uploadMimeTypes.some(type => type === value)

export const expectedSharpFormat = (mimeType: UploadMimeType) => mimeType === 'image/png' ? 'png' : 'jpeg'
