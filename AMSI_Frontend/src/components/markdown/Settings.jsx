import { useEffect, useRef, useState } from 'react'
import { SORT_MODES } from './lib/sort.js'

const LEVELS = [1, 2, 3, 4, 5, 6]

function folderDepth(folder) {
  return folder === '.' ? 0 : folder.split('/').length
}

function folderLabel(folder) {
  return folder === '.' ? '(raiz)' : folder.split('/').pop()
}

export default function Settings({
  levelDefaults,
  onLevelDefaultsChange,
  sortMode,
  sortReverse,
  onSortModeChange,
  onSortReverseChange,
  folders,
  folderVisibility,
  onToggleFolder,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function toggleLevel(level) {
    onLevelDefaultsChange({ ...levelDefaults, [level]: !levelDefaults[level] })
  }

  return (
    <div className="settings" ref={ref}>
      <button
        className="mda-settings__trigger"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Configurações"
        title="Configurações"
      >
        ⚙️
      </button>
      {open && (
        <div className="settings__panel">
          <section className="settings__section">
            <p className="settings__title">Ordenar por</p>
            {SORT_MODES.map((mode) => (
              <label key={mode.value} className="settings__row">
                <input
                  type="radio"
                  name="sort-mode"
                  checked={sortMode === mode.value}
                  onChange={() => onSortModeChange(mode.value)}
                />
                <span>{mode.label}</span>
              </label>
            ))}
            <label className="settings__row settings__row--reverse">
              <input type="checkbox" checked={sortReverse} onChange={(e) => onSortReverseChange(e.target.checked)} />
              <span>Ordem invertida</span>
            </label>
          </section>

          <section className="settings__section">
            <p className="settings__title">Pastas exibidas</p>
            {folders.length === 0 ? (
              <p className="settings__hint">Carregue um caminho pra ver as pastas.</p>
            ) : (
              folders.map((folder) => (
                <label
                  key={folder}
                  className="settings__row"
                  style={{ paddingLeft: folderDepth(folder) * 14 }}
                  title={folder === '.' ? undefined : folder}
                >
                  <input
                    type="checkbox"
                    checked={folderVisibility[folder] !== false}
                    onChange={() => onToggleFolder(folder)}
                  />
                  <span>{folderLabel(folder)}</span>
                </label>
              ))
            )}
          </section>

          <section className="settings__section">
            <p className="settings__title">Iniciar colapsado por nível</p>
            {LEVELS.map((level) => (
              <label key={level} className="settings__row">
                <input type="checkbox" checked={!!levelDefaults[level]} onChange={() => toggleLevel(level)} />
                <span>{'#'.repeat(level)} nível {level}</span>
              </label>
            ))}
          </section>
        </div>
      )}
    </div>
  )
}
