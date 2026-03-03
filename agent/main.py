import sys
import os
import time
import socket
from pathlib import Path

# Fix sys.path for NSSM/Windows Service
_current_dir = os.path.dirname(os.path.abspath(__file__))
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

from src import config
from src.utils.logger import setup_logger
from src.security import get_hardware_fingerprint
from src.api_client import ApiClient

from src.collectors.hardware import get_hardware_info
from src.collectors.software import get_software_list
from src.features.wallpaper import WallpaperManager
from src.features.kiosk import KioskManager
from src.commands.executor import CommandExecutor
from src.commands.parser import is_command_expired
from src.features.updater import execute_installer

logger = setup_logger(__name__)

class AgentOrchestrator:
    def __init__(self):
        self.api = ApiClient()
        self.machine_id = get_hardware_fingerprint().hex()
        
        self.agent_dir = Path(__file__).resolve().parent
        if getattr(sys, 'frozen', False):
             self.agent_dir = Path(sys.executable).resolve().parent
             
        self.version_file = self.agent_dir / ".agent_version"
        
        self.wallpaper_man = WallpaperManager(self.api)
        self.kiosk_man = KioskManager(str(self.agent_dir))
        self.cmd_executor = CommandExecutor(str(self.agent_dir), self.api)

    def get_current_version(self) -> str:
        """Get the current agent version."""
        if self.version_file.exists():
            try:
                return self.version_file.read_text().strip()
            except Exception as e:
                logger.debug(f"Could not read .agent_version: {e}")
                
        fallback_version = self.agent_dir / "VERSION"
        if fallback_version.exists():
            try:
                return fallback_version.read_text().strip()
            except Exception as e:
                logger.debug(f"Could not read VERSION: {e}")
                
        return "1.0.0"

    def login(self) -> bool:
        """Authenticate or Register with the backend."""
        # Tenta carregar token local no ApiClient
        if self.api.computer_id:
            logger.info("Chave API válida encontrada localmente.")
            return True
            
        logger.warning("Nenhuma chave API local encontrada. Iniciando fluxo de provisionamento...")
        
        if config.INSTALLATION_TOKEN:
            logger.info("Token de instalação detectado. Tentando registrar no laboratório...")
            try:
                hardware_info = get_hardware_info()
                payload = {
                    'installation_token': config.INSTALLATION_TOKEN,
                    'machine_id': self.machine_id,
                    'hardware_info': hardware_info,
                    'hostname': socket.gethostname(),
                    'agent_version': self.get_current_version()
                }
                
                if hardware_info.get('network') and len(hardware_info['network']) > 0:
                   payload['wol_mac'] = hardware_info['network'][0].get('mac')

                logger.info(f"Registrando agente (versão {payload['agent_version']}) com Token: {config.INSTALLATION_TOKEN[:8]}...")
                
                response = self.api.post('/agents/register', json=payload)
                response.raise_for_status()
                
                data = response.json()
                from src.security import save_api_key
                if save_api_key(data['api_key'], data['computer_id']):
                    logger.info("Agente registrado e chave API salva com sucesso.")
                    self.api._load_token()
                    return True
                else:
                    logger.error("Falha ao salvar a chave API localmente.")
                    return False
            except Exception as e:
                logger.error(f"Falha no registro: {e}")
                
        return False

    def send_metrics_report(self) -> bool:
        """Send lightweight metrics report to backend."""
        if not self.api.computer_id:
            return False
            
        import psutil
        try:
            memory = psutil.virtual_memory()
            
            disk_info = []
            for part in psutil.disk_partitions(all=False):
                if 'cdrom' in part.opts or part.fstype == '': continue
                try:
                    usage = psutil.disk_usage(part.mountpoint)
                    disk_info.append({
                        'mount': part.mountpoint,
                        'percent': usage.percent,
                        'free_gb': round(usage.free / (1024**3), 2),
                        'total_gb': round(usage.total / (1024**3), 2)
                    })
                except Exception:
                    pass
                    
            metrics = {
                'cpu_usage_percent': psutil.cpu_percent(interval=1),
                'memory_usage_percent': memory.percent,
                'memory_total_gb': round(memory.total / (1024**3), 2),
                'memory_free_gb': round(memory.available / (1024**3), 2),
                'disk_usage': disk_info,
                'network_stats': {
                    'bytes_sent': psutil.net_io_counters().bytes_sent,
                    'bytes_recv': psutil.net_io_counters().bytes_recv,
                },
                'uptime_seconds': int(time.time() - psutil.boot_time()),
                'processes_count': len(psutil.pids()),
            }
            response = self.api.post(f"/computers/{self.api.computer_id}/metrics", json=metrics)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Erro ao enviar métricas: {e}")
            return False

    def send_detailed_report(self) -> bool:
        """Send detailed hardware and software report to backend."""
        if not self.api.computer_id:
            return False
            
        try:
            hardware = get_hardware_info()
            software = get_software_list()
            
            payload = {
                'hardware_info': hardware,
                'softwares': software,
                'agent_version': self.get_current_version(),
                'hostname': socket.gethostname()
            }
            
            response = self.api.post(f"/computers/{self.api.computer_id}/report", json=payload)
            return response.status_code in [200, 201]
        except Exception as e:
            logger.error(f"Erro ao enviar relatório detalhado: {e}")
            return False

    def check_commands(self):
        """Check for pending remote commands."""
        if not self.api.computer_id:
            return
            
        try:
            response = self.api.get(f"/computers/{self.api.computer_id}/commands/pending")
            if response.status_code != 200:
                return
                
            commands = response.json()
            if not isinstance(commands, list):
                commands = commands.get('data', [])
                
            for cmd in commands:
                command_id = cmd.get('id')
                
                if is_command_expired(cmd):
                    self.update_command_status(command_id, 'failed', 'Comando expirado')
                    continue
                    
                self.update_command_status(command_id, 'processing')
                output = self.cmd_executor.execute(cmd)
                self.update_command_status(command_id, 'completed', output)
                
        except Exception as e:
            logger.error(f"Erro ao verificar comandos: {e}")
            
    def update_command_status(self, command_id: int, status: str, output: str = None):
        try:
            payload = {'status': status}
            if output is not None:
                payload['output'] = output
                
            self.api.put(f"/commands/{command_id}/status", json=payload)
        except Exception as e:
            logger.error(f"Erro ao atualizar status do comando {command_id}: {e}")

    def run(self):
        """Main orchestrator execution loop."""
        logger.info(f"Iniciando Coletty Agent V{self.get_current_version()} (Orquestrador modular)")
        
        while True:
            try:
                if not self.login():
                    logger.warning(f"Login falhou. Retentando em {config.POLL_INTERVAL}s")
                    time.sleep(config.POLL_INTERVAL)
                    continue

                # Kiosk & Wallpaper logic
                self.kiosk_man.enforce_kiosk_process()
                self.wallpaper_man.enforce_lab_wallpaper()
                
                # Check commands frequently
                self.check_commands()
                
                # Setup timers
                current_time = time.time()
                if not hasattr(self, 'last_metrics_time') or (current_time - self.last_metrics_time) >= config.METRICS_INTERVAL:
                    if self.send_metrics_report():
                        self.last_metrics_time = current_time
                        
                if not hasattr(self, 'last_report_time') or (current_time - self.last_report_time) >= config.REPORT_INTERVAL:
                    if self.send_detailed_report():
                        self.last_report_time = current_time

            except Exception as e:
                 logger.error(f"Erro no loop principal: {e}")
            
            time.sleep(config.POLL_INTERVAL)

if __name__ == "__main__":
    agent = AgentOrchestrator()
    agent.run()
