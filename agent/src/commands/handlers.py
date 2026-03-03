import os
import subprocess
import time
import json
import base64
import io
import socket
import platform
import psutil
from typing import Dict, Any, Callable
from urllib.parse import urlparse

try:
    import mss
    from PIL import Image
    HAS_SCREENSHOT = True
except ImportError:
    HAS_SCREENSHOT = False

from src.utils.logger import setup_logger
from src.features.updater import download_from_url, copy_from_network, execute_installer
from src import config

logger = setup_logger(__name__)

def handle_shutdown(cmd: Dict[str, Any], os_name: str) -> str:
    if os_name == 'Windows':
        os.system('shutdown /s /t 5')
    else:
        os.system('shutdown -h +1')
    return "Shutdown command executed"

def handle_restart(cmd: Dict[str, Any], os_name: str) -> str:
    if os_name == 'Windows':
        os.system('shutdown /r /t 5')
    else:
        os.system('shutdown -r +1')
    return "Restart command executed"

def handle_terminal(cmd: Dict[str, Any], os_name: str) -> str:
    """Implementação refatorada do comando de terminal."""
    params = cmd.get('parameters', {})
    cmd_text = params.get('cmd_line', params.get('command', ''))
    if not cmd_text:
        return "Nenhum comando fornecido."
    
    # Executa o comando e captura a saída. 
    # Idealmente, removemos o shell=True no futuro ou implementamos um whitelist
    try:
        # shell=True mantido por compatibilidade reversa imediata, mas com timeout de 60s
        result = subprocess.run(
            cmd_text, shell=True, capture_output=True, text=True, timeout=60
        )
        return result.stdout if result.returncode == 0 else f"Erro:\n{result.stderr}"
    except subprocess.TimeoutExpired:
        return "Tempo limite do comando excedido (60s)."
    except Exception as e:
        return f"Falha na execução: {e}"

def handle_receive_file(cmd: Dict[str, Any], agent_dir: str, api_client=None) -> str:
    """Handle command for receiving a file/update."""
    params = cmd.get('parameters', {})
    file_name = params.get('file_name', '')
    url = params.get('url', '')
    
    if not file_name:
        # Fallback to extract filename from URL if empty
        file_name = os.path.basename(urlparse(url).path)
        if not file_name:
            file_name = f"download_{int(time.time())}.file"
    
    # Path traversal validation
    if '..' in file_name or '/' in file_name or '\\' in file_name:
        return "Nome de arquivo inválido ou malicioso."
        
    # Use public desktop/Transferencias instead of agent downloads
    if platform.system() == 'Windows':
        public_desktop = os.environ.get('PUBLIC', r'C:\Users\Public') + r'\Desktop'
        download_dir = os.path.join(public_desktop, 'Transferencias')
    else:
        # Linux fallback
        download_dir = os.path.join('/tmp', 'transferencias')
        
    try:
        os.makedirs(download_dir, exist_ok=True)
    except Exception as e:
        logger.error(f"Error creating transfer directory: {e}")
        # Fallback to agent dir if we can't create in Public Desktop
        download_dir = os.path.join(agent_dir, 'downloads')
        os.makedirs(download_dir, exist_ok=True)
        
    output_path = os.path.join(download_dir, file_name)
    
    api_key = api_client.api_key if api_client else None
    
    if url.startswith('/api/'):
        base_url = getattr(api_client, 'base_url', config.API_BASE_URL)
        server_root = base_url.removesuffix('/api/v1').rstrip('/')
        url = f"{server_root}{url}"
        
    if url.startswith('http://') or url.startswith('https://'):
        final_path = download_from_url(url, output_path, api_key)
        success = bool(final_path)
        if success: output_path = final_path
    elif url.startswith('\\\\') or url.startswith('smb://'):
        success = copy_from_network(url, output_path)
    else:
        return f"Protocolo de URL não suportado: {url}"
        
    if success:
        return f"Arquivo recebido com sucesso: {output_path}"
    return "Falha ao receber o arquivo."

