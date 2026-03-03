import platform
import subprocess
from typing import List, Dict, Any

from src.utils.logger import setup_logger

logger = setup_logger(__name__)

def get_software_list() -> List[Dict[str, Any]]:
    """Collects installed software (Windows and Linux)."""
    softwares = []
    try:
        current_os = platform.system()
        if current_os == 'Windows':
            # Windows: Query registry for installed software
            import winreg
            
            # Registry paths for installed software
            registry_paths = [
                (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
                (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
                (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
            ]
            
            seen_names = set()  # Avoid duplicates
            
            for hkey, path in registry_paths:
                try:
                    key = winreg.OpenKey(hkey, path)
                    i = 0
                    while i < 1000:  # Limit iterations
                        try:
                            subkey_name = winreg.EnumKey(key, i)
                            subkey = winreg.OpenKey(key, subkey_name)
                            
                            try:
                                name = winreg.QueryValueEx(subkey, "DisplayName")[0]
                                version = None
                                vendor = None
                                
                                try:
                                    version = winreg.QueryValueEx(subkey, "DisplayVersion")[0]
                                except (FileNotFoundError, OSError):
                                    pass
                                
                                try:
                                    vendor = winreg.QueryValueEx(subkey, "Publisher")[0]
                                except (FileNotFoundError, OSError):
                                    pass
                                
                                # Skip if no name or already seen
                                if name and name not in seen_names:
                                    seen_names.add(name)
                                    softwares.append({
                                        'name': name,
                                        'version': version,
                                        'vendor': vendor
                                    })
                                    
                                    # Limit to 200 entries total
                                    if len(softwares) >= 200:
                                        break
                            
                            except (FileNotFoundError, OSError):
                                pass
                            finally:
                                winreg.CloseKey(subkey)
                            
                            i += 1
                        except OSError:
                            break
                    
                    winreg.CloseKey(key)
                    
                    if len(softwares) >= 200:
                        break
                
                except (FileNotFoundError, OSError, PermissionError) as e:
                    logger.debug(f"Could not access registry path {path}: {e}")
                    continue
            
        elif current_os == 'Linux':
            # Linux: Use dpkg
            result = subprocess.run(['dpkg', '-l'], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                for line in lines:
                    if line.startswith('ii'):
                        parts = line.split()
                        if len(parts) >= 3:
                            softwares.append({
                                'name': parts[1],
                                'version': parts[2],
                                'vendor': None
                            })
                # Limit to first 200 to avoid overwhelming the server
                softwares = softwares[:200]
    
    except Exception as e:
        logger.warning(f"Could not collect software list: {e}")
    
    return softwares
