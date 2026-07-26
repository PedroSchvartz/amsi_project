import { useEffect, useMemo, useState } from 'react'
import MarkdownAccordion from './MarkdownAccordion.jsx'
import Settings from './Settings.jsx'

const LEVEL_DEFAULTS_KEY = 'mdSessionExplorer.levelDefaults'
const SORT_MODE_KEY = 'mdSessionExplorer.sortMode'
const SORT_REVERSE_KEY = 'mdSessionExplorer.sortReverse'

function useLevelDefaults() {
  const [levelDefaults, setLevelDefaults] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LEVEL_DEFAULTS_KEY)) || {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    localStorage.setItem(LEVEL_DEFAULTS_KEY, JSON.stringify(levelDefaults))
  }, [levelDefaults])

  return [levelDefaults, setLevelDefaults]
}

// Entry point: um accordion de leitura de markdown com busca, ordenação, filtro por
// pasta (em cascata) e colapso por nível de heading configurável.
//
// items: [{ path (chave única), relPath (exibido), folder (agrupamento;
//   "." = raiz), title, content (markdown cru), size (bytes), mtime (ms epoch),
//   birthtime (ms epoch) }]
export default function MarkdownSessionExplorer({ items }) {
  const [levelDefaults, setLevelDefaults] = useLevelDefaults()
  const [sortMode, setSortMode] = useState(() => localStorage.getItem(SORT_MODE_KEY) || 'alpha')
  const [sortReverse, setSortReverse] = useState(() => localStorage.getItem(SORT_REVERSE_KEY) === 'true')
  const [folderVisibility, setFolderVisibility] = useState({})

  useEffect(() => {
    localStorage.setItem(SORT_MODE_KEY, sortMode)
  }, [sortMode])

  useEffect(() => {
    localStorage.setItem(SORT_REVERSE_KEY, String(sortReverse))
  }, [sortReverse])

  // Reseta pra "tudo visível" sempre que o conjunto de itens muda (novo diretório etc.).
  useEffect(() => {
    setFolderVisibility({})
  }, [items])

  const folders = useMemo(
    () => [...new Set(items.map((item) => item.folder))].sort((a, b) => a.localeCompare(b)),
    [items],
  )

  function toggleFolder(folder) {
    setFolderVisibility((prev) => {
      const nextVisible = prev[folder] === false
      const next = { ...prev }
      for (const f of folders) {
        if (f === folder || f.startsWith(`${folder}/`)) next[f] = nextVisible
      }
      return next
    })
  }

  return (
    <div className="mda">
      <div className="mda__toolbar">
        <Settings
          levelDefaults={levelDefaults}
          onLevelDefaultsChange={setLevelDefaults}
          sortMode={sortMode}
          sortReverse={sortReverse}
          onSortModeChange={setSortMode}
          onSortReverseChange={setSortReverse}
          folders={folders}
          folderVisibility={folderVisibility}
          onToggleFolder={toggleFolder}
        />
      </div>
      <MarkdownAccordion
        items={items}
        levelDefaults={levelDefaults}
        sortMode={sortMode}
        sortReverse={sortReverse}
        folderVisibility={folderVisibility}
      />
    </div>
  )
}
