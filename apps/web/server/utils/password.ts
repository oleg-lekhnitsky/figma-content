import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto'

const keyLength = 64
const cost = 16_384
const blockSize = 8
const parallelization = 1

const scrypt = (password: string, salt: Buffer) => new Promise<Buffer>((resolve, reject) => {
  nodeScrypt(password, salt, keyLength, { N: cost, r: blockSize, p: parallelization, maxmem: 64 * 1024 * 1024 }, (error, key) => {
    if (error) reject(error)
    else resolve(key)
  })
})

export const hashPassword = async (password: string) => {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt)
  return `scrypt$${cost}$${blockSize}$${parallelization}$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

export const verifyPassword = async (password: string, encoded: string) => {
  const [algorithm, n, r, p, saltValue, hashValue] = encoded.split('$')
  if (algorithm !== 'scrypt' || !n || !r || !p || !saltValue || !hashValue) return false
  if (Number(n) !== cost || Number(r) !== blockSize || Number(p) !== parallelization) return false
  const expected = Buffer.from(hashValue, 'base64url')
  const actual = await scrypt(password, Buffer.from(saltValue, 'base64url'))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
