'use client'
import { useState } from 'react'
import type { ReactNode } from 'react'

export function Tooltip({ content, children }: { content: string; children?: ReactNode }) {
  const [visible, setVisible] = useState(false)
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children ?? (
        <span
          className="inline-flex items-center justify-center rounded-full cursor-default select-none flex-shrink-0"
          style={{
            width: 14,
            height: 14,
            background: 'var(--surface2)',
            color: 'var(--muted2)',
            border: '1px solid var(--border2)',
            fontSize: 9,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          ?
        </span>
      )}
      {visible && (
        <div
          className="absolute bottom-[calc(100%+5px)] left-1/2 -translate-x-1/2 px-[10px] py-[6px] rounded-[6px] pointer-events-none z-[100]"
          style={{
            background: 'rgba(0,0,0,.85)',
            color: '#fff',
            fontSize: 11,
            lineHeight: 1.45,
            backdropFilter: 'blur(6px)',
            minWidth: 140,
            maxWidth: 220,
            textAlign: 'center',
            whiteSpace: 'normal',
          }}
        >
          {content}
        </div>
      )}
    </span>
  )
}
