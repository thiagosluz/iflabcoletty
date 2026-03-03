import os
import subprocess
import time
from typing import Dict, Any, Optional

from src.utils.logger import setup_logger

logger = setup_logger(__name__)

def is_command_expired(cmd: Dict[str, Any], max_age_seconds: int = 300) -> bool:
    """Valida se um comando já expirou baseando-se no created_at."""
    created_at = cmd.get('created_at')
    if not created_at:
        return False
        
    try:
        from datetime import datetime, timezone
        if created_at.endswith('Z'):
            created_at = created_at[:-1] + '+00:00'
        cmd_time = datetime.fromisoformat(created_at)
        now = datetime.now(timezone.utc)
        age = (now - cmd_time).total_seconds()
        
        if age > max_age_seconds:
            logger.info(f"Comando '{cmd.get('command')}' expirado (age: {age}s). Ignorando.")
            return True
    except Exception as e:
        logger.warning(f"Erro ao parsear timezone do comando: {e}")
        
    return False
