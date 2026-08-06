import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const base64url = (value: Buffer) => value.toString('base64url')

export const randomToken = (bytes = 32) => base64url(randomBytes(bytes))
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex')
export const pkceChallenge = (verifier: string) => base64url(createHash('sha256').update(verifier).digest())

const encryptionKey = (secret: string) => createHash('sha256').update(secret).digest()

export const encryptSecret = (plaintext: string, secret: string) => {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [base64url(iv), base64url(cipher.getAuthTag()), base64url(encrypted)].join('.')
}

export const decryptSecret = (payload: string, secret: string) => {
  const [iv, tag, encrypted] = payload.split('.')
  if (!iv || !tag || !encrypted) throw new Error('Invalid encrypted value')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')
}
