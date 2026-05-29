# Como usar estes documentos no NotebookLM

## Os 16 arquivos criados

| Arquivo | Para que serve | Quando usar |
|---|---|---|
| `roteiro_defesa.md` | Script completo da apresentação (18–20 min) | Praticar a fala, simular a apresentação |
| `simulado_banca_dificil.md` | Perguntas difíceis com respostas detalhadas | Simular a arguição da banca |
| `contexto_negocio.md` | Contexto da AMSI, problema e impacto | Perguntas de negócio, não técnicas |
| `tematico_seguranca.md` | SQL Injection, XSS, CSRF, bcrypt, JWT, RBAC | Estudar segurança isoladamente |
| `tematico_arquitetura.md` | FastAPI, JWT, camadas, REST, MVC | Estudar decisões de arquitetura |
| `tematico_banco_dados.md` | PostgreSQL, 3NF, ACID, N+1, soft delete | Estudar banco de dados |
| `tematico_frontend.md` | React, SPA, CSS vars, fetch, logout sync | Estudar frontend |
| `tematico_testes.md` | pytest, db_snapshot, integração vs unitário | Estudar testes |
| `analogias_e_metaforas.md` | Metáforas concretas para cada conceito técnico | Melhorar Audio Overview; memorizar conceitos |
| `ficha_revisao_rapida.md` | Todos os números, fatos e arquivos em uma página | Revisão rápida; manhã da defesa |
| `narrativa_sem_o_que.md` | O que quebraria sem cada decisão técnica | Responder "por que isso era necessário?" |
| `mapa_de_conexoes.md` | Como cada decisão influencia as outras | Perguntas encadeadas da banca |
| `narrativas_usuario.md` | Histórias de Maria, João, Roberto e Carlos — perspectiva humana | Enriquecer Audio Overview; responder sobre impacto real |
| `dialogo_dev_professor.md` | 6 diálogos DEV vs PROF sobre decisões questionáveis | **Melhor fonte para Audio Overview**; praticar defesa sob pressão |
| `padroes_nao_obvios_backend.md` | 7 padrões de código que parecem errados mas têm razão | Quando o professor leu o código e pergunta sobre linhas específicas |

---

## Estratégia 1 — Estudo completo (primeira vez)

Sobe no mesmo notebook:
- `podcast_amsi_fonte_completa.md` (já existe no projeto)
- `roteiro_defesa.md`
- `simulado_banca_dificil.md`
- `contexto_negocio.md`

**Gera o Audio Overview** → ouve o podcast de ~15 min enquanto caminha ou no transporte. O NotebookLM vai criar uma conversa entre dois "hosts" discutindo o projeto.

**Depois:** usa o chat para perguntar: "Quais são as perguntas mais difíceis que uma banca de TCC poderia fazer sobre este sistema?"

---

## Estratégia 2 — Estudo temático focado (um tema por sessão)

Cria notebooks separados para cada tema:

**Notebook: Segurança**
- `tematico_seguranca.md`
- `docs/09_seguranca.md` (do projeto original)
- `simulado_banca_dificil.md` (só as perguntas de segurança)

**Notebook: Arquitetura**
- `tematico_arquitetura.md`
- `docs/10_decisoes_arquiteturais.md`

**Notebook: Banco de Dados**
- `tematico_banco_dados.md`
- `docs/03_backend.md`

Pergunta ao NotebookLM: "Me explique [conceito] como se eu fosse um professor universitário avaliando se entendo ou não o assunto."

---

## Estratégia 3 — Simulação de banca interativa

Sobe no mesmo notebook:
- `simulado_banca_dificil.md`
- `roteiro_defesa.md`
- `podcast_amsi_fonte_completa.md`

**Prompt no chat:** "Você é um professor rigoroso de engenharia de software avaliando um TCC. Faça uma pergunta difícil sobre a arquitetura de autenticação do sistema. Depois que eu responder, avalie se a resposta está completa e o que eu deixei de mencionar."

Repita para cada tema que quiser praticar.

---

## Estratégia 5 — Notebook otimizado para Audio Overview (novo)

Para o Audio Overview mais rico, sobe **este conjunto específico** no mesmo notebook:
- `dialogo_dev_professor.md` ← formato de diálogo, os hosts vão "debater"
- `narrativas_usuario.md` ← histórias humanas, os hosts vão "contextualizar"
- `analogias_e_metaforas.md` ← metáforas, os hosts vão "explicar com exemplos"
- `narrativa_sem_o_que.md` ← consequências, os hosts vão "explorar riscos"

Não precisa subir os documentos técnicos densos — eles não melhoram o áudio, só a precisão do chat.

**Por que esse conjunto funciona melhor:** o NotebookLM gera dois hosts conversando. Quando a fonte já tem diálogo (`dialogo_dev_professor.md`), histórias (`narrativas_usuario.md`) e metáforas (`analogias_e_metaforas.md`), o output de áudio terá tensão, narrativa e humor — em vez de dois hosts lendo documentação em voz alta.

---

## Estratégia 4 — Audio Overview por tema

Para cada notebook temático, gera um Audio Overview separado. Resultado: 5 "podcasts" curtos (5-8 min cada), um por tema. Ideal para revisar no dia anterior à defesa.

**Ordem sugerida de escuta:**
1. `contexto_negocio.md` → entende o problema
2. `tematico_arquitetura.md` → entende a solução
3. `tematico_banco_dados.md` → entende os dados
4. `tematico_frontend.md` → entende a interface
5. `tematico_seguranca.md` → entende as proteções
6. `tematico_testes.md` → entende a qualidade
7. `roteiro_defesa.md` → pratica a apresentação

---

## Perguntas úteis para o chat do NotebookLM

Sobre a apresentação:
- "Qual é o ponto mais difícil de explicar no roteiro e como eu posso simplificá-lo?"
- "Se eu tiver apenas 10 minutos para apresentar, o que cortar e o que manter?"

Sobre a banca:
- "Que perguntas sobre escalabilidade eu deveria estar preparado para responder?"
- "Como eu explico o trade-off de JWT vs sessions para um professor que não conhece o sistema?"

Sobre os pontos fracos:
- "Quais são as maiores limitações do sistema e como posso apresentá-las de forma honesta sem enfraquecer a defesa?"

Sobre conexões:
- "Como a decisão de usar FastAPI se conecta com a decisão de usar Pydantic?"
- "Por que o mesmo motivo que justifica PostgreSQL também justifica não usar SQLite?"
