#!/usr/bin/env node
/**
 * Generate the VAULT_PASSPHRASE_HASH value for .env
 *
 *   node server/hash-passphrase.js 'a long passphrase you will remember'
 *
 * The passphrase itself is never stored anywhere — only this hash.
 */
import { hashPassphrase } from './vault.js'

const passphrase = process.argv.slice(2).join(' ')
if (!passphrase || passphrase.length < 12) {
  console.error('Usage: node server/hash-passphrase.js <passphrase>')
  console.error('The passphrase must be at least 12 characters.')
  process.exit(1)
}
console.log(hashPassphrase(passphrase))
