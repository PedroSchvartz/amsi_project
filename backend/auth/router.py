import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from database import get_db
from models.usuario import Usuario
from models.login import Login
from models.token_ativo import TokenAtivo
from utils.auth_utils import verificar_senha, criar_token_acesso, hash_senha
from utils.email_sender import enviar_email
from utils.config import FRONTEND_URL
from utils.config import JWT_EXPIRE_MINUTES
from utils.senha_token import (
    gerar_token_senha,
    consumir_token_senha,
    inspecionar_token_senha,
    _link_definir_senha,
    FINALIDADE_RESET,
)
from utils.rate_limit import limiter
from auth.dependencies import get_current_user, get_current_user_with_jti

router = APIRouter(
    prefix="/auth",
    tags=["Autenticação"]
)


class LoginRequest(BaseModel):
    email: EmailStr
    senha: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    primeiro_acesso: bool = False


class TrocarSenhaRequest(BaseModel):
    senha_atual: str
    senha_nova: str


class EsqueciSenhaRequest(BaseModel):
    email: EmailStr


class DefinirSenhaRequest(BaseModel):
    token: str
    senha_nova: str


class ValidarTokenRequest(BaseModel):
    token: str


def _emitir_sessao(db: Session, usuario: Usuario, request: Request, response: Response) -> TokenResponse:
    """Cria uma sessão (Login + TokenAtivo + JWT) e devolve o TokenResponse, derrubando
    sessões anteriores (sessão única). Compartilhado por /auth/token e /auth/definir-senha."""
    # Invalidar tokens anteriores do usuário (sessão única)
    db.query(TokenAtivo).filter(TokenAtivo.id_usuario_fk == usuario.id_usuario).delete()

    # Registrar sessão na tabela login
    user_agent = request.headers.get("user-agent", "desconhecido")
    forwarded_for = request.headers.get("x-forwarded-for")
    ip = forwarded_for.split(",")[0].strip() if forwarded_for else (request.client.host if request.client else "desconhecido")

    sessao = Login(
        id_usuario_fk=usuario.id_usuario,
        dispositivo_logado=user_agent[:255],
        localizacao=ip[:255],
        navegador=user_agent[:255]
    )
    db.add(sessao)
    db.flush()  # garante que sessao.id_login está disponível antes do commit

    # Gerar token e salvar na tabela token_ativo
    token = criar_token_acesso({
        "sub": str(usuario.id_usuario),
        "perfil": usuario.perfil_de_acesso.value
    })

    from jose import jwt as jose_jwt
    from utils.config import JWT_SECRET_KEY, JWT_ALGORITHM
    payload = jose_jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

    token_ativo = TokenAtivo(
        jti=payload["jti"],
        id_usuario_fk=usuario.id_usuario,
        exp=datetime.utcfromtimestamp(payload["exp"]),
        id_login_fk=sessao.id_login,
    )
    db.add(token_ativo)
    db.commit()

    # Injetar X-Session-Expires no response
    exp_ms = int(datetime.utcfromtimestamp(payload["exp"]).timestamp() * 1000)
    response.headers["X-Session-Expires"] = str(exp_ms)

    return TokenResponse(access_token=token, primeiro_acesso=usuario.primeiro_acesso)


