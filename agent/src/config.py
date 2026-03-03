import os
from pathlib import Path
from dotenv import load_dotenv

# Fix path to .env when running as a service
_current_dir = os.path.dirname(os.path.abspath(__file__))
_root_dir = Path(_current_dir).parent

# Load .env file if it exists
dotenv_path = _root_dir / ".env"
if dotenv_path.exists():
    load_dotenv(dotenv_path)
else:
    load_dotenv()

# Server configuration
SERVER_URL = os.environ.get('SERVER_URL', 'http://127.0.0.1:8000')
API_BASE_URL = os.environ.get('API_BASE_URL', f"{SERVER_URL.rstrip('/')}/api/v1")

# Agent configuration
INSTALLATION_TOKEN = os.environ.get('INSTALLATION_TOKEN', '')
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO').upper()

# Timeouts and intervals
REQUEST_TIMEOUT = 30
POLL_INTERVAL = 5  # seconds
METRICS_INTERVAL = 60  # seconds
REPORT_INTERVAL = 3600  # seconds

# Legacy constants
MACHINE_ID_FILE = '.agent_identity'