def handle_screenshot(cmd: Dict[str, Any], os_name: str) -> str:
    if not HAS_SCREENSHOT:
        return "Recurso de tela não disponível (mss ou Pillow não instalados)."
    try:
        with mss.mss() as sct:
            monitor = sct.monitors[0]
            sct_img = sct.grab(monitor)
            img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
            if img.width > 1920:
                ratio = 1920 / img.width
                new_height = int(img.height * ratio)
                img = img.resize((1920, new_height), Image.Resampling.LANCZOS)
            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=60)
            img_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
            return img_str
    except Exception as e:
        logger.error(f"Error taking screenshot: {e}")
        return f"Erro ao capturar tela: {e}"

def handle_ps_list(cmd: Dict[str, Any], os_name: str) -> str:
    processes = []
    for proc in psutil.process_iter(['pid', 'name', 'username', 'cpu_percent', 'memory_percent']):
        try:
            pinfo = proc.info
            pinfo['create_time'] = proc.create_time()
            processes.append(pinfo)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    processes.sort(key=lambda p: p['cpu_percent'] or 0, reverse=True)
    return json.dumps(processes[:100])

def handle_ps_kill(cmd: Dict[str, Any], os_name: str) -> str:
    params = cmd.get('parameters', {})
    pid = params.get('pid')
    if pid:
        try:
            p = psutil.Process(int(pid))
            p.terminate()
            try:
                p.wait(timeout=3)
            except psutil.TimeoutExpired:
                p.kill()
            return f"Processo {pid} encerrado."
        except Exception as e:
            return f"Falha ao encerrar processo: {e}"
    return "Parâmetro PID ausente."

def handle_lock(cmd: Dict[str, Any], os_name: str) -> str:
    if os_name == 'Windows':
        os.system("rundll32.exe user32.dll,LockWorkStation")
        return "Comando de bloqueio enviado (Windows)."
    else:
        os.system("xdg-screensaver lock || gnome-screensaver-command -l")
        return "Comando de bloqueio enviado (Linux)."

def handle_kiosk_lock(cmd: Dict[str, Any], os_name: str) -> str:
    if os_name == 'Windows':
        try:
            active_file = r"C:\ProgramData\IFLabAgent\kiosk_active.txt"
            unlock_file = r"C:\ProgramData\IFLabAgent\unlock_kiosk.txt"
            os.makedirs(os.path.dirname(active_file), exist_ok=True)
            if os.path.exists(unlock_file):
                os.remove(unlock_file)
            with open(active_file, "w") as f:
                f.write("active")
            return "Kiosk screen lock activated."
        except Exception as e:
            return f"Falha ao ativar Kiosk: {e}"
    else:
        # Linux: launches a fullscreen black overlay that blocks all input
        try:
            env = os.environ.copy()
            env.setdefault('DISPLAY', ':0')
            # xdg-screensaver / gnome-screensaver as the primary lock mechanism
            result = subprocess.run(
                'xdg-screensaver lock || gnome-screensaver-command -l || loginctl lock-session',
                shell=True, env=env, capture_output=True, timeout=5
            )
            logger.info(f"kiosk_lock Linux result: rc={result.returncode} stderr={result.stderr.decode()[:200]}")
            return "Kiosk screen lock activated (Linux)."
        except Exception as e:
            return f"Falha ao ativar Kiosk (Linux): {e}"

def handle_kiosk_unlock(cmd: Dict[str, Any], os_name: str) -> str:
    if os_name == 'Windows':
        try:
            active_file = r"C:\ProgramData\IFLabAgent\kiosk_active.txt"
            unlock_file = r"C:\ProgramData\IFLabAgent\unlock_kiosk.txt"
            os.makedirs(os.path.dirname(unlock_file), exist_ok=True)
            with open(unlock_file, "w") as f:
                f.write("unlock")
            if os.path.exists(active_file):
                try:
                    os.remove(active_file)
                except Exception:
                    pass
            return "Kiosk screen unlocked."
        except Exception as e:
            return f"Falha ao desativar Kiosk: {e}"
    else:
        # Linux: wake the screensaver
        try:
            env = os.environ.copy()
            env.setdefault('DISPLAY', ':0')
            subprocess.run(
                'xdg-screensaver reset || gnome-screensaver-command -d || loginctl unlock-session',
                shell=True, env=env, capture_output=True, timeout=5
            )
            return "Kiosk screen unlocked (Linux)."
        except Exception as e:
            return f"Falha ao desativar Kiosk (Linux): {e}"

