# Plano: Cache de sessão no frontend — carregar uma vez, recarregar só sob demanda

## Contexto

Ponto identificado no mesmo vídeo sobre erros comuns de performance que originou os itens 3.8/3.9/3.10 do [`dividas-tecnicas.md`](./dividas-tecnicas.md): o app não faz **nenhum cache no browser**. Hoje, cada vez que o usuário navega para uma tela de listagem (lançamentos, clientes/fornecedores, usuários, tipos de conta, dashboard), o `useEffect` de montagem dispara uma busca nova no backend — mesmo que o usuário tenha saído da tela e voltado 5 segundos depois sem nada ter mudado.

**Comportamento-alvo (definido pelo Pedro):** ao abrir uma tela pela primeira vez na sessão, busca no banco normalmente. Nas próximas vezes que a mesma tela (ou os mesmos dados) forem revisitados **dentro da mesma sessão**, usa os dados já carregados — sem nova requisição. Os dados só são buscados de novo quando o usuário clica explicitamente no botão de recarregar daquela tela.

Diferente dos itens 3.8/3.9/3.10 (backlog aberto), este plano já toma todas as decisões de design necessárias para execução direta — não há pontos em aberto abaixo.

---

## Decisões de design (fechadas)

| Decisão | Escolha | Por quê |
|---|---|---|
| Onde vive o cache | **Memória do módulo JS** — um `Map` singleton em `services/cache.js`, sem `sessionStorage`/`localStorage` | "Sessão" = enquanto o SPA está carregado na aba. Um F5 ou fechar a aba já reresetam naturalmente (mesmo comportamento que o usuário implicitamente espera de "abrir de novo"). Evita lidar com serialização, limite de tamanho do `sessionStorage` e dados sensíveis persistidos em disco. |
| Expiração automática (TTL) | **Não existe.** Só invalida por: (1) clique no botão de recarregar da tela, (2) mutação bem-sucedida naquela tela (criar/editar/excluir), (3) logout | Qualquer expiração automática contradiz "só carrega de novo quando o usuário clica". Mutações precisam invalidar porque senão o próprio usuário não veria o resultado da própria ação. |
| Granularidade da chave | **Recurso + parâmetros serializados** (`recurso:sub-recurso:JSON.stringify(params)`) | Telas com filtro aplicado no backend (lançamentos, dashboard) precisam de uma entrada por combinação de filtro — trocar filtro é cache miss na primeira vez, cache hit se o usuário repetir a mesma combinação depois. Telas com filtro só no frontend (clientes/fornecedores) usam uma chave fixa, já que a busca ao backend é sempre a mesma. |
| Escopo (quais telas) | As 5 telas que buscam listas do banco: lançamentos, clientes/fornecedores, usuários, tipos de conta, dashboard | São as únicas com `useEffect` de busca na montagem que hoje refazem a query toda vez. |
| Deduplicação entre telas | Chaves de recurso compartilhado (`clifors:list`, `tiposConta:list`) são as **mesmas** em qualquer tela que as usa | Bônus natural de um cache em módulo singleton: se o usuário já visitou "Clientes/Fornecedores" nesta sessão, a tela de Lançamentos reaproveita a lista de clifors do dropdown de filtro sem nova requisição. |

---

## Estado atual (diagnóstico)

