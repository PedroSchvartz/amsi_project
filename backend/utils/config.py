import os
from pathlib import Path
from dotenv import load_dotenv

# Caminho absoluto para o config.env na raiz do projeto
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / "config.env")

# Auth
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback_dev_key_troque_em_producao")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", 5))
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Email
EMAIL_REMETENTE = os.getenv("EMAIL_REMETENTE", "")
EMAIL_SENHA_APP = os.getenv("EMAIL_SENHA_APP", "")

# Banco
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "ANSI_Project")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Ngrok
NGROK_TOKEN = os.getenv("NGROK_TOKEN", "")
NGROK_DOMAIN = os.getenv("NGROK_DOMAIN", "")

# Telegram
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_GROUP_ID = os.getenv("TELEGRAM_GROUP_ID", "")

# Aplicação
APP_ENV = os.getenv("APP_ENV", "development")
APP_HOST = os.getenv("APP_HOST", "localhost")
APP_PORT = int(os.getenv("APP_PORT", 8000))