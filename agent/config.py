import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Carrega .env na pasta do agente (onde está config.py) ou, se frozen (PyInstaller), no diretório do .exe
if getattr(sys, 'frozen', False):
    CLI_DIR = Path(sys.executable).resolve().parent
else:
    CLI_DIR = Path(__file__).resolve().parent

env_path = CLI_DIR / '.env'
load_dotenv(env_path)

# API Configuration
API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000/api/v1')
LAB_ID = int(os.getenv('LAB_ID', '1')) 

# Agent Identity / Auth
INSTALLATION_TOKEN = os.getenv('INSTALLATION_TOKEN', None)
AGENT_EMAIL = os.getenv('AGENT_EMAIL', None)
AGENT_PASSWORD = os.getenv('AGENT_PASSWORD', None)

# Agent Configuration
POLL_INTERVAL = int(os.getenv('POLL_INTERVAL', '30')) # Seconds
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
MACHINE_ID_FILE = '.machine_id'
