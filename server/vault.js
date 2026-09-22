/**
 * Encrypted credential store.
 *
 * The provider API key is the only real secret this system holds, and it is
 * worth money to whoever steals it. Three rules follow from that:
 *
 *   1. It is encrypted at rest with AES-256-GCM under a key that lives in the
 *      environment, not in the repository and not in the data directory. A
 *      stolen backup of ./data is therefore inert.
 *   2. It is never sent back to any browser. The console shows the provider,
 *      the model and the last four characters — enough to tell two keys apart,
 *      not enough to use one.
 *   3. The file is written 0600 via a temp-file rename, so a crash mid-write
 *      cannot leave a half-written vault behind.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, chmodSync } from 'node:fs'
import { join } from 'node:path'

const ALGO = 'aes-256-gcm'

export class Vault {
  constructor({ dataDir, masterKeyHex }) {
    this.dir = dataDir
    this.file = join(dataDir, 'vault.enc')
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true, mode: 0o700 })

    if (!masterKeyHex || !/^[0-9a-f]{64}$/i.test(masterKeyHex)) {
      this.masterKey = null
      this.reason = 'VAULT_MASTER_KEY is missing or is not 64 hex characters'
    } else {
      this.masterKey = Buffer.from(masterKeyHex, 'hex')
      this.reason = null
    }
  }

  get usable() { return this.masterKey !== null }

  #encrypt(plaintext) {
    const iv = randomBytes(12)
    const cipher = createCipheriv(ALGO, this.masterKey, iv)
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return `${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`
  }

  #decrypt(blob) {
    const [ivB64, tagB64, ctB64] = String(blob).split('.')
    if (!ivB64 || !tagB64 || !ctB64) throw new Error('malformed ciphertext')
    const decipher = createDecipheriv(ALGO, this.masterKey, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8')
  }

  /** Full record including the plaintext key. Server-side callers only. */
  read() {
    if (!this.usable || !existsSync(this.file)) return null
    try {
      const raw = JSON.parse(readFileSync(this.file, 'utf8'))
      return {
        provider: raw.provider,
        model: raw.model,
        apiKey: this.#decrypt(raw.key),
        updatedAt: raw.updatedAt,
        keyLast4: raw.keyLast4,
      }
    } catch {
      // A vault that cannot be decrypted (rotated master key, corrupt file) is
      // treated as absent rather than fatal: the app degrades to demo mode.
      return null
    }
  }

  /** Safe projection for the admin console — never contains the key. */
  status() {
    if (!this.usable) return { configured: false, blocked: true, reason: this.reason }
    const rec = this.read()
    if (!rec) return { configured: false, blocked: false }
    return {
      configured: true,
      blocked: false,
      provider: rec.provider,
      model: rec.model,
      keyLast4: rec.keyLast4,
      updatedAt: rec.updatedAt,
    }
  }

  write({ provider, model, apiKey }) {
    if (!this.usable) throw new Error(this.reason)
    const payload = JSON.stringify({
      provider,
      model,
      key: this.#encrypt(apiKey),
      keyLast4: apiKey.slice(-4),
      updatedAt: new Date().toISOString(),
    })
    const tmp = `${this.file}.${randomBytes(6).toString('hex')}.tmp`
    writeFileSync(tmp, payload, { mode: 0o600 })
    renameSync(tmp, this.file)
    chmodSync(this.file, 0o600)
  }

  clear() {
    if (existsSync(this.file)) writeFileSync(this.file, '', { mode: 0o600 })
  }
}

// ── Passphrase hashing ──────────────────────────────────────────────────────
// scrypt with a per-hash salt. N=2^15 costs roughly 100 ms here, which is
// irrelevant for a human typing a passphrase once and expensive for anyone
// grinding the hash offline.
const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 64 }

export function hashPassphrase(passphrase) {
  const salt = randomBytes(16)
  const dk = scryptSync(passphrase, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 128 * 1024 * 1024 })
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${dk.toString('base64')}`
}

export function verifyPassphrase(passphrase, stored) {
  try {
    const [scheme, N, r, p, saltB64, dkB64] = String(stored).split('$')
    if (scheme !== 'scrypt') return false
    const salt = Buffer.from(saltB64, 'base64')
    const expected = Buffer.from(dkB64, 'base64')
    const actual = scryptSync(passphrase, salt, expected.length, {
      N: Number(N), r: Number(r), p: Number(p), maxmem: 128 * 1024 * 1024,
    })
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
