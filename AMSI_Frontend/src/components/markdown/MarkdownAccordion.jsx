import { Fragment, useMemo, useState } from 'react'
import DocumentOutline from './DocumentOutline.jsx'
import { sortEntries } from './lib/sort.js'

const SNIPPET_RADIUS = 60

function bodySnippet(content, query) {
  const idx = content.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return null
  const start = Math.max(0, idx - SNIPPET_RADIUS)
  const end = Math.min(content.length, idx + query.length + SNIPPET_RADIUS)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < content.length ? '…' : ''
  return prefix + content.slice(start, end).replace(/\s+/g, ' ').trim() + suffix
}

function AccordionItem({ item, isOpen, onToggle, levelDefaults, query, matchedInBody }) {
  return (
    <section className={`session ${isOpen ? 'session--open' : ''}`}>
      <button className="session__header" onClick={onToggle} aria-expanded={isOpen}>
        <svg className="session__chevron" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="session__heading">
          <span className="session__title">{item.title}</span>
          <span className="session__path">{item.relPath}</span>
          {matchedInBody && <span className="session__snippet">{matchedInBody}</span>}
        </div>
      </button>
      {isOpen && (
        <div className="session__body">
          <DocumentOutline content={item.content} levelDefaults={levelDefaults} searchQuery={query} />
        </div>
      )}
    </section>
  )
}

export default function MarkdownAccordion({ items, levelDefaults, sortMode, sortReverse, folderVisibility }) {
  const [query, setQuery] = useState('')
  const [openPaths, setOpenPaths] = useState(() => new Set())

  const visibleItems = useMemo(
    () => items.filter((item) => folderVisibility[item.folder] !== false),
    [items, folderVisibility],
  )

  const matched = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return visibleItems.map((item) => ({ item, snippet: null }))
    return visibleItems
      .map((item) => {
        const titleHit = item.title.toLowerCase().includes(q) || item.relPath.toLowerCase().includes(q)
        const snippet = !titleHit ? bodySnippet(item.content, q) : null
        return titleHit || snippet ? { item, snippet } : null
      })
      .filter(Boolean)
  }, [visibleItems, query])

  const sorted = useMemo(
    () => sortEntries(matched, sortMode, sortReverse, (entry) => entry.item),
    [matched, sortMode, sortReverse],
  )

  function toggle(path) {
    setOpenPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  let lastFolder = null

  return (
    <div className="accordion">
      <input
        className="accordion__filter"
        type="search"
        placeholder="Buscar por título, caminho ou conteúdo..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {sorted.length === 0 ? (
        <p className="accordion__empty">Nenhum arquivo .md corresponde à busca.</p>
      ) : (
        <div className="accordion__list">
          {sorted.map(({ item, snippet }) => {
            const showFolderHeader = sortMode === 'folder' && item.folder !== lastFolder
            lastFolder = item.folder
            return (
              <Fragment key={item.path}>
                {showFolderHeader && (
                  <div className="accordion__folder-header">{item.folder === '.' ? '(raiz)' : item.folder}</div>
                )}
                <AccordionItem
                  item={item}
                  isOpen={openPaths.has(item.path)}
                  onToggle={() => toggle(item.path)}
                  levelDefaults={levelDefaults}
                  query={query}
                  matchedInBody={snippet}
                />
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