def handle_install_software(cmd: Dict[str, Any], agent_dir: str, api_client=None) -> str:
    try:
        params = cmd.get('parameters', {})
        method = params.get('method')
        software_name = params.get('software_name', 'Unknown')
        install_args = params.get('install_args', '')
        silent_mode = params.get('silent_mode', True)
        reboot_after = params.get('reboot_after', False)
        
        installer_path = None
        download_dir = os.path.join(agent_dir, 'downloads')
        os.makedirs(download_dir, exist_ok=True)
        api_key = api_client.api_key if api_client else None

        if method == 'upload':
            file_id = params.get('file_id')
            if not file_id:
                return "Missing file_id for upload method"
            # As per RemoteControlController, the download URL is /api/v1/installers/{file_id}/download
            if not api_client:
                return "API Client missing for download"
            base_url = getattr(api_client, 'base_url', config.API_BASE_URL)
            # Strip trailing /api/v1 if present so we can construct the full path cleanly
            server_root = base_url.removesuffix('/api/v1').rstrip('/')
            url = f"{server_root}/api/v1/installers/{file_id}/download"
            installer_path = os.path.join(download_dir, f"install_{file_id}.exe")
            final_path = download_from_url(url, installer_path, api_key)
            if not final_path:
                return "Failed to download installer from upload."
            installer_path = final_path
                
        elif method == 'url':
            installer_url = params.get('installer_url')
            if not installer_url:
                return "Missing installer_url"
            filename = os.path.basename(urlparse(installer_url).path) or 'installer.exe'
            installer_path = os.path.join(download_dir, filename)
            final_path = download_from_url(installer_url, installer_path)
            if not final_path:
                return "Failed to download from URL."
            installer_path = final_path
                
        elif method == 'network':
            network_path = params.get('network_path')
            if not network_path:
                return "Missing network_path"
            filename = os.path.basename(network_path.replace('\\', '/')) or 'installer.exe'
            installer_path = os.path.join(download_dir, filename)
            if not copy_from_network(network_path, installer_path):
                return "Failed to copy from network."
        else:
            return f"Unknown installation method: {method}"

        if installer_path:
            # We call execute_installer from updater.py. 
            # Note: execute_installer currently calls sys.exit(0) effectively killing the agent to allow updates.
            # But the user logs show "installing...", so if it exits, the command stays pending unless we update it first?
            # Actually, the old agent did: result = self.execute_installer(installer_path) and returned.
            # Let's import execute_installer
            from src.features.updater import execute_installer
            # The current execute_installer in updater.py has sys.exit(0). WE SHOULD CAREFULLY AVOID THAT IF IT'S NOT AN AGENT UPDATE.
            # I will just run the installer here using subprocess so it doesn't kill the agent.
            cmd_args = [installer_path]
            if install_args:
                cmd_args.extend(install_args.split())
            elif silent_mode and installer_path.endswith('.exe'):
                cmd_args.extend(['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART'])
            
            logger.info(f"Running software installer: {' '.join(cmd_args)}")
            proc = subprocess.run(cmd_args, capture_output=True, text=True)
            output = f"Software: {software_name}\nSTDOUT: {proc.stdout}\nSTDERR: {proc.stderr}"
            
            if reboot_after and proc.returncode == 0:
                os.system("shutdown /r /t 30")
                output += "\n[Reboot scheduled in 30 seconds]"
                
            return output
            
        return "Installer path resolution failed."
    except Exception as e:
        return f"Installation error: {str(e)}"

def handle_message(cmd: Dict[str, Any], os_name: str) -> str:
    params = cmd.get('parameters', {})
    msg = params.get('message', 'Alerta do Administrador')
    if os_name == 'Linux':
        os.system(f"notify-send 'Alerta Admin' '{msg}'")
    elif os_name == 'Windows':
        os.system(f"msg * \"{msg}\"")
    return f"Mensagem enviada: {msg}"