| Tela / componente | Função de busca | Disparo hoje | Filtro |
|---|---|---|---|
| [`pages/ListaLancamentosPage.jsx`](../../AMSI_Frontend/src/pages/ListaLancamentosPage.jsx) | `buscar(filtros)` → `getLancamentos(params)` | Montagem + toda mudança de filtro + toda mutação | Backend (`params` viram query string) |
| mesma tela | `carregarAuxiliares()` → `getClifors()` + `getTiposConta()` | Só montagem | Sem filtro |
| [`components/ClientList.jsx`](../../AMSI_Frontend/src/components/ClientList.jsx) | `carregar()` → `getClifors()` + `getSaldosClifors()` | Montagem + toda mutação | Frontend (busca/tipo/status filtram o array já carregado) |
| [`components/UserList.jsx`](../../AMSI_Frontend/src/components/UserList.jsx) | `carregarUsuarios()` → `getUsers(mostrarExcluidos)` | Montagem + toggle `mostrarExcluidos` + toda mutação | Backend (`mostrarExcluidos` é o único parâmetro) |
| [`pages/TipoContaPage.jsx`](../../AMSI_Frontend/src/pages/TipoContaPage.jsx) | `carregar()` → `getTiposConta()` | Montagem + toda mutação | Sem filtro |
| [`pages/dashboard.jsx`](../../AMSI_Frontend/src/pages/dashboard.jsx) | `carregarDados(params)` → `getLancamentosResumo` + `getResumoPorTipo` (×2) + `getClifors({inadimplente:true})` | Montagem + troca de período | Backend (período vira `data_pagamento_de`/`_ate`) |

---

## Fase 1 — Módulo de cache (`AMSI_Frontend/src/services/cache.js`, novo arquivo)

```js
// Cache de sessão em memória — vive enquanto o SPA está carregado na aba.
// Sem TTL: só invalida por recarregar manual, mutação bem-sucedida ou logout.
const _cache = new Map();

// Busca em cache; na primeira vez (ou com force=true) chama fetchFn e guarda o resultado.
export async function cachedFetch(key, fetchFn, { force = false } = {}) {
	if (!force && _cache.has(key)) return _cache.get(key);
	const data = await fetchFn();
	_cache.set(key, data);
	return data;
}

// Remove todas as entradas cuja chave começa com o prefixo — usado após mutações,
// para não deixar outras combinações de filtro do mesmo recurso desatualizadas.
export function invalidate(prefix) {
	for (const key of _cache.keys()) {
		if (key.startsWith(prefix)) _cache.delete(key);
	}
}

// Limpa tudo — chamado no logout, para não vazar dados de uma sessão para a próxima.
export function clearCache() {
	_cache.clear();
}
```

**Fora de escopo deste plano (refinamento futuro, não bloqueia a entrega):** deduplicar chamadas concorrentes para a mesma chave (duas telas pedindo `clifors:list` ao mesmo tempo antes da primeira resolver disparariam 2 requisições). Não é um problema hoje porque as telas não competem pela mesma chave na prática — só reaproveitam cache já resolvido.

---

## Fase 2 — Integração por tela

### 2.1 `pages/ListaLancamentosPage.jsx`

- Chave: `` `lancamentos:list:${JSON.stringify(params)}` `` — os mesmos `params` já montados dentro de `buscar()`.
- `carregarAuxiliares`: `cachedFetch('clifors:list', () => getClifors())` e `cachedFetch('tiposConta:list', () => getTiposConta())`.
- `buscar(f)` passa a envolver `getLancamentos(params)` em `cachedFetch`.
- **Botão recarregar:** ao lado do botão "Aplicar filtro" (na barra de filtros) — chama `buscar(filtrosAplicados, { force: true })`.
- **Mutações que invalidam** (`criar`, `editar`, `fechar/efetivar`, `deletar`, `remover comprovante`, criação em massa): antes de cada `buscar()` já existente nesses handlers (linhas hoje em `handleFechar`, `handleEditarSalvar`, `handleDeletar`, etc.), chamar `invalidate('lancamentos:')` e também `invalidate('clifors:')` — quitar/criar/excluir um lançamento muda o saldo e a inadimplência do clifor relacionado, então a lista de clifors (usada no dropdown daqui, na tela de Clientes/Fornecedores e no dashboard) também fica potencialmente desatualizada.

### 2.2 `components/ClientList.jsx`

- Chave: `clifors:list` (mesma chave usada em 2.1 — reaproveitamento automático) e `clifors:saldos` para `getSaldosClifors()`.
- `carregar()` passa a usar `cachedFetch` para as duas chamadas do `Promise.all`.
- **Botão recarregar:** no cabeçalho da lista, ao lado do campo de busca — chama `carregar({ force: true })` (ajustar `carregar` para aceitar e repassar a opção).
- **Mutações que invalidam** (`handleDeletar`, criar, editar clifor — os handlers de criação/edição ficam em `ClientRegisterPage`/edição, que hoje navegam de volta para a lista): `invalidate('clifors:')`. Criar/editar/excluir clifor **não** invalida `lancamentos:` automaticamente — ver limitação aceita abaixo.

