'use client'

import { useState, useRef, useEffect } from 'react'
import type { WatchlistItem } from '@mywatch/core'
import { useUpsertItem, useSoftDeleteItem } from '@/hooks/useWatchlist'
import { CARD_META_LABELS } from '@/hooks/useSettings'

export function CardMenu({ item, globalSettings }: { item: WatchlistItem; globalSettings: Record<string, boolean> }) {
  const [open, setOpen] = useState(false)
  const [showSub, setShowSub] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const upsertItem = useUpsertItem()
  const deleteItem = useSoftDeleteItem()

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowSub(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const overrides = item.displayOverrides ?? {}

  const toggleOverride = async (key: string) => {
    const currentValue = overrides[key] ?? globalSettings[key] ?? false
    const newValue = !currentValue
    const newOverrides = { ...overrides, [key]: newValue }
    await upsertItem({
      ...item,
      displayOverrides: newOverrides,
    })
  }

  const handleRemove = async () => {
    if (confirm('Are you sure you want to remove this item?')) {
      await deleteItem(item.id)
    }
  }

  const flags = Object.keys(CARD_META_LABELS)

  return (
    <div className="absolute bottom-[6px] right-[6px] z-50">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
          if (open) setShowSub(false)
        }}
        className="w-[24px] h-[24px] rounded-[4px] flex items-center justify-center transition-colors hover:bg-[rgba(255,255,255,0.2)]"
        style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 bottom-[28px] rounded-[8px] py-1 min-w-[160px]"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 24px rgba(0,0,0,.4)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {!showSub ? (
            <>
              <button
                onClick={() => setShowSub(true)}
                className="w-full text-left px-3 py-1.5 text-[var(--text-12)] transition-colors hover:bg-[var(--surface2)] flex items-center justify-between"
                style={{ color: 'var(--fg)' }}
              >
                <span>Show</span>
                <span>▶</span>
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <button
                onClick={handleRemove}
                className="w-full text-left px-3 py-1.5 text-[var(--text-12)] transition-colors hover:bg-[var(--surface2)]"
                style={{ color: 'var(--red)' }}
              >
                Remove
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowSub(false)}
                className="w-full text-left px-3 py-1.5 text-[var(--text-12)] transition-colors hover:bg-[var(--surface2)] flex items-center gap-2"
                style={{ color: 'var(--muted)', fontWeight: 'bold' }}
              >
                <span>◀</span> Back
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <div className="flex flex-col">
                {flags.map((key) => {
                  const isActive = overrides[key] ?? globalSettings[key] ?? false
                  return (
                    <button
                      key={key}
                      onClick={() => toggleOverride(key)}
                      className="w-full text-left px-3 py-1.5 text-[var(--text-12)] transition-colors hover:bg-[var(--surface2)] flex items-center justify-between"
                      style={{ color: 'var(--fg)' }}
                    >
                      <span>{CARD_META_LABELS[key as keyof typeof CARD_META_LABELS]}</span>
                      {isActive && <span style={{ color: 'var(--accent2)' }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
