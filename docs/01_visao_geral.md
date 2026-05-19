# 01 — Visão Geral do Sistema

> **O que você aprende aqui:** para que serve o AMSI, quem o usa e como as três partes do sistema (banco, backend, frontend) se relacionam.

---

## O que é o AMSI

O AMSI é um sistema de gestão financeira da Associação de Moradores de Santa Isabel. Ele permite registrar **lançamentos** — cobranças, pagamentos, reembolsos — associados a clientes e fornecedores, acompanhar inadimplência e gerar resumos financeiros.

Não é um sistema público. Só usuários cadastrados e autorizados conseguem acessar.

---

## Quem usa e o que cada perfil pode fazer

O sistema tem três níveis de acesso, do mais restrito ao mais amplo:

| Perfil | O que pode fazer |
|---|---|
| **Consulta** | Somente visualizar dados. Não cria, não edita, não deleta nada. |
| **Operador** | Visualizar e **efetivar** lançamentos (registrar pagamento). Gerenciar clientes/fornecedores. |
| **Administrador** | Tudo — incluindo criar/editar/excluir usuários, lançamentos e tipos de conta. |

Essa hierarquia se chama **RBAC** (Role-Based Access Control). O nível de acesso de um usuário fica gravado dentro do token JWT que ele recebe ao fazer login. Veja mais em [04_autenticacao.md](./04_autenticacao.md).

---

## As três partes do sistema

```
┌─────────────────────────────────────────────────────┐
│                  Navegador do usuário                │
│                                                     │
│   React (AMSI_Frontend/)                            │
│   ├── Exibe a interface (HTML + CSS)                │
│   ├── Guarda o token JWT no localStorage            │
│   └── Faz requisições HTTP para o backend           │
└──────────────────────┬──────────────────────────────┘
                       │  HTTP / JSON
                       │  (porta 8000 em dev)
┌──────────────────────▼──────────────────────────────┐
│                   Backend                            │
│                                                     │
│   FastAPI (backend/)                                │
│   ├── Valida o token JWT de cada requisição         │
│   ├── Verifica as permissões do usuário             │
│   ├── Executa a lógica de negócio                   │
│   └── Lê e escreve no banco via SQLAlchemy          │
└──────────────────────┬──────────────────────────────┘
                       │  SQL
                       │  (porta 5432)
┌──────────────────────▼──────────────────────────────┐
│                  Banco de dados                      │
│                                                     │
│   PostgreSQL                                        │
│   ├── Tabela: usuario                               │
│   ├── Tabela: lancamento                            │
│   ├── Tabela: clientefornecedor                     │
│   ├── Tabela: tipo_conta                            │
│   ├── Tabela: token_ativo                           │
│   └── ... (endereços, contatos, logins)             │
└─────────────────────────────────────────────────────┘
```

**Regra fundamental:** o frontend **nunca** fala com o banco diretamente. Toda operação passa pelo backend. Isso garante que as regras de negócio e as validações de segurança sejam sempre aplicadas, independente de onde a requisição veio.

---

## O que acontece em uma interação típica

Exemplo: um operador abre a lista de lançamentos.

1. O browser carrega o React (HTML + JS)
2. O React verifica se há um token JWT salvo no `localStorage`
3. Se sim, faz `GET http://localhost:8000/lancamento/` com o token no header
4. O backend valida o token, busca os dados no banco e devolve JSON
5. O React renderiza a tabela com os dados recebidos

Se o token estiver expirado ou inválido, o backend devolve `401 Unauthorized` e o frontend faz logout automático.

---

## Entidades principais

| Entidade | Arquivo do modelo | Para que serve |
|---|---|---|
| `Usuario` | `backend/models/usuario.py` | Quem acessa o sistema |
| `Lancamento` | `backend/models/lancamento.py` | Registro financeiro (cobrança ou pagamento) |
| `ClienteFornecedor` | `backend/models/cliente_fornecedor.py` | A quem o lançamento está associado |
| `TipoConta` | `backend/models/tipo_conta.py` | Categoria do lançamento (ex: "Condomínio") |
| `TokenAtivo` | `backend/models/token_ativo.py` | Rastreia sessões JWT abertas |

---

## Próximo passo

Continue em [02_stack.md](./02_stack.md) para entender por que cada tecnologia foi escolhida.
