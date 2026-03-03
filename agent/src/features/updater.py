import os
import sys
import subprocess
import time
from pathlib import Path
from urllib.parse import urlparse
import requests

from src.utils.logger import setup_logger

logger = setup_logger(__name__)

def is_windows_service() -> bool:
    """Return True if the current process is running as a Windows service (Session 0)."""
    if sys.platform != "win32":
        return False
    try:
        import ctypes
        session_id = ctypes.c_uint32()
        ctypes.windll.kernel32.ProcessIdToSessionId(os.getpid(), ctypes.byref(session_id))
        return session_id.value == 0
    except Exception:
        return False

def download_from_url(url: str, output_path: str, api_key: str = None) -> str:
    """Download installer from external URL. Returns the final path or empty string on failure."""
    try:
        logger.info(f"Downloading from {url}...")
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        response = requests.get(url, stream=True, timeout=30, headers=headers)
        response.raise_for_status()
        
        # Try to get filename from Content-Disposition header
        final_path = output_path
        cd = response.headers.get('content-disposition', '')
        if 'filename=' in cd:
            import re
            fname = re.findall('filename="?([^";]*)"?', cd)
            if fname:
                extracted_name = fname[0]
                # If output_path is a directory or ends with generic name, use the extracted name
                if os.path.isdir(output_path) or os.path.basename(output_path).startswith('download_') or os.path.basename(output_path) == 'download':
                    final_path = os.path.join(os.path.dirname(output_path) if not os.path.isdir(output_path) else output_path, extracted_name)

        with open(final_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        logger.info(f"Download complete: {final_path}")
        return final_path
    except Exception as e:
        logger.error(f"Download failed: {e}")
        return ""

def copy_from_network(network_path: str, output_path: str) -> bool:
    """Copy installer from network share."""
    try:
        import shutil
        logger.info(f"Copying from {network_path}...")
        if not os.path.exists(network_path):
            raise FileNotFoundError(f"Network path not found: {network_path}")
            
        shutil.copy2(network_path, output_path)
        logger.info(f"Copy complete: {output_path}")
        return True
    except Exception as e:
        logger.error(f"Network copy failed: {e}")
        return False

def execute_installer(installer_path: str, install_args: str, silent_mode: bool = True):
    """Execute installer with appropriate arguments."""
    try:
        # P-Exec
        if installer_path.endswith('.exe'):
            cmd = [installer_path]
            if install_args:
                cmd.extend(install_args.split())
            elif silent_mode:
                cmd.extend(['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART'])
        # Linux/Mac Exec
        elif installer_path.endswith('.sh'):
            cmd = ['bash', installer_path]
        else:
            raise ValueError(f"Unsupported installer type: {installer_path}")

        logger.info(f"Running installer: {' '.join(cmd)}")
        
        if is_windows_service():
            import win32process
            import win32con
            import win32api
            import win32security
            
            # Start the installer in a separate process
            si = win32process.STARTUPINFO()
            pi = win32process.CreateProcess(
                None, 
                ' '.join(cmd), 
                None, None, False, 
                win32con.CREATE_NEW_CONSOLE, 
                None, 
                os.path.dirname(installer_path), 
                si
            )
            logger.info("Installer launched from service session.")
        else:
            # Not a service, run normally
            subprocess.Popen(cmd, start_new_session=True)
            
        logger.info("Installer started, agent will now exit to allow update.")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Failed to execute installer {installer_path}: {e}")
