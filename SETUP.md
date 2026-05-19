# AMSI Project — Guia de instalação local

Sistema de gestão financeira da Associação de Moradores de Santa Isabel.  
Este guia assume que você recebeu o projeto em `.zip` e quer rodá-lo do zero.

---

## Pré-requisitos

Instale antes de começar:

| Ferramenta | Versão mínima | Download |
|---|---|---|
| Python | 3.10+ | https://www.python.org/downloads/ |
| Node.js + npm | 18+ | https://nodejs.org/ |
| PostgreSQL | 14+ | https://www.postgresql.org/download/ |

> Depois de instalar o Python, verifique com `python --version` no terminal.  
> Depois de instalar o Node, verifique com `node --version` e `npm --version`.

---

## 1. Extraia o zip

Extraia o conteúdo em qualquer pasta. A estrutura será:

```
AMSI_Project_Desenvolvimento/
├── backend/
├── AMSI_Frontend/
├── config.env          ← você vai criar este arquivo
└── SETUP.md
```

---

## 2. Crie o banco de dados no PostgreSQL

Abra o **pgAdmin** ou o **psql** e execute:

```sql
CREATE DATABASE "ANSI_Project";
```

> O nome do banco é `ANSI_Project` (com N, não M — é assim no sistema).

---

## 3. Crie o arquivo `config.env`

Na **raiz do projeto** (junto com a pasta `backend/`), crie um arquivo chamado `config.env` com o seguinte conteúdo — preencha os valores marcados com `←`:

```env
# Banco de dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ANSI_Project
DB_USER=postgres
DB_PASSWORD=SUA_SENHA_DO_POSTGRES    ←

# JWT (pode deixar qualquer string longa e aleatória)
JWT_SECRET_KEY=troque_por_uma_chave_secreta_longa
JWT_EXPIRE_MINUTES=60
JWT_ALGORITHM=HS256

# URL do frontend (para links nos emails)
FRONTEND_URL=http://localhost:5173

# Ambiente
APP_ENV=development
APP_HOST=localhost
APP_PORT=8000

# Email (opcional — se deixar vazio o sistema funciona, mas não envia emails)
EMAIL_REMETENTE=
EMAIL_SENHA_APP=
```

---

## 4. Configure e rode o backend

Abra um terminal na pasta `backend/`:

```bash
cd AMSI_Project_Desenvolvimento/backend
```

### 4a. Crie um ambiente virtual (recomendado)

```bash
python -m venv venv
```

Ative:
- **Windows:** `venv\Scripts\activate`
- **Mac/Linux:** `source venv/bin/activate`

### 4b. Instale as dependências

```bash
pip install -r requirements.txt
```

### 4c. Suba o servidor

```bash
uvicorn main:app --reload
```

Na primeira execução, o SQLAlchemy cria todas as tabelas automaticamente no banco.

Você verá algo como:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

### 4d. Rode o bootstrap (cria os admins iniciais)

Em outro terminal (com o venv ativado), ainda dentro de `backend/`:

```bash
python utils/bootstrap.py
```

Isso cria os usuários administradores e os usuários de teste para os testes automatizados.  
Se o email estiver configurado, cada admin receberá a senha provisória por email.  
Se não estiver, a senha aparece no terminal.

---

## 5. Configure e rode o frontend

Abra um **novo terminal** na pasta `AMSI_Frontend/`:

```bash
cd AMSI_Project_Desenvolvimento/AMSI_Frontend
```

### 5a. Verifique o arquivo `.env`

Deve existir um arquivo `.env` nessa pasta com:

```env
VITE_API_URL=http://localhost:8000
VITE_DB_SLEEP_MS=120000
```

Se não existir, crie-o com esse conteúdo.

### 5b. Instale as dependências

```bash
npm install
```

### 5c. Suba o frontend

```bash
npm run dev
```

Você verá:
```
  VITE v5.x.x  ready in ...ms
  ➜  Local:   http://localhost:5173/
```

---

## 6. Acesse o sistema

Abra o navegador em **http://localhost:5173**

Faça login com o email de um dos admins criados pelo bootstrap.  
Na primeira vez será pedido para trocar a senha.

---

## Resumo dos comandos (após configuração inicial)

| O que fazer | Comando |
|---|---|
| Subir backend | `cd backend && uvicorn main:app --reload` |
| Subir frontend | `cd AMSI_Frontend && npm run dev` |
| Rodar testes | `cd backend && pytest` |

---

## Perfis de acesso

| Perfil | O que pode fazer |
|---|---|
| **Administrador** | Tudo — incluindo criar/editar/excluir usuários e lançamentos |
| **Operador** | Ver e efetivar lançamentos |
| **Consulta** | Somente visualização |

---

## Problemas comuns

**`psycopg2.OperationalError: could not connect to server`**  
→ O PostgreSQL não está rodando, ou a senha em `config.env` está errada.

**`ModuleNotFoundError`**  
→ O ambiente virtual não está ativado, ou `pip install -r requirements.txt` não foi executado.

**Tela em branco no frontend**  
→ Verifique se o backend está rodando em `http://localhost:8000` e se o `.env` do frontend aponta para ele.

**`VITE_API_URL` não definido**  
→ O arquivo `.env` não existe dentro de `AMSI_Frontend/`. Crie-o conforme o passo 5a.
