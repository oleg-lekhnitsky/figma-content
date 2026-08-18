export const toTitleCase = (value: string) => value
  .trim()
  .replace(/(^|[\s–—/-])([\p{L}\p{N}])/gu, (_, separator: string, character: string) => `${separator}${character.toLocaleUpperCase()}`)
