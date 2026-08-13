export const uploadMimeTypes = ['image/png', 'image/jpeg', 'video/mp4'] as const
export type UploadMimeType = (typeof uploadMimeTypes)[number]

export const isAllowedUploadMime = (value: string): value is UploadMimeType =>
  uploadMimeTypes.some(type => type === value)

export const expectedSharpFormat = (mimeType: Exclude<UploadMimeType, 'video/mp4'>) => mimeType === 'image/png' ? 'png' : 'jpeg'

export const isVideoUploadMime = (mimeType: UploadMimeType): mimeType is 'video/mp4' => mimeType === 'video/mp4'
export const isValidMp4 = (data: Uint8Array) => data.byteLength >= 12 && String.fromCharCode(...data.slice(4, 8)) === 'ftyp'
