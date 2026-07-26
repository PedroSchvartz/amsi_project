import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import { toString as mdastToString } from 'mdast-util-to-string'

const parser = unified().use(remarkParse).use(remarkGfm)
const serializer = unified().use(remarkGfm).use(remarkStringify)

// Converte o markdown numa árvore de seções aninhada pelos níveis de heading (#, ##, ...).
// Cada seção carrega seu próprio corpo (nós que não são heading) e as subseções filhas.
export function parseOutline(content) {
  const tree = parser.parse(content)
  const root = { id: 'root', level: 0, title: null, body: [], children: [] }
  const stack = [root]

  for (const node of tree.children) {
    if (node.type === 'heading') {
      const level = node.depth
      while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop()
      const parent = stack[stack.length - 1]
      const section = {
        id: `${parent.id}.${parent.children.length}`,
        level,
        title: mdastToString(node),
        body: [],
        children: [],
      }
      parent.children.push(section)
      stack.push(section)
    } else {
      stack[stack.length - 1].body.push(node)
    }
  }

  return root
}

// Serializa de volta pra markdown só o corpo (parágrafos, listas, código...) de uma seção,
// pra poder renderizar cada pedaço com o pipeline normal de ReactMarkdown.
export function serializeBody(nodes) {
  if (!nodes.length) return ''
  return serializer.stringify({ type: 'root', children: nodes })
}

// Todos os ids da árvore, exceto a raiz (usado por "colapsar tudo").
export function collectIds(section, out = []) {
  for (const child of section.children) {
    out.push(child.id)
    collectIds(child, out)
  }
  return out
}

// Ids que devem começar colapsados dado o mapa de nível -> colapsado-por-padrão.
export function collectDefaultCollapsed(section, levelDefaults, out = []) {
  for (const child of section.children) {
    if (levelDefaults[child.level]) out.push(child.id)
    collectDefaultCollapsed(child, levelDefaults, out)
  }
  return out
}

// Acha o caminho (ids dos ancestrais + a própria) até a primeira seção cujo título ou corpo
// bate com a query. Corpo é comparado pelo texto puro (título dos nós, sem formatação).
export function findFirstMatchPath(section, query, ancestors = []) {
  const q = query.trim().toLowerCase()
  if (!q) return null

  for (const child of section.children) {
    const path = [...ancestors, child.id]
    const titleHit = child.title.toLowerCase().includes(q)
    const bodyHit = !titleHit && bodyText(child.body).toLowerCase().includes(q)
    if (titleHit || bodyHit) return path

    const nested = findFirstMatchPath(child, q, path)
    if (nested) return nested
  }
  return null
}

function bodyText(nodes) {
  return nodes.map((n) => mdastToString(n)).join(' ')
}
