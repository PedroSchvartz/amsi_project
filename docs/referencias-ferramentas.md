# Ferramentas de apoio ao frontend

Referências úteis para o stack do AMSI (React 19 + Vite, **CSS puro** com dois temas
via `var(--nome)`, sem Tailwind/shadcn e sem lib de ícones). Só entram aqui ferramentas
que encaixam **sem** exigir mudança de stack.

## Animista — `https://animista.net`

Construtor **visual** de animações CSS. Escolhe o efeito, ajusta duração/easing, vê o
preview e copia o `@keyframes`.

- **Por que serve:** o AMSI já escreve animações CSS na mão (dezenas de `@keyframes`/
  `transition` em `AMSI_Frontend/src/styles/`). Gera o keyframe, cola no `.css` e colore
  com `var(--...)`. Zero dependência nova.
- **Cuidado:** o CSS gerado vem com cores/valores fixos — troque cor hardcoded por
  `var(--nome)` antes de commitar (convenção inegociável do projeto).

## Phosphor Icons — `https://phosphoricons.com`

Família de ícones consistente, 1 família × 6 pesos, com busca e export.

- **Por que serve (condicional):** hoje o AMSI não usa lib de ícones. Útil **se** surgir
  dor com ícones inconsistentes.
- **Recomendado no espírito YAGNI:** copiar o **SVG avulso** direto do site (botão de
  copiar) em vez de instalar o pacote `@phosphor-icons/react` — mantém o `package.json`
  enxuto e sem dependência nova.

---

_Descartadas do reel original (não encaixam no stack): Skiper UI (depende de
Tailwind + shadcn), 10x.app (gera app iOS/SwiftUI, não web), Layers.to (só inspiração
visual genérica)._
