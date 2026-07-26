// As datas (criação/edição) e o tamanho vêm do módulo virtual `virtual:backlog-meta`,
// resolvido em build-time pelo plugin backlogMeta do vite.config (git → fallback fs).
export const SORT_MODES = [
  { value: 'alpha', label: 'Ordem alfabética' },
  { value: 'created', label: 'Data de criação' },
  { value: 'edited', label: 'Data de edição' },
  { value: 'size', label: 'Tamanho' },
  { value: 'folder', label: 'Pasta' },
]

const comparators = {
  alpha: (a, b) => a.title.localeCompare(b.title),
  created: (a, b) => a.birthtime - b.birthtime,
  edited: (a, b) => a.mtime - b.mtime,
  size: (a, b) => a.size - b.size,
  folder: (a, b) => a.folder.localeCompare(b.folder) || a.title.localeCompare(b.title),
}

// Ordena `entries` (que podem ser os próprios itens ou wrappers, via getItem) segundo o
// modo escolhido, com opção de inverter o resultado.
export function sortEntries(entries, mode, reverse, getItem = (e) => e) {
  const cmp = comparators[mode] || comparators.alpha
  const sorted = [...entries].sort((a, b) => cmp(getItem(a), getItem(b)))
  return reverse ? sorted.reverse() : sorted
}
