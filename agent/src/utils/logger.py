import logging
import os
import sys
from pathlib import Path

def setup_logger(name: str) -> logging.Logger:
    """Configures and returns a centralized logger."""
    logger = logging.getLogger(name)
    
    # Previne adicionar handlers múltiplos se já foi configurado
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
        
        # Handler para o Console
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
        
        # Decide onde salvar o arquivo de log baseado no modo execução (frozen vs source)
        if getattr(sys, 'frozen', False):
            base_dir = Path(sys.executable).resolve().parent
        else:
            base_dir = Path(__file__).resolve().parent.parent.parent
        
        log_dir = base_dir / 'logs'
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / 'agent.log'
        
        try:
            file_handler = logging.FileHandler(log_file, encoding='utf-8')
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)
        except Exception as e:
            # Caso não tenha permissão de escrita, loga apenas no console
            print(f"Aviso: Não foi possível criar o arquivo de log em {log_file}. Erro: {e}")
            
    return logger
