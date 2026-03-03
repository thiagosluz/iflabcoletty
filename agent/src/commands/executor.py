import platform
from typing import Dict, Any, Callable
from src.utils.logger import setup_logger
from src.commands.handlers import (
    handle_shutdown, handle_restart, handle_terminal, handle_receive_file,
    handle_screenshot, handle_ps_list, handle_ps_kill, handle_lock,
    handle_message, handle_wol, handle_set_hostname, handle_install_software,
    handle_kiosk_lock, handle_kiosk_unlock, handle_update_agent
)

logger = setup_logger(__name__)

class CommandExecutor:
    def __init__(self, agent_dir: str, api_client=None):
        self.os_name = platform.system()
        self.agent_dir = agent_dir
        self.api_client = api_client
        self.handlers = {
            'shutdown': lambda cmd: handle_shutdown(cmd, self.os_name),
            'restart': lambda cmd: handle_restart(cmd, self.os_name),
            'terminal': lambda cmd: handle_terminal(cmd, self.os_name),
            'receive_file': lambda cmd: handle_receive_file(cmd, self.agent_dir, self.api_client),
            'screenshot': lambda cmd: handle_screenshot(cmd, self.os_name),
            'ps_list': lambda cmd: handle_ps_list(cmd, self.os_name),
            'ps_kill': lambda cmd: handle_ps_kill(cmd, self.os_name),
            'lock': lambda cmd: handle_lock(cmd, self.os_name),
            'kiosk_lock': lambda cmd: handle_kiosk_lock(cmd, self.os_name),
            'kiosk_unlock': lambda cmd: handle_kiosk_unlock(cmd, self.os_name),
            'message': lambda cmd: handle_message(cmd, self.os_name),
            'wol': lambda cmd: handle_wol(cmd, self.os_name),
            'set_hostname': lambda cmd: handle_set_hostname(cmd, self.os_name),
            'install_software': lambda cmd: handle_install_software(cmd, self.agent_dir, self.api_client),
            'update_agent': lambda cmd: handle_update_agent(cmd, self.agent_dir, self.api_client),
        }

    def execute(self, cmd: Dict[str, Any]) -> str:
        """Route the command to the appropriate handler."""
        command_type = cmd.get('command')
        if not command_type:
            return "Comando vazio ou inválido."
        
        handler = self.handlers.get(command_type)
        if not handler:
            return f"Tipo de comando não suportado: {command_type}"
            
        try:
            logger.info(f"Executando comando '{command_type}'")
            return handler(cmd)
        except Exception as e:
            msg = f"Erro fatal ao executar {command_type}: {e}"
            logger.error(msg)
            return msg
