import { describe, it, expect } from 'vitest'
import { getOrCreateDeviceId } from '../src/device'
import type { DeviceIdStorage } from '../src/types'

function makeStorage(initial: string | null = null): DeviceIdStorage & { value: string | null } {
  const store = { value: initial }
  return {
    get value() { return store.value },
    set value(v) { store.value = v },
    get: () => store.value,
    set: (id: string) => { store.value = id },
  }
}

describe('getOrCreateDeviceId', () => {
  it('returns existing id from storage', () => {
    const storage = makeStorage('device-existing-123')
    expect(getOrCreateDeviceId(storage)).toBe('device-existing-123')
  })

  it('creates and stores a new id when storage is empty', () => {
    const storage = makeStorage(null)
    const id = getOrCreateDeviceId(storage)
    expect(id).toMatch(/^device-/)
    expect(storage.value).toBe(id)
  })

  it('returns the same id on subsequent calls', () => {
    const storage = makeStorage(null)
    const id1 = getOrCreateDeviceId(storage)
    const id2 = getOrCreateDeviceId(storage)
    expect(id1).toBe(id2)
  })

  it('generates unique ids for different empty storages', () => {
    const id1 = getOrCreateDeviceId(makeStorage(null))
    const id2 = getOrCreateDeviceId(makeStorage(null))
    expect(id1).not.toBe(id2)
  })
})