@router.post("/token", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(dados: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(
        Usuario.email == dados.email,
        Usuario.exclusao == None  # noqa: E711
    ).first()

    if not usuario or not verificar_senha(dados.senha, usuario.senha):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos"
        )

    if usuario.bloqueado:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário bloqueado")

    if usuario.suspenso and usuario.suspenso > datetime.now():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário suspenso")

    if usuario.exclusao is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário removido")

    return _emitir_sessao(db, usuario, request, response)


@router.post("/logout")
def logout(
    db: Session = Depends(get_db),
    user_and_jti: tuple = Depends(get_current_user_with_jti)
):
    usuario, jti = user_and_jti

    # Deletar token ativo
    db.query(TokenAtivo).filter(TokenAtivo.jti == jti).delete()

    # Registrar data_logout no login ativo
    login_ativo = db.query(Login).filter(
        Login.id_usuario_fk == usuario.id_usuario,
        Login.data_logout == None
    ).order_by(Login.data_login.desc()).first()

    if login_ativo:
        login_ativo.data_logout = datetime.now()

    db.commit()
    return {"detail": "Logout realizado com sucesso"}


@router.post("/trocar-senha")
def trocar_senha(
    dados: TrocarSenhaRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    if not verificar_senha(dados.senha_atual, current_user.senha):
        raise HTTPException(status_code=401, detail="Senha atual incorreta")

    current_user.senha = hash_senha(dados.senha_nova)
    current_user.primeiro_acesso = False
    db.commit()

    try:
        enviado = enviar_email(
            current_user.email,
            "Senha alterada — AMSI Project",
f"""
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
          <p style="font-size:1.3rem;font-weight:600;color:#1B4332;margin:0 0 8px;">Senha alterada com sucesso 🔒</p>
          <p style="color:#6b7280;margin:0 0 20px;">Olá, <strong style="color:#2C2C2C;">{current_user.nome}</strong>! Sua senha foi alterada com sucesso. Você já pode acessar o sistema com a nova senha.</p>
          <div style="text-align:center;margin:0 0 20px;">
            <a href="{FRONTEND_URL}" style="display:inline-block;background:#1B4332;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:0.95rem;letter-spacing:0.03em;">Acessar o sistema →</a>
          </div>
          <p style="font-size:0.78rem;color:#6b7280;margin:0;">Ou acesse: <a href="{FRONTEND_URL}" style="color:#1B4332;">{FRONTEND_URL}</a></p>
          <p style="font-size:0.78rem;color:#6b7280;margin:12px 0 0;">Se não foi você quem fez essa alteração, entre em contato com o administrador imediatamente.</p>
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
        )
        if not enviado:
            logging.warning(
                f"Senha de {current_user.email} alterada, mas e-mail de confirmação falhou."
            )
    except Exception as e:
        logging.warning(
            f"Erro ao enviar e-mail de confirmação para {current_user.email}: {e}"
        )

    return {"detail": "Senha alterada com sucesso"}


# ─── Definição de senha por token (cadastro / reset / esqueci a senha) ─────────

_MENSAGEM_NEUTRA_ESQUECI = {
    "detail": "Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha."
}


@router.post("/esqueci-senha")
@limiter.limit("5/minute")
def esqueci_senha(dados: EsqueciSenhaRequest, request: Request, db: Session = Depends(get_db)):
    """Autoatendimento de 'esqueci a senha'. Resposta SEMPRE 200 e neutra — não revela se o
    e-mail existe (sem enumeração). Se houver usuário ativo, gera token de reset e envia o link."""
    usuario = db.query(Usuario).filter(
        Usuario.email == dados.email,
        Usuario.exclusao == None  # noqa: E711
    ).first()
    if not usuario:
        return _MENSAGEM_NEUTRA_ESQUECI

    token = gerar_token_senha(db, usuario, FINALIDADE_RESET, ttl_horas=48)
    _link_acesso = _link_definir_senha(token)
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
          <p style="font-size:1.3rem;font-weight:600;color:#1B4332;margin:0 0 8px;">Redefinição de senha 🔐</p>
          <p style="color:#6b7280;margin:0 0 20px;">Olá, <strong style="color:#2C2C2C;">{usuario.nome}</strong>! Recebemos um pedido para redefinir a sua senha. Clique no botão abaixo para criar uma nova senha.</p>
          <div style="text-align:center;margin:0 0 20px;">
            <a href="{_link_acesso}" style="display:inline-block;background:#1B4332;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:0.95rem;letter-spacing:0.03em;">Redefinir minha senha →</a>
          </div>
          <div style="background:#fef9ec;border-left:4px solid #C9A84C;padding:12px 16px;border-radius:4px;margin:0 0 20px;">
            <p style="margin:0;font-size:0.85rem;color:#92400e;">⚠️ Este link expira em 48 horas. Se você não solicitou, ignore este e-mail — sua senha atual continua valendo.</p>
          </div>
          <p style="font-size:0.78rem;color:#6b7280;margin:0;word-break:break-all;">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="{_link_acesso}" style="color:#1B4332;">{_link_acesso}</a></p>
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
    enviado = enviar_email(usuario.email, "Redefinição de senha — AMSI Project", corpo)
    if not enviado:
        # Mesmo em falha de envio mantemos a resposta neutra (não vazar estado).
        db.rollback()
        return _MENSAGEM_NEUTRA_ESQUECI

    db.commit()
    return _MENSAGEM_NEUTRA_ESQUECI


@router.post("/definir-senha", response_model=TokenResponse)
def definir_senha(dados: DefinirSenhaRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    """Define a senha a partir de um token de uso único (cadastro, reset ou esqueci-senha).
    Consome o token, grava a nova senha e já emite uma sessão (auto-login)."""
    if len(dados.senha_nova) < 6:
        raise HTTPException(status_code=400, detail="A senha deve ter pelo menos 6 caracteres.")

    usuario = consumir_token_senha(db, dados.token)
    if not usuario:
        raise HTTPException(status_code=400, detail="Link inválido ou expirado. Solicite um novo.")

    usuario.senha = hash_senha(dados.senha_nova)
    usuario.primeiro_acesso = False
    # _emitir_sessao derruba sessões antigas e comita tudo (token consumido + senha + sessão).
    return _emitir_sessao(db, usuario, request, response)


@router.post("/validar-token-senha")
def validar_token_senha(dados: ValidarTokenRequest, db: Session = Depends(get_db)):
    """Verifica (sem consumir) se um token de definição de senha é válido. Permite à tela
    saudar o usuário e mostrar 'link expirado' antes de ele digitar a nova senha."""
    usuario = inspecionar_token_senha(db, dados.token)
    if not usuario:
        return {"valido": False, "nome": None}
    return {"valido": True, "nome": usuario.nome}