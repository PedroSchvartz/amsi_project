import logging
import requests
from utils.config import EMAIL_REMETENTE, BREVO_API_KEY


def enviar_email(destinatario: str, assunto: str, corpo: str) -> bool:
    if not BREVO_API_KEY:
        logging.warning("Email NÃO enviado: BREVO_API_KEY não configurada.")
        return False

    try:
        response = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={
                "api-key": BREVO_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "sender": {"name": "AMSI Project", "email": EMAIL_REMETENTE},
                "to": [{"email": destinatario}],
                "subject": assunto,
                "htmlContent": corpo,
            },
            timeout=15,
        )
        if response.status_code in (200, 201):
            logging.info(f"Email enviado via Brevo para {destinatario}")
            return True
        logging.warning(
            f"Brevo retornou {response.status_code} para {destinatario}: {response.text}"
        )
        return False
    except Exception as e:
        logging.warning(f"Falha ao enviar email para {destinatario}: {e}")
        return False
