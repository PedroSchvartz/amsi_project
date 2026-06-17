# AMSI — Frontend

Interface web do sistema de gestão financeira da Associação de Moradores de Santa
Isabel. **React + Vite** (não é SvelteKit — veja a nota no fim).

## Stack

- React 19 + React Router DOM
- Vite (build/dev) com `@vitejs/plugin-react`
- Bootstrap / Bootstrap Icons, Recharts
- Vitest (unit) + Playwright (e2e)

## Scripts

```sh
npm run dev        # servidor de desenvolvimento (http://localhost:5173)
npm run build      # build de produção em dist/
npm run preview    # serve o build de produção
npm run lint       # prettier --check + eslint
npm run format     # prettier --write
npm run test:unit  # testes unitários (vitest)
npm run test:e2e   # testes e2e (playwright)
```

## Configuração

- `VITE_API_URL` — URL base do backend (ver `.env`). Em desenvolvimento aponta para
  `http://localhost:8000`.

## Nota histórica

O projeto foi inicializado a partir de um scaffold SvelteKit que nunca foi usado;
todo o app é React. As dependências e configs do Svelte (`svelte`, `@sveltejs/*`,
`svelte.config.js`, etc.) foram removidas em 2026-06-16.
