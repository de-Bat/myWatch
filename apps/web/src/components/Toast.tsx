'use client'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'

export type ToastVariant = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
  duration: number
}

type ToastCtx = {
  toast: (message: string, variant?: ToastVariant, duration?: number) => void
}

const Ctx = createContext<ToastCtx>({ toast: () => {} })

export function useToast() {
  return useContext(Ctx)
}

const VARIANT_STYLES: Record<ToastVariant, { background: string; color: string }> = {
  success: { background: 'var(--green)', color: '#fff' },
  error: { background: 'var(--red)', color: '#fff' },
  info: { background: 'var(--surface2)', color: 'var(--fg)' },
}

function ToastBubble({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: (id: string) => void
}) {
  useEffect(() => {
    if (item.duration === 0) return
    const t = setTimeout(() => onDismiss(item.id), item.duration)
    return () => clearTimeout(t)
  }, [item.id, item.duration, onDismiss])

  return (
    <div
      style={{
        ...VARIANT_STYLES[item.variant],
        padding: '8px 14px',
        borderRadius: 8,
        fontSize: 'var(--text-13)',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,.4)',
        pointerEvents: 'auto',
        whiteSpace: 'nowrap',
      }}
    >
      {item.message}
      {item.duration === 0 && (
        <button
          onClick={() => onDismiss(item.id)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'inherit',
            fontSize: 'var(--text-17)',
            lineHeight: 1,
            padding: '0 2px',
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'success', duration?: number) => {
      const id = Math.random().toString(36).slice(2)
      const defaultDuration = variant === 'error' ? 0 : 3000
      setToasts((prev) => [...prev.slice(-2), { id, message, variant, duration: duration ?? defaultDuration }])
    },
    [],
  )

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          {toasts.map((t) => (
            <ToastBubble key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </Ctx.Provider>
  )
}
