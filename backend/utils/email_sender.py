import smtplib
import logging
from email.mime.text import MIMEText
from utils.config import EMAIL_REMETENTE, EMAIL_SENHA_APP


def enviar_email(destinatario: str, assunto: str, corpo: str) -> bool:
    msg = MIMEText(corpo, "html", "utf-8")
    msg["Subject"] = assunto
    msg["From"] = EMAIL_REMETENTE
    msg["To"] = destinatario

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(EMAIL_REMETENTE, EMAIL_SENHA_APP)
            server.send_message(msg)
        logging.info(f"Email enviado para {destinatario}")
        return True
    except Exception as e:
        logging.warning(f"Falha ao enviar email para {destinatario}: {e}")
        return False