import { useState, useEffect, useRef } from 'react'
import type { AddItemModalProps } from '@mywatch/plugin-sdk'
import { searchBooks } from './utils'

interface BookMetadata {
  openLibraryKey: string
  title: string
  author: string
  coverUrl?: string
  year?: number
  isbn?: string
  description?: string
}

function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--muted2)' }}>
      <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
    </svg>
  )
}

export function AddBooksItemModal({ playlistId, onClose, onAdded }: AddItemModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookMetadata[]>([])
  const [selected, setSelected] = useState<BookMetadata | null>(null)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualAuthor, setManualAuthor] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus()
  }, [])

  async function handleSearch() {
    if (!query.trim()) return
    setError(null)
    setSearching(true)
    setResults([])
    setSelected(null)
    try {
      const hits = await searchBooks(query)
      if (hits.length === 0) {
        setError('No results found. Add manually below.')
        setManualMode(true)
      } else {
        setResults(hits)
      }
    } catch {
      setError('Search failed. Check connection or add manually.')
      setManualMode(true)
    } finally {
      setSearching(false)
    }
  }

  async function handleAdd() {
    if (manualMode) {
      if (!manualTitle.trim() || !manualAuthor.trim()) {
        setError('Title and author required')
        return
      }
      setSaving(true)
      const now = new Date().toISOString()
      await onAdded({
        id: crypto.randomUUID(),
        pluginId: 'books',
        listTypeId: 'books',
        playlistId,
        data: { title: manualTitle.trim(), author: manualAuthor.trim(), read: false },
        addedAt: now,
        updatedAt: now,
        deletedAt: null,
      })
      setSaving(false)
      onClose()
      return
    }
    if (!selected) return
    setSaving(true)
    const now = new Date().toISOString()
    await onAdded({
      id: crypto.randomUUID(),
      pluginId: 'books',
      listTypeId: 'books',
      playlistId,
      data: {
        title: selected.title,
        author: selected.author,
        coverUrl: selected.coverUrl,
        year: selected.year,
        isbn: selected.isbn,
        description: selected.description,
        openLibraryKey: selected.openLibraryKey,
        read: false,
      },
      addedAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    setSaving(false)
    onClose()
  }

  const canAdd = manualMode ? (manualTitle.trim().length > 0 && manualAuthor.trim().length > 0) : selected !== null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-t-[16px] sm:rounded-[12px] flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', maxHeight: '85vh', overflow: 'hidden' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border2)', flexShrink: 0 }}
        >
          <h2 className="text-[var(--text-15)] font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.02em' }}>
            Add Book
          </h2>
          <button
            onClick={onClose}
            className="w-[28px] h-[28px] flex items-center justify-center rounded-full transition-all duration-100 border-none cursor-pointer"
            style={{ background: 'var(--surface2)', color: 'var(--muted)' }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto">
          {!manualMode && (
            <div className="flex flex-col gap-2">
              <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
                Search by title, author, or ISBN
              </label>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch() }}
                  placeholder="e.g. Dune, Frank Herbert, 978…"
                  className="flex-1 px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
                <button
                  onClick={() => void handleSearch()}
                  disabled={searching || !query.trim()}
                  className="px-3 py-2 rounded-[6px] text-[var(--text-12)] font-medium border-none cursor-pointer disabled:opacity-50"
                  style={{ background: 'var(--surface2)', color: 'var(--muted)' }}
                >
                  {searching ? '…' : 'Search'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-[var(--text-11)]" style={{ color: 'var(--red)' }}>{error}</p>
          )}

          {/* Search results */}
          {results.length > 0 && !manualMode && (
            <div className="flex flex-col gap-1">
              <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
                Results
              </label>
              {results.map((book) => (
                <button
                  key={book.openLibraryKey}
                  onClick={() => setSelected(book)}
                  className="flex gap-3 rounded-[8px] text-left border-none cursor-pointer transition-all duration-100"
                  style={{
                    background: selected?.openLibraryKey === book.openLibraryKey ? 'var(--surface2)' : 'transparent',
                    border: `1px solid ${selected?.openLibraryKey === book.openLibraryKey ? 'var(--accent)' : 'var(--border2)'}`,
                    padding: '8px 10px',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 52,
                      flexShrink: 0,
                      borderRadius: 3,
                      overflow: 'hidden',
                      background: 'var(--surface2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <BookIcon />
                    )}
                  </div>
                  <div className="min-w-0 flex flex-col gap-[2px] justify-center">
                    <p
                      className="text-[var(--text-13)] font-medium leading-[1.3]"
                      style={{ color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {book.title}
                    </p>
                    <p className="text-[var(--text-11h)]" style={{ color: 'var(--muted2)' }}>
                      {book.author}{book.year ? ` · ${book.year}` : ''}
                    </p>
                  </div>
                </button>
              ))}
              <button
                onClick={() => { setManualMode(true); setResults([]) }}
                className="text-[var(--text-11)] text-left border-none bg-transparent cursor-pointer mt-1"
                style={{ color: 'var(--muted)', textDecoration: 'underline' }}
              >
                Not what you're looking for? Add manually
              </button>
            </div>
          )}

          {/* Manual entry */}
          {manualMode && (
            <div className="flex flex-col gap-3">
              <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
                Add manually
              </label>
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => { setManualTitle(e.target.value); setError(null) }}
                placeholder="Title *"
                className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
              <input
                type="text"
                value={manualAuthor}
                onChange={(e) => { setManualAuthor(e.target.value); setError(null) }}
                placeholder="Author *"
                className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
              {!error && (
                <button
                  onClick={() => { setManualMode(false); setError(null) }}
                  className="text-[var(--text-11)] text-left border-none bg-transparent cursor-pointer"
                  style={{ color: 'var(--muted)', textDecoration: 'underline' }}
                >
                  Back to search
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--border2)', flexShrink: 0 }}>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-[6px] text-[var(--text-13)] font-medium transition-all duration-100 cursor-pointer border"
            style={{ background: 'transparent', color: 'var(--muted)', borderColor: 'var(--border)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleAdd()}
            disabled={!canAdd || saving}
            className="flex-1 py-2 rounded-[6px] text-[var(--text-13)] font-medium transition-all duration-100 cursor-pointer border-none disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {saving ? 'Adding…' : 'Add Book'}
          </button>
        </div>
      </div>
    </div>
  )
}
