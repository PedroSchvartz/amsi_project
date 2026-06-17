import logging
import sys
import os
import secrets
import string

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database import SessionLocal
from models.usuario import Usuario, CargoEnum, AcessoEnum
from utils.auth_utils import hash_senha
from utils.email_sender import enviar_email
from utils.config import FRONTEND_URL
from utils.frequentes import configure_logging, colorir
from utils.config import CONSULTA_TESTE_EMAIL, CONSULTA_TESTE_SENHA, OPERADOR_TESTE_EMAIL, OPERADOR_TESTE_SENHA
from utils.config import ADMIN_TESTE_EMAIL, ADMIN_TESTE_SENHA


# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURAÇÃO — edite aqui os usuários seed
# ══════════════════════════════════════════════════════════════════════════════

ADMINS_INICIAIS = [
    # Criados apenas se não existirem; senha gerada e enviada por email.
    # Para resetar a senha de um admin existente use o painel do sistema.
    {
        "email":            "opedroschvartz@gmail.com",
        "nome":             "Pedro Schvartz",
        "cargo":            CargoEnum.Desenvolvedor,
        "perfil_de_acesso": AcessoEnum.Administrador,
    },
]

USUARIOS_TESTE = [
    # Upsert: se já existir, sobrescreve senha/flags para manter sincronia com o config.env.
    {
        "email":            ADMIN_TESTE_EMAIL,
        "senha":            ADMIN_TESTE_SENHA,
        "nome":             "Usuário Admin Teste",
        "cargo":            CargoEnum.Desenvolvedor,
        "perfil_de_acesso": AcessoEnum.Administrador,
    },
    {
        "email":            CONSULTA_TESTE_EMAIL,
        "senha":            CONSULTA_TESTE_SENHA,
        "nome":             "Usuário Consulta Teste",
        "cargo":            CargoEnum.Desenvolvedor,
        "perfil_de_acesso": AcessoEnum.Consulta,
    },
    {
        "email":            OPERADOR_TESTE_EMAIL,
        "senha":            OPERADOR_TESTE_SENHA,
        "nome":             "Usuário Operador Teste",
        "cargo":            CargoEnum.Desenvolvedor,
        "perfil_de_acesso": AcessoEnum.Operador,
    },
]

# ══════════════════════════════════════════════════════════════════════════════


def _gerar_senha_provisoria(tamanho: int = 12) -> str:
    caracteres = string.ascii_letters + string.digits + "!@$&*"  # # e % removidos — quebram URL
    return "".join(secrets.choice(caracteres) for _ in range(tamanho))


def _migrar_acesso_enum(db: Session):
    """Adiciona 'Operador' ao acesso_enum do PostgreSQL se ainda não existir."""
    resultado = db.execute(
        __import__('sqlalchemy').text(
            "SELECT 1 FROM pg_enum WHERE enumtypid = 'acesso_enum'::regtype::oid AND enumlabel = 'Operador'"
        )
    ).fetchone()
    if not resultado:
        db.execute(__import__('sqlalchemy').text("ALTER TYPE acesso_enum ADD VALUE 'Operador'"))
        db.commit()
        print(colorir(cor="azul", texto="✔ 'Operador' adicionado ao enum acesso_enum"))
    else:
        print(colorir(cor="verde", texto="✔ acesso_enum já contém 'Operador'"))


def _upsert_usuario_teste(db: Session, dados: dict):
    """Cria ou sobrescreve um usuário de teste com a senha e flags definidos em USUARIOS_TESTE."""
    email = dados["email"]
    existente = db.query(Usuario).filter(Usuario.email == email).first()

    if existente:
        existente.nome             = dados["nome"]
        existente.senha            = hash_senha(dados["senha"])
        existente.cargo            = dados["cargo"]
        existente.perfil_de_acesso = dados["perfil_de_acesso"]
        existente.bloqueado        = False
        existente.suspenso         = None
        existente.exclusao         = None
        existente.primeiro_acesso  = False
        print(colorir(cor="azul", texto=f"✔ Usuário de teste atualizado: {email}"))
    else:
        novo = Usuario(
            email=email,
            nome=dados["nome"],
            senha=hash_senha(dados["senha"]),
            cargo=dados["cargo"],
            perfil_de_acesso=dados["perfil_de_acesso"],
            notificacao=False,
            bloqueado=False,
            primeiro_acesso=False,
        )
        db.add(novo)
        print(colorir(cor="verde", texto=f"✔ Usuário de teste criado: {email}"))


