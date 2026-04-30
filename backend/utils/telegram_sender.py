import requests

def enviar_telegram(mensagem):
    # Configurações fixas do seu sistema
    TOKEN = "8774446994:AAE3S4X9vAfU8ho3T7FKxotdFVRsM6jSF9Y"
    CHAT_ID = "6028171671"
    URL = f"https://api.telegram.org/bot{TOKEN}/sendMessage"
    
    payload = {
        "chat_id": CHAT_ID,
        "text": mensagem,
        "parse_mode": "HTML" # Permite usar <b>negrito</b>, etc.
    }

    try:
        requests.post(URL, data=payload, timeout=10)
    except Exception as e:
        print(f"Falha ao enviar Telegram: {e}")

# Exemplo de uso
print("Enviando mensagem...")
enviar_telegram("<b>Notificação:</b> O processo X foi concluído!")
print("Mensagem enviada!")