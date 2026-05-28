import type { DeviceIdStorage } from './types'

export function getOrCreateDeviceId(storage: DeviceIdStorage): string {
  const existing = storage.get()
  if (existing !== null) return existing
  const id = generateDeviceId()
  storage.set(id)
  return id
}

function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `device-${crypto.randomUUID()}`
  }
  return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
