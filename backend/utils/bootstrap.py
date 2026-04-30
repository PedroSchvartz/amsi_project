import logging
import sys
import os
import secrets
import string

sys.path.append(os.getcwd())

from sqlalchemy.orm import Session
from database import SessionLocal
from models.usuario import Usuario, CargoEnum, AcessoEnum
from utils.auth_utils import hash_senha
from utils.email_sender import enviar_email
from utils.frequentes import configure_logging, colorir


def _gerar_senha_provisoria(tamanho: int = 12) -> str:
    caracteres = string.ascii_letters + string.digits + "!@#$%&*"
    return "".join(secrets.choice(caracteres) for _ in range(tamanho))


def garantir_admins_iniciais():
    configure_logging()
    db: Session = SessionLocal()

    ADMINS_INICIAIS = [
        {
            "email": "opedroschvartz@gmail.com",
            "nome": "Pedro Schvartz",
            "cargo": CargoEnum.Diretor,
            "perfil_de_acesso": AcessoEnum.Administrador
        },
        {
            "email": "nicolasmoreira206profissional@gmail.com",
            "nome": "Nicolas Moreira",
            "cargo": CargoEnum.Diretor,
            "perfil_de_acesso": AcessoEnum.Administrador
        }
    ]

    try:
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
                    primeiro_acesso=True
                )
                db.add(novo_admin)
                db.flush()

                corpo = f"""
                <h2>Bem-vindo ao AMSI Project</h2>
                <p>Sua conta de administrador foi criada. Use a senha abaixo para seu primeiro acesso:</p>
                <h3 style="background:#f4f4f4;padding:10px;letter-spacing:2px;">{senha_provisoria}</h3>
                <p>Você será solicitado a trocar a senha no primeiro login.</p>
                """
                enviado = enviar_email(admin_data["email"], "Sua senha de acesso — AMSI Project", corpo)
                if enviado:
                    print(colorir(cor="verde", texto=f"✔ Email enviado para {admin_data['email']}"))
                else:
                    print(colorir(cor="amarelo", texto=f"⚠ Falha ao enviar email para {admin_data['email']} — conta criada mesmo assim"))
            else:
                print(colorir(cor="verde", texto=f"✔ Admin {admin_data['email']} já existe."))

        db.commit()
        print(colorir(cor="verde", texto="\n✨ Processo de semente concluído com sucesso."))

    except Exception as e:
        db.rollback()
        logging.error(f"Erro ao executar bootstrap: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    garantir_admins_iniciais()