def garantir_admins_iniciais():
    configure_logging()
    db: Session = SessionLocal()

    _migrar_acesso_enum(db)

    try:
        # ── Admins: apenas cria se não existir ──────────────────────────────
        for admin_data in ADMINS_INICIAIS:
            usuario_existente = db.query(Usuario).filter(
                Usuario.email == admin_data["email"],
                Usuario.exclusao == None
            ).first()

            if not usuario_existente:
                print(colorir(cor="azul", texto=f"🚀 Criando admin: {admin_data['email']}"))
                senha_provisoria = _gerar_senha_provisoria()

                novo_admin = Usuario(
                    email=admin_data["email"],
                    nome=admin_data["nome"],
                    senha=hash_senha(senha_provisoria),
                    cargo=admin_data["cargo"],
                    perfil_de_acesso=admin_data["perfil_de_acesso"],
                    notificacao=True,
                    bloqueado=False,
                    primeiro_acesso=True,
                )
                db.add(novo_admin)
                db.flush()

                corpo = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#EFE6DD;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="600" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(27,67,50,0.10);">
        <tr><td style="background:#1B4332;padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:2rem;font-weight:700;color:#C9A84C;letter-spacing:0.1em;">AMSI</p>
          <p style="margin:4px 0 0;font-size:0.72rem;color:rgba(255,255,255,0.6);letter-spacing:0.2em;text-transform:uppercase;">Associação de Moradores de Santa Isabel</p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="font-size:1.3rem;font-weight:600;color:#1B4332;margin:0 0 8px;">Bem-vindo(a) ao AMSI! 👋</p>
          <p style="color:#6b7280;margin:0 0 20px;">Sua conta de administrador foi criada com sucesso.</p>
          <p style="color:#2C2C2C;margin:0 0 12px;">Sua senha provisória:</p>
          <div style="background:#f4f1ec;border:1px solid #d1c9bf;border-radius:8px;padding:18px;text-align:center;margin:0 0 20px;">
            <p style="margin:0 0 4px;font-size:0.7rem;color:#6b7280;letter-spacing:0.12em;text-transform:uppercase;">senha</p>
            <p style="margin:0;font-size:1.5rem;font-weight:700;color:#1B4332;letter-spacing:0.2em;">{senha_provisoria}</p>
          </div>
          <div style="background:#fef9ec;border-left:4px solid #C9A84C;padding:12px 16px;border-radius:4px;margin:0 0 20px;">
            <p style="margin:0;font-size:0.85rem;color:#92400e;">⚠️ Você será solicitado a trocar esta senha no primeiro login.</p>
          </div>
          <div style="text-align:center;margin:0 0 20px;">
            <a href="{FRONTEND_URL}" style="display:inline-block;background:#1B4332;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:0.95rem;letter-spacing:0.03em;">Acessar o sistema →</a>
          </div>
          <p style="font-size:0.78rem;color:#6b7280;margin:0;">Ou acesse: <a href="{FRONTEND_URL}" style="color:#1B4332;">{FRONTEND_URL}</a></p>
        </td></tr>
        <tr><td style="padding:16px 40px;text-align:center;border-top:1px solid #d1c9bf;">
          <p style="margin:0;font-size:0.72rem;color:#a0a0a0;">© 2026 AMSI — Este é um email automático.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""
                enviado = enviar_email(admin_data["email"], "Sua senha de acesso — AMSI Project", corpo)
                if enviado:
                    print(colorir(cor="verde", texto=f"✔ Email enviado para {admin_data['email']}"))
                else:
                    print(colorir(cor="amarelo", texto=f"⚠ Falha ao enviar email para {admin_data['email']} — conta criada mesmo assim"))
            else:
                print(colorir(cor="verde", texto=f"✔ Admin {admin_data['email']} já existe — senha preservada."))

        # ── Usuários de teste: upsert (cria ou sobrescreve) ─────────────────
        for dados in USUARIOS_TESTE:
            _upsert_usuario_teste(db, dados)

        db.commit()
        print(colorir(cor="verde", texto="\n✨ Processo de semente concluído com sucesso."))

    except Exception as e:
        db.rollback()
        logging.error(f"Erro ao executar bootstrap: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    garantir_admins_iniciais()
