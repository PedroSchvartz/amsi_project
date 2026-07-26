import { useEffect, useMemo, useRef, useState } from 'react'
import MarkdownBody from './MarkdownBody.jsx'
import { parseOutline, serializeBody, collectIds, collectDefaultCollapsed, findFirstMatchPath } from './lib/outline.js'

function Section({ section, collapsed, onToggle, highlightId, registerRef }) {
  const isOpen = !collapsed.has(section.id)
  const body = useMemo(() => serializeBody(section.body), [section.body])

  return (
    <div className={`outline-section outline-section--l${section.level}`}>
      <button
        ref={(el) => registerRef(section.id, el)}
        className={`outline-section__header ${highlightId === section.id ? 'outline-section__header--flash' : ''}`}
        onClick={() => onToggle(section.id)}
        aria-expanded={isOpen}
      >
        <svg className="outline-section__chevron" viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
          <path
            d={isOpen ? 'M6 8l4 4 4-4' : 'M8 6l4 4-4 4'}
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="outline-section__title">{section.title}</span>
      </button>
      {isOpen && (
        <div className="outline-section__body">
          <MarkdownBody content={body} />
          {section.children.map((child) => (
            <Section
              key={child.id}
              section={child}
              collapsed={collapsed}
              onToggle={onToggle}
              highlightId={highlightId}
              registerRef={registerRef}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function DocumentOutline({ content, levelDefaults, searchQuery }) {
  const outline = useMemo(() => parseOutline(content), [content])
  const [collapsed, setCollapsed] = useState(() => new Set(collectDefaultCollapsed(outline, levelDefaults)))
  const [highlightId, setHighlightId] = useState(null)
  const nodeRefs = useRef(new Map())
  const hasHeadings = outline.children.length > 0

  function registerRef(id, el) {
    if (el) nodeRefs.current.set(id, el)
    else nodeRefs.current.delete(id)
  }

  function onToggle(id) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function collapseAll() {
    setCollapsed(new Set(collectIds(outline)))
  }

  function expandAll() {
    setCollapsed(new Set())
  }

  useEffect(() => {
    if (!searchQuery.trim()) return
    const path = findFirstMatchPath(outline, searchQuery)
    if (!path) return
    setCollapsed((prev) => {
      const next = new Set(prev)
      path.forEach((id) => next.delete(id))
      return next
    })
    const targetId = path[path.length - 1]
    setHighlightId(targetId)
    const timeout = setTimeout(() => {
      nodeRefs.current.get(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
    const clear = setTimeout(() => setHighlightId(null), 1600)
    return () => {
      clearTimeout(timeout)
      clearTimeout(clear)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  return (
    <div className="outline">
      {hasHeadings && (
        <div className="outline__toolbar">
          <button type="button" onClick={collapseAll}>
            Colapsar tudo
          </button>
          <button type="button" onClick={expandAll}>
            Expandir tudo
          </button>
        </div>
      )}
      <MarkdownBody content={serializeBody(outline.body)} />
      {outline.children.map((child) => (
        <Section
          key={child.id}
          section={child}
          collapsed={collapsed}
          onToggle={onToggle}
          highlightId={highlightId}
          registerRef={registerRef}
        />
      ))}
    </div>
  )
}
