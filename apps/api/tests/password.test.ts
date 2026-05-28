import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../src/utils/password.js'

describe('hashPassword', () => {
  it('produces a bcrypt hash different from the input', async () => {
    const hash = await hashPassword('secret123')
    expect(hash).not.toBe('secret123')
    expect(hash.startsWith('$2a$')).toBe(true)
  })

  it('produces different hashes for the same input', async () => {
    const hash1 = await hashPassword('secret123')
    const hash2 = await hashPassword('secret123')
    expect(hash1).not.toBe(hash2)
  })
})

describe('verifyPassword', () => {
  it('returns true for correct password', async () => {
    const hash = await hashPassword('mypassword')
    expect(await verifyPassword('mypassword', hash)).toBe(true)
  })

  it('returns false for wrong password', async () => {
    const hash = await hashPassword('mypassword')
    expect(await verifyPassword('wrongpassword', hash)).toBe(false)
  })
})