### 2.3 `components/UserList.jsx`

- Chave: `` `usuarios:list:${mostrarExcluidos}` `` (duas entradas possíveis: com e sem excluídos).
- `carregarUsuarios()` usa `cachedFetch`.
- **Botão recarregar:** no cabeçalho da lista de usuários.
- **Mutações que invalidam** (`handleDeletar`, resetar senha, restaurar, criar/editar usuário — via `UserRegisterModal`/`UserEditModal`, que chamam `carregarUsuarios()` ao fechar com sucesso): `invalidate('usuarios:')`.

### 2.4 `pages/TipoContaPage.jsx`

- Chave: `tiposConta:list` (mesma chave usada em 2.1).
- `carregar()` usa `cachedFetch`.
- **Botão recarregar:** no cabeçalho da tabela de tipos de conta.
- **Mutações que invalidam** (criar/editar/deletar tipo de conta): `invalidate('tiposConta:')`. Não invalida `lancamentos:` automaticamente — ver limitação aceita abaixo.

### 2.5 `pages/dashboard.jsx`

- Chaves: `` `dashboard:resumo:${JSON.stringify(params)}` ``, `` `dashboard:porTipo:Debito:${JSON.stringify(params)}` ``, `` `dashboard:porTipo:Credito:${JSON.stringify(params)}` ``, `` `clifors:list:${JSON.stringify({inadimplente:true})}` `` (chave própria, diferente de `clifors:list` sem filtro — não pode reaproveitar a lista completa).
- `carregarDados(params)` envolve as 4 chamadas do `Promise.all` em `cachedFetch`.
- **Botão recarregar:** ao lado do seletor de período — chama `carregarDados(filtrosAplicados, { force: true })`.
- Dashboard não tem mutação própria (é só leitura) — nada a invalidar aqui.

---

## Fase 3 — Componente `BotaoRecarregar` (novo, `components/BotaoRecarregar.jsx`)

Evita duplicar o mesmo botão 5 vezes com estilos ligeiramente diferentes.

```jsx
function BotaoRecarregar({ onClick, carregando = false }) {
	return (
		<button
			type="button"
			className="ll-botao-recarregar"
			onClick={onClick}
			disabled={carregando}
			title="Recarregar dados"
			aria-label="Recarregar dados"
		>
			<i className={`bi bi-arrow-clockwise${carregando ? ' ll-spin' : ''}`} />
		</button>
	);
}

export default BotaoRecarregar;
```

CSS (`styles/` — reaproveitar o `@keyframes spin` já usado em `DefinirSenhaPage`/`TrocarSenhaPage`, promovido para uma classe global `.ll-spin` em vez de repetido inline):

```css
.ll-botao-recarregar {
	background: none;
	border: 1px solid var(--border);
	border-radius: 6px;
	color: var(--text-muted);
	cursor: pointer;
	padding: 6px 10px;
}
.ll-botao-recarregar:hover { color: var(--primary); border-color: var(--primary); }
.ll-botao-recarregar:disabled { opacity: 0.6; cursor: default; }
.ll-spin { animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
```

Cada tela controla seu próprio `carregando` (estado que já existe em várias — `loading` em `ClientList`/`TipoContaPage`, `carregando` no dashboard; `ListaLancamentosPage` e `UserList` precisam ganhar um se ainda não tiverem, para o botão desabilitar durante o fetch).

---

## Fase 4 — Logout invalida tudo

`services/auth.js`, função `logout()`:

```js
import { clearCache } from './cache';
// ...
export const logout = () => {
	const token = getToken();
	if (token) {
		fetch(`${BASE_URL}/auth/logout`, { /* ...como já é hoje... */ }).catch(() => {});
	}
	localStorage.clear();
	clearCache();
};
```

