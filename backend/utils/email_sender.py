import smtplib
import logging
import requests
from email.mime.text import MIMEText
from utils.config import EMAIL_REMETENTE, EMAIL_SENHA_APP, RESEND_API_KEY


def _enviar_via_resend(destinatario: str, assunto: str, corpo: str) -> bool:
    """Envia e-mail via API do Resend (HTTPS) — funciona no Railway."""
    response = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "from": f"AMSI Project <onboarding@resend.dev>",
            "to": [destinatario],
            "subject": assunto,
            "html": corpo,
        },
        timeout=15,
    )
    if response.status_code in (200, 201):
        logging.info(f"Email enviado via Resend para {destinatario}")
        return True
    logging.warning(
        f"Resend retornou {response.status_code} para {destinatario}: {response.text}"
    )
    return False


def _enviar_via_smtp(destinatario: str, assunto: str, corpo: str) -> bool:
    """Envia e-mail via SMTP SSL do Gmail (porta 465) — fallback e dev local."""
    if not EMAIL_REMETENTE or not EMAIL_SENHA_APP:
        logging.warning(
            "Email NÃO enviado: EMAIL_REMETENTE/EMAIL_SENHA_APP não configurados."
        )
        return False

    msg = MIMEText(corpo, "html", "utf-8")
    msg["Subject"] = assunto
    msg["From"] = EMAIL_REMETENTE
    msg["To"] = destinatario

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as server:
            server.login(EMAIL_REMETENTE, EMAIL_SENHA_APP)
            server.send_message(msg)
        logging.info(f"Email enviado via SMTP SSL para {destinatario}")
        return True
    except Exception as e:
        logging.warning(f"Falha ao enviar email via SMTP SSL para {destinatario}: {e}")
        return False


def enviar_email(destinatario: str, assunto: str, corpo: str) -> bool:
    """
    Tenta Resend primeiro (HTTPS 443 — funciona no Railway).
    Se Resend falhar (ex: sem domínio verificado → 403), cai para SMTP SSL porta 465.
    """
    if RESEND_API_KEY:
        if _enviar_via_resend(destinatario, assunto, corpo):
            return True
        logging.warning("Resend falhou — tentando SMTP SSL (porta 465) como fallback.")
    return _enviar_via_smtp(destinatario, assunto, corpo)
