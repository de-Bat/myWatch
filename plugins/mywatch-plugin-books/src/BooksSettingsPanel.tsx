import { useState } from 'react'
import type { PluginSettingsProps } from '@mywatch/plugin-sdk'
import { getStoreUrl, setStoreUrl } from './utils'

export function BooksSettingsPanel(_props: PluginSettingsProps) {
  const [url, setUrl] = useState(() => getStoreUrl())
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    if (url.trim()) {
      try {
        new URL(url.trim())
      } catch {
        setError('Enter a valid URL (include https://)')
        return
      }
    }
    setError(null)
    setStoreUrl(url.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label
          className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase"
          style={{ color: 'var(--muted2)' }}
        >
          Local Bookstore Search URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setSaved(false); setError(null) }}
          placeholder="https://myfavoritebookstore.com/search"
          className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
        />
        <p className="text-[var(--text-11)]" style={{ color: 'var(--muted2)' }}>
          Plugin appends <code>?q=title+author</code> to this URL. Leave empty to hide store links.
        </p>
        {error && (
          <p className="text-[var(--text-11)]" style={{ color: 'var(--red)' }}>{error}</p>
        )}
      </div>
      <button
        onClick={handleSave}
        className="self-start px-4 py-2 rounded-[6px] text-[var(--text-13)] font-medium border-none cursor-pointer"
        style={{ background: 'var(--accent)', color: '#fff', opacity: saved ? 0.7 : 1 }}
      >
        {saved ? 'Saved!' : 'Save'}
      </button>
    </div>
  )
}