Sem isso, um segundo usuário logando no mesmo navegador (troca de sessão sem fechar a aba) veria por um instante os dados em cache do usuário anterior até a primeira ação de recarregar — inaceitável mesmo sendo só leitura, porque pode vazar dado entre perfis diferentes (ex: Consulta vendo o que ficou em cache de um Admin).

---

## Fase 5 — Testes

- **Novo `AMSI_Frontend/src/__tests__/cache.test.js`** (unitário, sem mock de rede): `cachedFetch` retorna do cache na segunda chamada com a mesma chave sem invocar `fetchFn` de novo; `force: true` ignora o cache; `invalidate(prefixo)` remove só as chaves com aquele prefixo; `clearCache()` zera tudo.
- **Por tela** (estendendo os testes já existentes de `ListaLancamentosPage`/`UserList`/etc. — ou novos onde não existem): mockar o serviço de API, montar o componente, desmontar e remontar (simulando navegar para fora e voltar) → assert que a função de API **não** foi chamada uma segunda vez; clicar no botão de recarregar → assert que foi chamada de novo; disparar uma mutação (ex.: excluir um item) → assert que a lista refaz a busca automaticamente (comportamento que já existe hoje, só precisa continuar valendo com o cache no meio).
- Rodar a suíte de frontend completa (`npm test` em `AMSI_Frontend/`) ao final de cada tela integrada, não só no fim de tudo — mais fácil isolar regressão.

---

## Limitações aceitas (trade-off consciente, não é bug a corrigir aqui)

- **Dado denormalizado desatualizado entre recursos não relacionados por mutação:** editar o nome de um clifor ou a descrição de um tipo de conta não invalida `lancamentos:` — a lista de lançamentos em cache continua mostrando `nome_clifor`/`descricao_tipo_conta` antigos até o usuário clicar em recarregar (ou a própria tela de lançamentos sofrer uma mutação, que já invalida `clifors:`/`tiposConta:` por consequência do item 2.1, mas não o inverso). Edição de nome/descrição é rara comparada a criar/editar lançamento; aceitável.
- **Duas abas do mesmo navegador não se sincronizam:** cada aba tem seu próprio `Map` em memória — uma mutação feita numa aba não invalida o cache de outra aba aberta. Já é uma limitação implícita de qualquer cache client-side sem WebSocket; fora de escopo (ver item 2.1 do `demandas-novas.md`, "Notificações em tempo real", que resolveria isso de forma mais ampla).
- **Sem indicador visual de "dado em cache" vs "dado fresco":** a tela não informa ao usuário se o que está vendo é cache ou acabou de vir do servidor. Poderia ser um `title`/tooltip discreto no botão de recarregar (ex.: "Carregado às 14:32") — deixado de fora do MVP deste plano por ser puramente cosmético; fácil de adicionar depois no mesmo `BotaoRecarregar`.

---

## Checklist de execução (ordem sugerida)

1. `services/cache.js` (Fase 1) + `__tests__/cache.test.js` (Fase 5, parte unitária) — testável isoladamente, sem tocar em nenhuma tela.
2. `components/BotaoRecarregar.jsx` + CSS (Fase 3) — componente isolado, sem dependência das telas ainda.
3. `pages/TipoContaPage.jsx` (2.4) — tela mais simples (sem filtro), bom primeiro caso real de integração.
4. `components/UserList.jsx` (2.3) — filtro simples (um booleano).
5. `components/ClientList.jsx` (2.2) — filtro só no frontend, chave fixa; primeira vez que a mesma chave (`clifors:list`) é usada em duas telas.
6. `pages/ListaLancamentosPage.jsx` (2.1) — tela mais complexa, filtros ricos, é quem mais se beneficia (é a tela mais pesada, ver também 3.8/3.9).
7. `pages/dashboard.jsx` (2.5) — por último, reaproveita o padrão já validado nas telas anteriores.
8. `services/auth.js` — `clearCache()` no logout (Fase 4). Fazer **depois** dos itens acima, para já existir algo em cache para limpar durante os testes manuais.
9. Testes por tela (Fase 5) — integrados a cada passo 3–7, não deixados para o final.
