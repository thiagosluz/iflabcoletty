import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Carrega .env na pasta do agente (onde está config.py) ou, se frozen (PyInstaller), no diretório do .exe
if getattr(sys, 'frozen', False):
    _agent_dir = Path(sys.executable).resolve().parent
else:
    _agent_dir = Path(__file__).resolve().parent
load_dotenv(_agent_dir / '.env')

# API Configuration
API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000/api/v1')
LAB_ID = int(os.getenv('LAB_ID', '1')) 

# Auth Configuration (The Agent acts as an Admin/User for now)
AGENT_EMAIL = os.getenv('AGENT_EMAIL', 'admin@iflab.com')
AGENT_PASSWORD = os.getenv('AGENT_PASSWORD', 'password')

# Agent Configuration
POLL_INTERVAL = int(os.getenv('POLL_INTERVAL', '30')) # Seconds
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
STORAGE_FILE = '.agent_identity'