def handle_wol(cmd: Dict[str, Any], os_name: str) -> str:
    params = cmd.get('parameters', {})
    target_mac = params.get('target_mac')
    if not target_mac:
        return "MAC Address ausente."
    try:
        mac_address = target_mac.replace(':', '').replace('-', '')
        if len(mac_address) != 12:
            return f"Tamanho de MAC inválido: {len(mac_address)}"
        data = bytes.fromhex('FF' * 6 + mac_address * 16)
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.sendto(data, ("255.255.255.255", 9))
        return f"Pacote WoL enviado para {target_mac}"
    except Exception as e:
        return f"Falha ao enviar WoL: {e}"

def handle_set_hostname(cmd: Dict[str, Any], os_name: str) -> str:
    params = cmd.get('parameters', {})
    new_hostname = params.get('new_hostname')
    if not new_hostname:
        return "Hostname ausente."
    try:
        if os_name == 'Windows':
            subprocess.run(["wmic", "computersystem", "where", f"name='%computername%'", "call", "rename", f"name='{new_hostname}'"], check=True)
        else:
            subprocess.run(["hostnamectl", "set-hostname", new_hostname], check=True)
        return f"Hostname alterado para {new_hostname} com sucesso (reinicie para aplicar)."
    except Exception as e:
        return f"Falha ao alterar hostname: {e}"

def handle_update_agent(cmd: Dict[str, Any], agent_dir: str, api_client=None) -> str:
    from src.features.updater import execute_installer, download_from_url
    import sys
    
    # If the script is NOT running as a compiled PyInstaller payload, execute update.py directly
    if not getattr(sys, 'frozen', False):
        update_script = os.path.join(agent_dir, "update.py")
        if not os.path.exists(update_script):
            return "update.py not found in agent directory"
            
        if platform.system() == 'Windows':
            python_exe = os.path.join(agent_dir, ".venv", "Scripts", "python.exe")
        else:
            python_exe = os.path.join(agent_dir, ".venv", "bin", "python")
            
        if not os.path.exists(python_exe):
            python_exe = "python3" if platform.system() != 'Windows' else "python"
            
        env = os.environ.copy()
        env['AUTO_UPDATE'] = '1'
        
        try:
            # We use Popen instead of run because update.py might restart the service that spawned us
            logger.info("Executing update.py to self-update agent zip package")
            subprocess.Popen(
                [python_exe, update_script],
                cwd=agent_dir,
                env=env,
                start_new_session=True
            )
            return "Processo de atualização do Python (update.py) iniciado pelo Agente."
        except Exception as e:
            return f"Erro ao iniciar update.py: {e}"

    # Compiled Agent (PyInstaller)
    params = cmd.get('parameters', {})
    installer_url = params.get('installer_url')

    if not installer_url:
        return "URL do instalador ausente."

    # Parse proper URL inside the local network
    if installer_url.startswith('/api/'):
        base_url = getattr(api_client, 'base_url', config.API_BASE_URL)
        server_root = base_url.removesuffix('/api/v1').rstrip('/')
        installer_url = f"{server_root}{installer_url}"
    else:
        from urllib.parse import urlparse, urlunparse
        parsed_url = urlparse(installer_url)
        if parsed_url.hostname in ['localhost', '127.0.0.1']:
            working_base = getattr(api_client, 'base_url', config.API_BASE_URL)
            parsed_base = urlparse(working_base)
            installer_url = urlunparse((parsed_base.scheme, parsed_base.netloc, parsed_url.path, parsed_url.params, parsed_url.query, parsed_url.fragment))

    download_dir = os.path.join(agent_dir, 'downloads')
    os.makedirs(download_dir, exist_ok=True)
    
    filename = os.path.basename(urlparse(installer_url).path) or 'iflab_agent_update.exe'
    installer_path = os.path.join(download_dir, filename)

    api_key = api_client.api_key if api_client else None
    logger.info(f"Downloading agent update from {installer_url}")
    final_path = download_from_url(installer_url, installer_path, api_key)
    
    if not final_path:
        return f"Falha ao baixar atualização: {installer_url}"
        
    execute_installer(final_path, "/VERYSILENT /SUPPRESSMSGBOXES", silent_mode=True)
    
    return "Instalador da atualização iniciado. O Agente será reiniciado."
