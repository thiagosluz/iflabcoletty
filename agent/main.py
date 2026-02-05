import sys
import time
import json
import os
import uuid
import platform
import logging
import requests
import socket
import psutil  # type: ignore[import-untyped]
import config
import mss  # type: ignore[import-untyped]
import mss.tools  # type: ignore
from PIL import Image
import io
import base64
import re
import subprocess
import tempfile
import tempfile
import shutil
from pathlib import Path

# Setup Logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class Agent:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        })
        self.token = None
        self.machine_id = self._get_or_create_machine_id()
        self.computer_db_id = None  # ID in the database
        self._cached_lab_wallpaper_url = None  # URL do papel de parede padrão do lab
        self._cached_lab_wallpaper_enabled = True  # Se o agente deve aplicar o wallpaper
        if getattr(sys, 'frozen', False):
            self.agent_dir = Path(sys.executable).resolve().parent
        else:
            self.agent_dir = Path(__file__).parent.absolute()
        self.version_file = self.agent_dir / ".agent_version"

    def _get_or_create_machine_id(self):
        """Get machine ID from file or generate new one."""
        if os.path.exists(config.STORAGE_FILE):
            try:
                with open(config.STORAGE_FILE, 'r') as f:
                    return f.read().strip()
            except Exception as e:
                logger.error(f"Error reading identity file: {e}")
        
        # Generate new ID
        new_id = str(uuid.uuid4())
        try:
            with open(config.STORAGE_FILE, 'w') as f:
                f.write(new_id)
        except Exception as e:
            logger.error(f"Error saving identity file: {e}")
        
        return new_id

    def login(self):
        """Authenticate with the backend to get a token."""
        url = f"{config.API_BASE_URL}/login"
        payload = {
            'email': config.AGENT_EMAIL,
            'password': config.AGENT_PASSWORD
        }
        
        try:
            logger.info("Attempting login...")
            response = self.session.post(url, json=payload, headers={'Accept': 'application/json'})
            response.raise_for_status()
            data = response.json()
            self.token = data.get('token')
            self.session.headers.update({'Authorization': f"Bearer {self.token}"})
            logger.info("Login successful.")
            return True
        except Exception as e:
            logger.error(f"Login failed: {e}")
            return False

    def get_hardware_info(self):
        """Collect hardware information."""
        try:
            cpu_count = psutil.cpu_count(logical=False)
            cpu_count_logical = psutil.cpu_count(logical=True)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # Network interfaces
            network_interfaces = []
            try:
                if_addrs = psutil.net_if_addrs()
                for interface_name, addresses in if_addrs.items():
                    interface_info = {'name': interface_name, 'ipv4': [], 'ipv6': [], 'mac': None}
                    for addr in addresses:
                        if addr.family == socket.AF_INET:
                            interface_info['ipv4'].append(addr.address)
                        elif addr.family == socket.AF_INET6:
                            # Filter out link-local ipv6 to reduce noise
                            if '%' not in addr.address:
                                interface_info['ipv6'].append(addr.address)
                        elif addr.family == psutil.AF_LINK:
                            interface_info['mac'] = addr.address
                    
                    # Only add if it has some address and skip loopback if desired
                    if interface_info['ipv4'] or interface_info['mac']:
                        network_interfaces.append(interface_info)
            except Exception as e:
                logger.warning(f"Could not collect network interfaces: {e}")

            return {
                'cpu': {
                    'physical_cores': cpu_count,
                    'logical_cores': cpu_count_logical,
                    'processor': platform.processor(),
                },
                'memory': {
                    'total_gb': round(memory.total / (1024**3), 2),
                    'available_gb': round(memory.available / (1024**3), 2),
                },
                'disk': {
                    'total_gb': round(disk.total / (1024**3), 2),
                    'used_gb': round(disk.used / (1024**3), 2),
                    'free_gb': round(disk.free / (1024**3), 2),
                },
                'network': network_interfaces,
                'os': {
                    'system': platform.system(),
                    'release': platform.release(),
                    'version': platform.version(),
                }
            }
        except Exception as e:
            logger.error(f"Error collecting hardware info: {e}")
            return {}

    def get_software_list(self):
        """Collect installed software (Windows and Linux)."""
        softwares = []
        try:
            if platform.system() == 'Windows':
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
                
            elif platform.system() == 'Linux':
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

    def get_current_version(self):
        """Get the current agent version.

        Priority:
        1) .agent_version (written by update.py)
        2) VERSION (shipped inside agent ZIP package)
        """
        if self.version_file.exists():
            try:
                with open(self.version_file, 'r') as f:
                    return f.read().strip()
            except Exception as e:
                logger.warning(f"Error reading version file: {e}")
        
        # Fallback to VERSION file (present in built ZIP packages)
        version_in_zip = self.agent_dir / "VERSION"
        if version_in_zip.exists():
            try:
                with open(version_in_zip, 'r') as f:
                    v = f.read().strip()
                    if v:
                        return v
            except Exception as e:
                logger.warning(f"Error reading VERSION file: {e}")
        return "0.0.0"

    def collect_data(self):
        """Collect system information."""
        return {
            'lab_id': config.LAB_ID,
            'machine_id': self.machine_id,
            'hostname': socket.gethostname(),
            'agent_version': self.get_current_version(),
        }

    def _find_computer_by_machine_id(self, bypass_cache=False):
        """Search for computer by machine_id using exact match endpoint first, then fallback to search."""
        # First, try the exact match endpoint (faster and more reliable)
        try:
            exact_url = f"{config.API_BASE_URL}/computers/by-machine-id/{self.machine_id}"
            response = self.session.get(exact_url)
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                # Computer not found, return None
                return None
            # If other error, fall through to search method
        except Exception as e:
            logger.warning(f"Exact match endpoint failed: {e}. Falling back to search method.")
        
        # Fallback: Search for computer by machine_id across all pages
        # Add timestamp to bypass cache if needed
        cache_buster = f"&_bypass_cache=true&_t={int(time.time())}" if bypass_cache else ""
        search_url = f"{config.API_BASE_URL}/computers?search={self.machine_id}&per_page=100{cache_buster}"
        try:
            response = self.session.get(search_url)
            response.raise_for_status()
            results = response.json()
            
            # Check if found in current page
            if 'data' in results:
                for pc in results['data']:
                    if pc.get('machine_id') == self.machine_id:
                        return pc
            
            # If not found in first page and there are more pages, search through all pages
            if results.get('last_page', 1) > 1:
                for page in range(2, results.get('last_page', 1) + 1):
                    page_url = f"{config.API_BASE_URL}/computers?search={self.machine_id}&per_page=100&page={page}{cache_buster}"
                    page_response = self.session.get(page_url)
                    page_response.raise_for_status()
                    page_results = page_response.json()
                    
                    if 'data' in page_results:
                        for pc in page_results['data']:
                            if pc.get('machine_id') == self.machine_id:
                                return pc
        except Exception as e:
            logger.warning(f"Search method failed: {e}")
        
        return None

    def register_or_update(self):
        """Check if computer exists, then create or update."""
        data = self.collect_data()
        
        try:
            # 1. Search for existing computer by machine_id
            existing = self._find_computer_by_machine_id()
            
            if existing:
                self.computer_db_id = existing['id']
                lab_data = existing.get('lab') or {}
                self._cached_lab_wallpaper_url = lab_data.get('default_wallpaper_url')
                self._cached_lab_wallpaper_enabled = lab_data.get('default_wallpaper_enabled', True)
                logger.info(f"Computer found (ID: {self.computer_db_id}). Updating...")
                # Update
                update_url = f"{config.API_BASE_URL}/computers/{self.computer_db_id}"
                update_response = self.session.put(update_url, json=data)
                update_response.raise_for_status()
                logger.info("Update successful.")
            else:
                logger.info("Computer not found. Registering...")
                # Create
                create_url = f"{config.API_BASE_URL}/computers"
                res = self.session.post(create_url, json=data)
                
                # Handle 422 error (machine_id already exists) - try to find and update instead
                if res.status_code == 422:
                    error_data = res.json()
                    if 'errors' in error_data and 'machine_id' in error_data['errors']:
                        logger.warning("Machine ID already exists (422 error). Searching again to update...")
                        # Wait a bit for database to sync (in case of race condition)
                        time.sleep(0.5)
                        
                        # Try to find the computer using exact match endpoint (bypasses cache)
                        found_computer = self._find_computer_by_machine_id(bypass_cache=True)
                        
                        if found_computer:
                            self.computer_db_id = found_computer['id']
                            lab_data = found_computer.get('lab') or {}
                            self._cached_lab_wallpaper_url = lab_data.get('default_wallpaper_url')
                            self._cached_lab_wallpaper_enabled = lab_data.get('default_wallpaper_enabled', True)
                            logger.info(f"Found existing computer (ID: {self.computer_db_id}). Updating...")
                            update_url = f"{config.API_BASE_URL}/computers/{self.computer_db_id}"
                            update_response = self.session.put(update_url, json=data)
                            update_response.raise_for_status()
                            logger.info("Update successful after handling 422 error.")
                        else:
                            # If still not found, wait a bit more and try again
                            logger.warning("Computer not found on first attempt. Waiting and retrying...")
                            time.sleep(1)
                            found_computer = self._find_computer_by_machine_id(bypass_cache=True)
                            
                            if found_computer:
                                self.computer_db_id = found_computer['id']
                                lab_data = found_computer.get('lab') or {}
                                self._cached_lab_wallpaper_url = lab_data.get('default_wallpaper_url')
                                self._cached_lab_wallpaper_enabled = lab_data.get('default_wallpaper_enabled', True)
                                logger.info(f"Found existing computer on retry (ID: {self.computer_db_id}). Updating...")
                                update_url = f"{config.API_BASE_URL}/computers/{self.computer_db_id}"
                                update_response = self.session.put(update_url, json=data)
                                update_response.raise_for_status()
                                logger.info("Update successful after retry.")
                            else:
                                logger.error("Machine ID exists but computer not found even after retry.")
                                logger.error(f"Machine ID: {self.machine_id}")
                                logger.error("This may indicate a database inconsistency. Skipping this update cycle.")
                                # Don't raise error, just log and continue - will retry next cycle
                                return
                    else:
                        res.raise_for_status()
                else:
                    res.raise_for_status()
                    self.computer_db_id = res.json()['id']
                    logger.info(f"Registration successful (ID: {self.computer_db_id}).")
                
        except requests.HTTPError as e:
            logger.error(f"HTTP error: {e}")
            if e.response is not None:
                logger.error(f"Response status: {e.response.status_code}")
                logger.error(f"Response: {e.response.text}")
            # Identify if auth error, maybe retry login?
            if e.response and e.response.status_code == 401:
                logger.warning("Token expired/invalid. Re-authenticating next loop.")
                self.token = None
        except Exception as e:
            logger.error(f"Communication error: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")

    def get_metrics(self):
        """Collect dynamic system metrics."""
        try:
            # CPU
            cpu_percent = psutil.cpu_percent(interval=None) # Non-blocking
            
            # Memory
            memory = psutil.virtual_memory()
            
            # Disk (Iterate partitions)
            disk_usage = []
            for part in psutil.disk_partitions(all=False):
                try:
                    usage = psutil.disk_usage(part.mountpoint)
                    disk_usage.append({
                        'mount': part.mountpoint,
                        'total_gb': round(usage.total / (1024**3), 2),
                        'free_gb': round(usage.free / (1024**3), 2),
                        'percent': usage.percent
                    })
                except Exception:
                    continue
            
            # Network
            net_io = psutil.net_io_counters()
            network_stats = {
                'bytes_sent': net_io.bytes_sent,
                'bytes_recv': net_io.bytes_recv,
                'packets_sent': net_io.packets_sent,
                'packets_recv': net_io.packets_recv
            }
            
            # Uptime
            uptime_seconds = int(time.time() - psutil.boot_time())
            
            # Processes
            processes_count = len(psutil.pids())
            
            return {
                'cpu_usage_percent': cpu_percent,
                'memory_usage_percent': memory.percent,
                'memory_total_gb': round(memory.total / (1024**3), 2),
                'memory_free_gb': round(memory.available / (1024**3), 2),
                'disk_usage': disk_usage,
                'network_stats': network_stats,
                'uptime_seconds': uptime_seconds,
                'processes_count': processes_count
            }
        except Exception as e:
            logger.error(f"Error collecting metrics: {e}")
            return {}

    def send_metrics_report(self):
        """Send lightweight metrics report to backend."""
        if not self.computer_db_id:
            return
        
        try:
            metrics = self.get_metrics()
            if not metrics:
                return

            metrics_url = f"{config.API_BASE_URL}/computers/{self.computer_db_id}/metrics"
            response = self.session.post(metrics_url, json=metrics)
            response.raise_for_status()
            
            logger.debug("Metrics sent successfully.")
        except Exception as e:
            logger.error(f"Failed to send metrics: {e}")

    def send_detailed_report(self):
        """Send detailed hardware and software report to backend."""
        if not self.computer_db_id:
            logger.warning("Cannot send report: computer not registered yet.")
            return
        
        try:
            logger.info("Collecting detailed system information...")
            hardware_info = self.get_hardware_info()
            software_list = self.get_software_list()
            
            report_data = {
                'hardware_info': hardware_info,
                'softwares': software_list,
                'agent_version': self.get_current_version(),
                'hostname': socket.gethostname()
            }
            
            report_url = f"{config.API_BASE_URL}/computers/{self.computer_db_id}/report"
            response = self.session.post(report_url, json=report_data)
            response.raise_for_status()
            
            logger.info(f"Detailed report sent successfully. Hardware: {len(hardware_info)} items, Software: {len(software_list)} packages.")
        except Exception as e:
            logger.error(f"Failed to send detailed report: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")

    def check_commands(self):
        """Check for pending remote commands."""
        if not self.computer_db_id: return
        
        try:
            url = f"{config.API_BASE_URL}/computers/{self.computer_db_id}/commands/pending"
            response = self.session.get(url)
            # 404 means no route or computer not found, ignore to avoid log spam if feature not ready
            if response.status_code == 404: return
            response.raise_for_status()
            
            commands = response.json()
            for cmd in commands:
                self.execute_command(cmd)
        except Exception as e:
            logger.error(f"Error checking commands: {e}")

    def send_wol(self, mac_address):
        """Send Wake-on-LAN magic packet."""
        try:
            # Clean MAC address
            mac_address = mac_address.replace(':', '').replace('-', '')
            
            if len(mac_address) != 12:
                raise ValueError(f"Invalid MAC address length: {len(mac_address)}")
                
            data = bytes.fromhex('FF' * 6 + mac_address * 16)
            
            # Broadcast to LAN
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
                sock.sendto(data, ("255.255.255.255", 9))
                
            return True
        except Exception as e:
            logger.error(f"Error sending WoL: {e}")
            raise e

    def get_screenshot(self):
        """Capture screen, compress and return base64 string."""
        try:
            with mss.mss() as sct:
                # Capture all monitors
                monitor = sct.monitors[0] # 0 = All monitors combined
                sct_img = sct.grab(monitor)
                
                # Convert to PIL Image
                img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
                
                # Resize if too large (max 1920 width to save bandwidth)
                if img.width > 1920:
                    ratio = 1920 / img.width
                    new_height = int(img.height * ratio)
                    img = img.resize((1920, new_height), Image.Resampling.LANCZOS)
                
                # Compress to JPEG
                buffer = io.BytesIO()
                img.save(buffer, format="JPEG", quality=60)
                img_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
                
                return img_str
        except Exception as e:
            logger.error(f"Error taking screenshot: {e}")
            raise e

    def get_processes(self):
        """Get list of running processes."""
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'username', 'cpu_percent', 'memory_percent']):
            try:
                pinfo = proc.info
                # Add create_time
                pinfo['create_time'] = proc.create_time()
                processes.append(pinfo)
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        
        # Sort by CPU usage and limit to top 100 to avoid huge payload
        processes.sort(key=lambda p: p['cpu_percent'] or 0, reverse=True)
        return processes[:100]

    def receive_file(self, params):
        """Handle file reception (download or copy)."""
        try:
            filename = params.get('filename')
            source_type = params.get('source_type')
            url = params.get('url') # URL or Path
            auth_required = params.get('auth_required', False)
            # destination_folder is currently ignored in favor of hardcoded paths for safety/consistency
            
            # Determine destination path
            if platform.system() == 'Windows':
                # Public Desktop (Visible to all users)
                public_desktop = Path(os.environ.get('PUBLIC', 'C:\\Users\\Public')) / 'Desktop'
                base_dir = public_desktop / 'Recebidos do Laboratório'
            else:
                # Linux: Use /tmp/Received or User Desktop if possible
                # Trying to find a more visible location than /tmp
                home = Path.home()
                if home.name == 'root' and os.environ.get('SUDO_USER'):
                     # If running as sudo, try to get actual user home
                     home = Path('/home') / os.environ.get('SUDO_USER')
                
                # Check if we can write to home/Desktop
                desktop = home / 'Desktop'
                if desktop.exists():
                     base_dir = desktop / 'Recebidos'
                else:
                     base_dir = Path('/tmp/Received')
            
            try:
                base_dir.mkdir(parents=True, exist_ok=True)
                # Verify we can write to it
                test_file = base_dir / '.write_test'
                test_file.touch()
                test_file.unlink()
            except Exception as e:
                logger.error(f"Cannot write to destination {base_dir}: {e}")
                # Fallback to tmp
                if platform.system() == 'Windows':
                    base_dir = Path('C:\\Temp\\Received')
                else:
                    base_dir = Path('/tmp/Received')
                base_dir.mkdir(parents=True, exist_ok=True)
            
            if not filename:
                if source_type == 'upload' and url:
                    # Generic name
                    filename = 'downloaded_file.dat'
                elif url:
                    filename = Path(url).name
                else:
                    filename = f"file_{int(time.time())}.dat"
            
            # Sanitize filename
            filename = "".join(x for x in filename if (x.isalnum() or x in "._- "))
            dest_path = base_dir / filename
            
            logger.info(f"Receiving file '{filename}' from {url}")
            logger.info(f"Saving to: {dest_path}")
            
            if source_type == 'upload' or (url and url.startswith(('http:', 'https:'))):
                # HTTP Download
                headers = {}
                if auth_required and self.token:
                    headers['Authorization'] = f"Bearer {self.token}"
                
                logger.debug(f"Starting download...")
                with self.session.get(url, headers=headers, stream=True, timeout=600) as r:
                    r.raise_for_status()
                    total_size = int(r.headers.get('content-length', 0))
                    downloaded = 0
                    
                    with open(dest_path, 'wb') as f:
                        for chunk in r.iter_content(chunk_size=8192):
                            f.write(chunk)
                            downloaded += len(chunk)
                    logger.info(f"Download completed. Size: {downloaded} bytes")
            
            elif source_type in ['link', 'network_path'] and url:
                # File Copy
                src_path = Path(url)
                logger.debug(f"Copying from {src_path}")
                shutil.copy2(src_path, dest_path)
            
            # Visual Feedback - Best Effort
            msg = f"Arquivo recebido: {filename}\nLocal: {base_dir}"
            try:
                if platform.system() == 'Windows':
                    # Try msg command
                    subprocess.run(['msg', '*', msg], shell=True, capture_output=True)
                    # Try opening explorer (might fail in Session 0)
                    subprocess.Popen(['explorer', str(base_dir)])
                else:
                    # Linux feedback
                    user = os.environ.get('SUDO_USER') or os.environ.get('USER')
                    if user:
                        # Try to notify user
                        subprocess.run(['notify-send', 'Laboratório', msg], capture_output=True)
                        subprocess.Popen(['xdg-open', str(base_dir)], stderr=subprocess.DEVNULL)
            except Exception as e:
                logger.warning(f"Visual feedback failed (non-critical): {e}")

            return True, f"File successfully saved to {dest_path}"
            
        except Exception as e:
            logger.error(f"Error receiving file: {e}")
            logger.exception(e) # Print stack trace
            return False, f"Error: {str(e)}"

    def execute_command(self, cmd):
        """Execute a remote command."""
        command_id = cmd['id']
        command_type = cmd['command']
        params = cmd.get('parameters', {}) or {}
        
        logger.info(f"Executing command {command_type} (ID: {command_id})")
        
        # Mark as processing
        self.update_command_status(command_id, 'processing')
        
        output = ""
        success = False
        
        try:
            if command_type == 'shutdown':
                if platform.system() == 'Windows':
                    os.system("shutdown /s /t 5") # 5s delay
                else:
                    # Requires root or sudo NOPASSWD
                    os.system("shutdown -h +1") # 1 min delay to allow status update
                success = True
                output = "Shutdown command issued."
                
            elif command_type == 'restart':
                if platform.system() == 'Windows':
                    os.system("shutdown /r /t 5")
                else:
                    os.system("shutdown -r +1")
                success = True
                output = "Restart command issued."
            
            elif command_type == 'lock':
                if platform.system() == 'Windows':
                    # On Windows, lock the workstation
                    # Services running as SYSTEM cannot directly lock - must execute in user session
                    try:
                        # Method 1: Use schtasks to execute lock command as logged-in user
                        # This is the most reliable method for Windows services
                        ps_script = r'''
# Get logged-in user from Win32_ComputerSystem
$cs = Get-WmiObject -Class Win32_ComputerSystem
$user = $cs.UserName

if (-not $user) {
    Write-Error "No user logged in"
    exit 1
}

# Parse domain and username
if ($user -match '^(.+)\\(.+)$') {
    $domain = $matches[1]
    $username = $matches[2]
} else {
    $domain = $env:COMPUTERNAME
    $username = $user
}

# Create unique task name
$taskName = "IFLabLock_" + [System.Guid]::NewGuid().ToString("N").Substring(0,8)

# Create and run scheduled task
$createCmd = "schtasks /Create /TN `"$taskName`" /TR `"rundll32.exe user32.dll,LockWorkStation`" /SC ONCE /ST 23:59 /F /RU `"$domain\$username`" /RL HIGHEST"
$createResult = cmd /c $createCmd 2>&1

if ($LASTEXITCODE -eq 0) {
    # Run the task
    $runCmd = "schtasks /Run /TN `"$taskName`""
    $runResult = cmd /c $runCmd 2>&1
    Start-Sleep -Milliseconds 800
    
    # Clean up
    $deleteCmd = "schtasks /Delete /TN `"$taskName`" /F"
    cmd /c $deleteCmd 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        exit 0
    }
}

Write-Error "schtasks failed: $createResult $runResult"
exit 1
'''
                        
                        # Execute PowerShell script
                        try:
                            result = subprocess.run(
                                ['powershell.exe', '-ExecutionPolicy', 'Bypass', '-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps_script],
                                capture_output=True,
                                text=True,
                                timeout=25
                            )
                            
                            if result.returncode == 0:
                                success = True
                                output = "Lock command issued successfully (scheduled task method)."
                                logger.info("Lock executed via schtasks method")
                            else:
                                error_msg = result.stderr or result.stdout or "Unknown error"
                                logger.warning(f"PowerShell/schtasks method failed: {error_msg}")
                                raise Exception(f"schtasks returned {result.returncode}: {error_msg}")
                        
                        except Exception as e:
                            logger.warning(f"PowerShell/schtasks method failed: {e}")
                            success = False
                            output = f"Lock failed: {str(e)}. The service may need administrator privileges to create scheduled tasks, or no user may be logged in."
                            logger.error(f"Lock command failed: {e}")
                    
                    except Exception as e:
                        logger.error(f"Error executing lock command: {e}")
                        success = False
                        output = f"Lock failed: {str(e)}"
                
                else:
                    # Linux: Try common lock commands
                    try:
                        # Use loginctl if available (systemd)
                        result = subprocess.run(
                            ['loginctl', 'lock-session'],
                            capture_output=True,
                            text=True,
                            timeout=5
                        )
                        if result.returncode == 0:
                            success = True
                            output = "Lock command issued (loginctl)."
                        else:
                            # Try xdg-screensaver or gnome-screensaver
                            result2 = subprocess.run(
                                ['xdg-screensaver', 'lock'],
                                capture_output=True,
                                text=True,
                                timeout=5
                            )
                            if result2.returncode == 0:
                                success = True
                                output = "Lock command issued (xdg-screensaver)."
                            else:
                                result3 = subprocess.run(
                                    ['gnome-screensaver-command', '-l'],
                                    capture_output=True,
                                    text=True,
                                    timeout=5
                                )
                                if result3.returncode == 0:
                                    success = True
                                    output = "Lock command issued (gnome-screensaver)."
                                else:
                                    success = False
                                    output = "Lock failed: No lock command available."
                    except Exception as e:
                        logger.error(f"Error executing lock command on Linux: {e}")
                        success = False
                        output = f"Lock failed: {str(e)}"

            elif command_type == 'message':
                msg = (params.get('message') or params.get('text') or '').strip()
                if not msg:
                    logger.warning("Message command with empty text, using default")
                    msg = 'Alert from Admin'
                if platform.system() == 'Linux':
                    # Escape single quotes for shell: ' -> '\''
                    msg_safe = msg.replace("'", "'\"'\"'")
                    os.system(f"notify-send 'Admin Alert' '{msg_safe}'")
                elif platform.system() == 'Windows':
                    # Escape double quotes for cmd: " -> \"
                    msg_safe = msg.replace('"', '\\"')
                    os.system(f'msg * "{msg_safe}"')
                success = True
                output = f"Message displayed: {msg}"
            
            elif command_type == 'wol':
                target_mac = params.get('target_mac')
                if target_mac:
                    logger.info("WoL: sending magic packet to MAC %s", target_mac)
                    try:
                        self.send_wol(target_mac)
                        logger.info("WoL: magic packet sent successfully to %s", target_mac)
                        success = True
                        output = f"WoL packet sent to {target_mac}"
                    except Exception as e:
                        logger.error("WoL: failed to send to %s: %s", target_mac, e)
                        success = False
                        output = str(e)
                else:
                    success = False
                    output = "Missing target_mac for WoL"
            
            elif command_type == 'screenshot':
                img_data = self.get_screenshot()
                success = True
                output = img_data # Returns base64 string
                
            elif command_type == 'ps_list':
                procs = self.get_processes()
                success = True
                output = json.dumps(procs) # Returns JSON string
            
            elif command_type == 'ps_kill':
                pid = params.get('pid')
                if pid:
                    p = psutil.Process(int(pid))
                    p.terminate() # Try terminate first
                    try:
                        p.wait(timeout=3)
                    except psutil.TimeoutExpired:
                        p.kill() # Force kill if needed
                    success = True
                    output = f"Process {pid} killed."
                else:
                    success = False
                    output = "Missing PID parameter"
            
            elif command_type == 'terminal':
                cmd_text = params.get('command')
                if cmd_text:
                    # Be careful with shell=True!
                    result = subprocess.run(cmd_text, shell=True, capture_output=True, text=True, timeout=30)
                    success = True # Even if exit code != 0, the command executed
                    output = result.stdout + result.stderr
                else:
                    success = False
                    output = "Missing command text"
            
            elif command_type == 'receive_file':
                success, output = self.receive_file(params)

            # --- Update status ---
            status = 'completed' if success else 'failed'
                cmd_line = params.get('cmd_line')
                if cmd_line:
                    try:
                        # Execute command with shell=True for flexibility
                        result = subprocess.run(cmd_line, shell=True, capture_output=True, text=True, timeout=30)
                        
                        # Combine stdout and stderr
                        output = result.stdout
                        if result.stderr:
                            output += f"\n[STDERR]\n{result.stderr}"
                            
                        # If output is empty but command succeeded
                        if not output and result.returncode == 0:
                            output = "[Command executed successfully with no output]"
                            
                        success = True # Even if stderr exists, execution itself was successful in running
                    except subprocess.TimeoutExpired:
                        output = "Command timed out after 30 seconds."
                        success = False
                    except Exception as e:
                        output = str(e)
                        success = False
                else:
                    output = "Missing cmd_line parameter"
                    success = False

            elif command_type == 'install_software':
                method = params.get('method')  # 'upload', 'url', 'network'
                software_name = params.get('software_name', 'Unknown')
                install_args = params.get('install_args', '')
                silent_mode = params.get('silent_mode', True)
                reboot_after = params.get('reboot_after', False)

                try:
                    installer_path = None

                    if method == 'upload':
                        file_id = params.get('file_id')
                        if not file_id:
                            output = "Missing file_id for upload method"
                            success = False
                        else:
                            self.update_command_status(command_id, 'processing', 'Baixando instalador do servidor...')
                            installer_path = self.download_installer(file_id)
                    elif method == 'url':
                        installer_url = params.get('installer_url')
                        if not installer_url:
                            output = "Missing installer_url for url method"
                            success = False
                        else:
                            self.update_command_status(command_id, 'processing', 'Baixando instalador da URL...')
                            installer_path = self.download_from_url(installer_url)
                    elif method == 'network':
                        network_path = params.get('network_path')
                        if not network_path:
                            output = "Missing network_path for network method"
                            success = False
                        else:
                            self.update_command_status(command_id, 'processing', 'Copiando instalador da rede...')
                            installer_path = self.copy_from_network(network_path)
                    else:
                        output = f"Unknown installation method: {method}"
                        success = False

                    if installer_path:
                        self.update_command_status(command_id, 'processing', 'Executando instalador...')
                        result = self.execute_installer(installer_path, install_args, silent_mode)
                        success = result['success']
                        output = f"Software: {software_name}\n{result['output']}"

                        if reboot_after and success:
                            if platform.system() == 'Windows':
                                os.system("shutdown /r /t 30")
                                output += "\n[Reboot scheduled in 30 seconds]"
                            else:
                                output += "\n[Reboot not supported on this platform]"
                except Exception as e:
                    output = f"Installation error: {str(e)}"
                    success = False
                    logger.error(f"Installation failed: {e}")

            elif command_type == 'set_hostname':
                new_hostname = (params.get('new_hostname') or '').strip()
                hostname_regex = r'^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$'
                if not new_hostname:
                    success = False
                    output = "Parâmetro new_hostname é obrigatório e não pode ser vazio."
                elif len(new_hostname) > 63:
                    success = False
                    output = "Hostname deve ter no máximo 63 caracteres."
                elif not re.match(hostname_regex, new_hostname):
                    success = False
                    output = "Hostname inválido: use apenas letras, números, hífen e ponto."
                else:
                    try:
                        self._set_system_hostname(new_hostname)
                        success = True
                        output = f"Hostname alterado para: {new_hostname}"
                        if platform.system() == 'Windows':
                            output += ". Em alguns contextos o novo nome só é refletido após reiniciar o computador."
                        # Enviar report para o backend atualizar o hostname de imediato
                        self.send_detailed_report()
                    except Exception as e:
                        success = False
                        output = f"Falha ao alterar hostname: {str(e)}"
                        logger.error(f"set_hostname failed: {e}")

            elif command_type == 'update_agent':
                try:
                    logger.info("Executing remote update_agent command...")
                    if getattr(sys, 'frozen', False):
                        # Agent running as PyInstaller exe: update by downloading and running installer
                        success, output = self._run_frozen_update(command_id)
                        if success and output == "__EXIT_FOR_INSTALLER__":
                            self.update_command_status(command_id, 'processing', 'Baixando e executando instalador...')
                            sys.exit(0)
                        if not success:
                            self.update_command_status(command_id, 'failed', output)
                            success = False
                    else:
                        # Source/venv: run update.py
                        update_script = self.agent_dir / "update.py"
                        if not update_script.exists():
                            output = "update.py not found in agent directory"
                            success = False
                        else:
                            if platform.system() == 'Windows':
                                python_exe = self.agent_dir / ".venv" / "Scripts" / "python.exe"
                            else:
                                python_exe = self.agent_dir / ".venv" / "bin" / "python"
                            if not python_exe.exists():
                                python_exe = "python3" if platform.system() != 'Windows' else "python"
                            env = os.environ.copy()
                            env['AUTO_UPDATE'] = '1'
                            result = subprocess.run(
                                [str(python_exe), str(update_script)],
                                cwd=str(self.agent_dir),
                                capture_output=True,
                                text=True,
                                timeout=300,
                                env=env
                            )
                            output_lines = []
                            if result.stdout:
                                output_lines.append("STDOUT:")
                                output_lines.append(result.stdout)
                            if result.stderr:
                                output_lines.append("STDERR:")
                                output_lines.append(result.stderr)
                            output = "\n".join(output_lines) if output_lines else f"Update completed with exit code: {result.returncode}"
                            success = result.returncode == 0
                            if success:
                                logger.info("Agent update completed successfully")
                            else:
                                logger.warning(f"Agent update failed with exit code: {result.returncode}")
                except subprocess.TimeoutExpired:
                    output = "Update command timed out after 5 minutes"
                    success = False
                    logger.error("Update command timed out")
                except Exception as e:
                    output = f"Error executing update: {str(e)}"
                    success = False
                    logger.error(f"Update command failed: {e}")

            else:
                output = f"Unknown command: {command_type}"
                success = False

        except Exception as e:
            output = str(e)
            success = False
            
        if command_type == 'wol':
            logger.info("WoL: updating command %s status to %s", command_id, 'completed' if success else 'failed')
        self.update_command_status(command_id, 'completed' if success else 'failed', output)

    def update_command_status(self, command_id, status, output=None):
        try:
            url = f"{config.API_BASE_URL}/commands/{command_id}/status"
            payload = {'status': status}
            if output: payload['output'] = output
            resp = self.session.put(url, json=payload)
            resp.raise_for_status()
        except Exception as e:
            logger.error("Failed to update command status: %s", e)

    def _set_system_hostname(self, new_hostname):
        """Alterar hostname no SO (Windows ou Linux). Requer privilégios de administrador/root."""
        if platform.system() == 'Windows':
            ps_script = f'Rename-Computer -NewName "{new_hostname}" -Force'
            result = subprocess.run(
                ['powershell.exe', '-ExecutionPolicy', 'Bypass', '-NoProfile', '-Command', ps_script],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode != 0:
                err = result.stderr or result.stdout or "Erro desconhecido"
                raise RuntimeError(err)
        else:
            # Linux: hostnamectl (preferido) ou /etc/hostname
            try:
                result = subprocess.run(
                    ['hostnamectl', 'set-hostname', new_hostname],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                if result.returncode != 0:
                    err = result.stderr or result.stdout or "Erro ao executar hostnamectl"
                    raise RuntimeError(err)
            except FileNotFoundError:
                # Fallback: escrever em /etc/hostname (requer root)
                hostname_path = Path('/etc/hostname')
                hostname_path.write_text(new_hostname + '\n', encoding='utf-8')
                # Atualizar /etc/hosts para a linha 127.0.1.1
                hosts_path = Path('/etc/hosts')
                if hosts_path.exists():
                    content = hosts_path.read_text(encoding='utf-8')
                    lines = content.splitlines()
                    new_lines = []
                    for line in lines:
                        if line.strip().startswith('127.0.1.1'):
                            new_lines.append(f'127.0.1.1\t{new_hostname}')
                        else:
                            new_lines.append(line)
                    hosts_path.write_text('\n'.join(new_lines) + '\n', encoding='utf-8')

    def _run_frozen_update(self, command_id):
        """Update agent when running as PyInstaller exe: check API, download installer, run it, exit."""
        try:
            if not self.token and not self.login():
                return False, "Agente não autenticado; configure AGENT_EMAIL e AGENT_PASSWORD no .env"
            base = config.API_BASE_URL.rstrip('/')
            url = f"{base}/agent/check-update"
            params = {
                'current_version': self.get_current_version(),
                'platform': 'windows-frozen',
            }
            resp = self.session.get(url, params=params, timeout=10)
            if resp.status_code != 200:
                return False, f"Check-update falhou: HTTP {resp.status_code}"
            data = resp.json()
            if not data.get('available') or not data.get('download_url'):
                return True, "Agente já está atualizado."
            download_url = data.get('download_url')
            logger.info("Downloading installer from %s", download_url)
            temp_dir = Path(tempfile.gettempdir())
            temp_dir.mkdir(parents=True, exist_ok=True)
            exe_name = f"iflab-agent-setup-{uuid.uuid4().hex[:8]}.exe"
            exe_path = temp_dir / exe_name
            r = self.session.get(download_url, stream=True, timeout=300)
            r.raise_for_status()
            with open(exe_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            logger.info("Running installer: %s", exe_path)
            subprocess.Popen(
                [str(exe_path), '/VERYSILENT', '/CLOSEAPPLICATIONS', '/RESTARTAPPLICATIONS'],
                cwd=str(self.agent_dir),
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if platform.system() == 'Windows' else 0,
            )
            return True, "__EXIT_FOR_INSTALLER__"
        except Exception as e:
            logger.exception("Frozen update failed")
            return False, str(e)

    def _download_wallpaper(self, url):
        """Baixa imagem da URL para um arquivo local. Retorna path absoluto ou None em erro."""
        try:
            cache_dir = Path(tempfile.gettempdir()) / "iflab_agent_wallpaper"
            cache_dir.mkdir(parents=True, exist_ok=True)
            ext = "jpg"
            if "." in url.split("?")[0]:
                ext = url.split("?")[0].rsplit(".", 1)[-1].lower()
                if ext not in ("jpg", "jpeg", "png", "gif", "webp"):
                    ext = "jpg"
            file_path = cache_dir / f"lab_wallpaper.{ext}"
            r = self.session.get(url, stream=True, timeout=30)
            r.raise_for_status()
            with open(file_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            return str(file_path.resolve())
        except Exception as e:
            logger.warning("Failed to download lab wallpaper from %s: %s", url, e)
            return None

    def _get_current_wallpaper_path(self):
        """Retorna o caminho/URI do wallpaper atual do SO, ou None."""
        try:
            if platform.system() == "Windows":
                ps_script = "Get-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name Wallpaper -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Wallpaper"
                result = subprocess.run(
                    ["powershell.exe", "-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", ps_script],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                if result.returncode == 0 and result.stdout and result.stdout.strip():
                    return result.stdout.strip()
                return None
            else:
                result = subprocess.run(
                    ["gsettings", "get", "org.gnome.desktop.background", "picture-uri"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                if result.returncode == 0 and result.stdout and result.stdout.strip():
                    uri = result.stdout.strip().strip("'\"")
                    if uri.startswith("file://"):
                        return uri[7:]
                    return uri
                return None
        except Exception as e:
            logger.debug("Could not get current wallpaper path: %s", e)
            return None

    def _is_windows_service(self):
        """Return True if the current process is running as a Windows service (Session 0)."""
        if platform.system() != "Windows":
            return False
        try:
            ps_script = "(Get-Process -Id $PID).SessionId -eq 0"
            result = subprocess.run(
                ["powershell.exe", "-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", ps_script],
                capture_output=True,
                text=True,
                timeout=5,
            )
            return result.returncode == 0 and result.stdout.strip().lower() == "true"
        except Exception:
            return False

    def _wallpaper_programdata_dir(self):
        """Return ProgramData\\IFLabAgent path for wallpaper files (readable by all users)."""
        pd = os.environ.get("ProgramData", "C:\\ProgramData")
        return Path(pd) / "IFLabAgent"

    def _copy_wallpaper_to_programdata(self, source_path):
        """Copy wallpaper file to ProgramData\\IFLabAgent\\wallpaper.<ext>. Return new path or None."""
        try:
            dest_dir = self._wallpaper_programdata_dir()
            dest_dir.mkdir(parents=True, exist_ok=True)
            ext = Path(source_path).suffix or ".jpg"
            dest_path = dest_dir / f"wallpaper{ext}"
            import shutil
            shutil.copy2(source_path, dest_path)
            self._grant_users_read(str(dest_path))
            return str(dest_path.resolve())
        except Exception as e:
            logger.warning("Failed to copy wallpaper to ProgramData: %s", e)
            return None

    def _grant_users_read(self, file_path):
        """Grant Users group read access so any logged-in user can read the file (e.g. when running set_wallpaper.ps1)."""
        if platform.system() != "Windows":
            return
        try:
            subprocess.run(
                ["icacls", file_path, "/grant", "Users:R", "/q"],
                capture_output=True,
                timeout=5,
            )
        except Exception:
            pass

    def _write_pending_wallpaper(self, abs_path):
        """Write the wallpaper path to pending_wallpaper.txt for the user-session script."""
        try:
            dest_dir = self._wallpaper_programdata_dir()
            dest_dir.mkdir(parents=True, exist_ok=True)
            pending_file = dest_dir / "pending_wallpaper.txt"
            pending_file.write_text(abs_path, encoding="utf-8")
            self._grant_users_read(str(pending_file))
            return True
        except Exception as e:
            logger.warning("Failed to write pending wallpaper path: %s", e)
            return False

    def _ensure_wallpaper_script(self):
        """Ensure ProgramData\\IFLabAgent\\set_wallpaper.ps1 exists (reads pending path and applies via SystemParametersInfo)."""
        script_content = r'''# Read path from pending_wallpaper.txt and set wallpaper via SystemParametersInfo
$pendingFile = "$env:ProgramData\IFLabAgent\pending_wallpaper.txt"
if (-not (Test-Path $pendingFile)) { exit 0 }
$path = (Get-Content $pendingFile -Raw).Trim()
if (-not $path -or -not (Test-Path $path)) { exit 0 }
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Params {
    [DllImport("User32.dll", CharSet=CharSet.Unicode)]
    public static extern int SystemParametersInfo(Int32 uAction, Int32 uParam, String lpvParam, Int32 fuWinIni);
}
"@
$SPI_SETDESKWALLPAPER = 0x0014
$SPIF_UPDATEINIFILE = 0x01
$SPIF_SENDCHANGE = 0x02
$fWinIni = $SPIF_UPDATEINIFILE -bor $SPIF_SENDCHANGE
[Params]::SystemParametersInfo($SPI_SETDESKWALLPAPER, 0, $path, $fWinIni) | Out-Null
'''
        try:
            dest_dir = self._wallpaper_programdata_dir()
            dest_dir.mkdir(parents=True, exist_ok=True)
            script_path = dest_dir / "set_wallpaper.ps1"
            script_path.write_text(script_content, encoding="utf-8")
            return str(script_path)
        except Exception as e:
            logger.warning("Failed to write set_wallpaper.ps1: %s", e)
            return None

    def _run_wallpaper_task(self):
        """Run the scheduled task that applies pending wallpaper in the logged-in user session."""
        try:
            result = subprocess.run(
                ["schtasks.exe", "/run", "/tn", "IFLabAgentSetWallpaper"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode != 0:
                logger.debug("schtasks /run failed (task may not exist yet): %s", result.stderr or result.stdout)
        except Exception as e:
            logger.debug("Failed to run wallpaper task: %s", e)

    def _ensure_startup_shortcut(self):
        """Ensure All Users Startup shortcut exists so wallpaper applies at every user logon (for existing installs)."""
        if platform.system() != "Windows":
            return
        try:
            dest_dir = self._wallpaper_programdata_dir()
            script_path = dest_dir / "set_wallpaper.ps1"
            if not script_path.exists():
                return
            startup = os.environ.get("ProgramData", "C:\\ProgramData") + "\\Microsoft\\Windows\\Start Menu\\Programs\\StartUp"
            shortcut_path = os.path.join(startup, "IFLabAgent-ApplyWallpaper.lnk")
            if os.path.exists(shortcut_path):
                return
            # Write a small helper script to create the shortcut (avoids escaping issues)
            helper = dest_dir / "create_startup_shortcut.ps1"
            helper.write_text(
                f'$wsh = New-Object -ComObject WScript.Shell\n'
                f'$s = $wsh.CreateShortcut("{shortcut_path}")\n'
                f'$s.TargetPath = "powershell.exe"\n'
                f'$s.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -NoProfile -File \\"{script_path}\\""\n'
                f'$s.WorkingDirectory = "{dest_dir}"\n'
                f'$s.Save()\n'
                f'[Runtime.InteropServices.Marshal]::ReleaseComObject($wsh) | Out-Null\n',
                encoding="utf-8",
            )
            subprocess.run(
                ["powershell.exe", "-ExecutionPolicy", "Bypass", "-NoProfile", "-File", str(helper)],
                capture_output=True,
                timeout=10,
            )
        except Exception as e:
            logger.debug("Could not ensure Startup shortcut: %s", e)

    def _set_wallpaper(self, file_path):
        """Aplica o arquivo como papel de parede. file_path deve ser caminho absoluto."""
        try:
            abs_path = str(Path(file_path).resolve())
            if not os.path.exists(abs_path):
                logger.warning("Wallpaper file does not exist, skipping: %s", abs_path)
                return
            if platform.system() == "Windows":
                if self._is_windows_service():
                    # Running as service (Session 0): copy to ProgramData, write pending path, run task + rely on Startup at logon
                    logger.info("Wallpaper: running as service (Session 0), using ProgramData and scheduled task")
                    dest_path = self._copy_wallpaper_to_programdata(abs_path)
                    if not dest_path:
                        logger.warning("Could not copy wallpaper to ProgramData, skipping")
                        return
                    logger.info("Wallpaper: copied to %s", dest_path)
                    if not self._write_pending_wallpaper(dest_path):
                        logger.warning("Could not write pending_wallpaper.txt")
                        return
                    self._ensure_wallpaper_script()
                    self._ensure_startup_shortcut()
                    self._run_wallpaper_task()
                    logger.info("Wallpaper: pending file set and task triggered; will also apply at next user logon via Startup")
                    return
                # Running in user context: apply immediately via SystemParametersInfo
                path_escaped = abs_path.replace("'", "''")
                ps_script = f'''
$path = '{path_escaped}'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Params {{
    [DllImport("User32.dll", CharSet=CharSet.Unicode)]
    public static extern int SystemParametersInfo(Int32 uAction, Int32 uParam, String lpvParam, Int32 fuWinIni);
}}
"@
$SPI_SETDESKWALLPAPER = 0x0014
$SPIF_UPDATEINIFILE = 0x01
$SPIF_SENDCHANGE = 0x02
$fWinIni = $SPIF_UPDATEINIFILE -bor $SPIF_SENDCHANGE
$ret = [Params]::SystemParametersInfo($SPI_SETDESKWALLPAPER, 0, $path, $fWinIni)
if ($ret -eq 0) {{ throw "SystemParametersInfo failed" }}
'''
                result = subprocess.run(
                    ["powershell.exe", "-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", ps_script],
                    capture_output=True,
                    text=True,
                    timeout=15,
                )
                if result.returncode != 0:
                    raise RuntimeError(result.stderr or result.stdout or "Unknown error")
            else:
                uri = "file://" + abs_path
                result = subprocess.run(
                    ["gsettings", "set", "org.gnome.desktop.background", "picture-uri", uri],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                if result.returncode != 0:
                    raise RuntimeError(result.stderr or result.stdout or "Unknown error")
        except Exception as e:
            logger.warning("Failed to set wallpaper: %s", e)
            raise

    def _enforce_lab_wallpaper(self):
        """Verifica o wallpaper padrão do lab no servidor e, se o atual for diferente, aplica o padrão."""
        if not getattr(self, '_cached_lab_wallpaper_enabled', True):
            return
        url = (self._cached_lab_wallpaper_url or "").strip()
        if not url:
            return
        if url.startswith("/"):
            base = config.API_BASE_URL.rstrip("/").replace("/api/v1", "").rstrip("/")
            url = base + url
        try:
            current_path = self._get_current_wallpaper_path()
            local_path = self._download_wallpaper(url)
            if not local_path:
                return
            normalized_current = (current_path or "").replace("\\", "/").rstrip("/")
            normalized_local = local_path.replace("\\", "/").rstrip("/")
            if normalized_current and normalized_current == normalized_local:
                return
            self._set_wallpaper(local_path)
            logger.info("Lab default wallpaper applied: %s", local_path)
        except Exception as e:
            logger.debug("Lab wallpaper enforcement skipped or failed: %s", e)

    def download_installer(self, file_id):
        """Download installer from server. Ensures auth and retries on 401."""
        import re
        file_id = (file_id or '').strip()
        if not file_id:
            raise ValueError("file_id is required for installer download")

        # Ensure we are authenticated before download
        if not self.token and not self.login():
            raise RuntimeError("Agent not authenticated; cannot download installer")

        temp_dir = os.path.join(os.path.dirname(__file__), 'temp')
        os.makedirs(temp_dir, exist_ok=True)
        url = f"{config.API_BASE_URL}/installers/{file_id}/download"
        logger.info("Downloading installer from %s", url)

        response = None
        for attempt in range(2):
            response = self.session.get(url, stream=True, timeout=300)
            if response.status_code == 200:
                break
            if response.status_code == 401 and attempt == 0:
                logger.warning("Download returned 401; re-authenticating and retrying")
                if self.login():
                    continue
            logger.error(
                "Failed to download installer: %s %s body=%s",
                response.status_code,
                url,
                (response.text or "")[:200],
            )
            response.raise_for_status()

        filename = file_id
        if 'Content-Disposition' in response.headers:
            match = re.search(r'filename="?([^"]+)"?', response.headers['Content-Disposition'])
            if match:
                filename = match.group(1).strip()

        file_path = os.path.join(temp_dir, filename)
        with open(file_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        logger.info("Downloaded installer: %s", file_path)
        return file_path

    def download_from_url(self, url):
        """Download installer from external URL."""
        try:
            # Create temp directory if it doesn't exist
            temp_dir = os.path.join(os.path.dirname(__file__), 'temp')
            os.makedirs(temp_dir, exist_ok=True)
            
            # Validate URL
            if not url.startswith(('http://', 'https://')):
                raise ValueError(f"Invalid URL scheme: {url}")
            
            # Get filename from URL
            filename = os.path.basename(url.split('?')[0])
            if not filename or '.' not in filename:
                filename = f"installer_{uuid.uuid4().hex[:8]}.exe"
            
            # Validate extension
            ext = os.path.splitext(filename)[1].lower()
            if ext not in ['.exe', '.msi', '.zip']:
                raise ValueError(f"Unsupported file extension: {ext}")
            
            file_path = os.path.join(temp_dir, filename)
            
            # Download file
            response = requests.get(url, stream=True, timeout=300)  # 5 min timeout
            response.raise_for_status()
            
            with open(file_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            logger.info(f"Downloaded installer from URL: {file_path}")
            return file_path
        except Exception as e:
            logger.error(f"Failed to download from URL: {e}")
            raise

    def copy_from_network(self, network_path):
        """Copy installer from network share."""
        try:
            if platform.system() != 'Windows':
                raise ValueError("Network share copy only supported on Windows")
            
            # Create temp directory if it doesn't exist
            temp_dir = os.path.join(os.path.dirname(__file__), 'temp')
            os.makedirs(temp_dir, exist_ok=True)
            
            # Validate network path format
            if not network_path.startswith('\\\\'):
                raise ValueError(f"Invalid network path format: {network_path}")
            
            filename = os.path.basename(network_path)
            file_path = os.path.join(temp_dir, filename)
            
            # Use robocopy for better reliability, fallback to copy
            try:
                # Try robocopy first (more reliable)
                result = subprocess.run(
                    ['robocopy', os.path.dirname(network_path), temp_dir, filename, '/NFL', '/NDL', '/NJH', '/NJS'],
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                # robocopy returns 0-7 for success, 8+ for errors
                if result.returncode >= 8:
                    raise subprocess.CalledProcessError(result.returncode, 'robocopy', result.stderr)
            except (subprocess.CalledProcessError, FileNotFoundError):
                # Fallback to copy command
                result = subprocess.run(
                    ['copy', f'"{network_path}"', f'"{file_path}"'],
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                if result.returncode != 0:
                    raise subprocess.CalledProcessError(result.returncode, 'copy', result.stderr)
            
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"File not copied: {file_path}")
            
            logger.info(f"Copied installer from network: {file_path}")
            return file_path
        except Exception as e:
            logger.error(f"Failed to copy from network: {e}")
            raise

    def execute_installer(self, installer_path, install_args, silent_mode):
        """Execute installer with appropriate arguments."""
        try:
            if not os.path.exists(installer_path):
                return {'success': False, 'output': f"Installer not found: {installer_path}"}
            
            ext = os.path.splitext(installer_path)[1].lower()
            output_lines = []
            
            if ext == '.msi':
                # MSI installer
                args = ['msiexec', '/i', installer_path]
                if silent_mode:
                    args.append('/qn')  # Quiet, no UI
                else:
                    args.append('/qb')  # Basic UI
                
                if install_args:
                    args.extend(install_args.split())
                
                result = subprocess.run(
                    args,
                    capture_output=True,
                    text=True,
                    timeout=600,  # 10 min timeout for installation
                    cwd=os.path.dirname(installer_path)
                )
                
                output_lines.append(f"MSI Installer executed with return code: {result.returncode}")
                if result.stdout:
                    output_lines.append(f"STDOUT: {result.stdout}")
                if result.stderr:
                    output_lines.append(f"STDERR: {result.stderr}")
                
                # MSI return codes: 0 = success, others = failure
                success = result.returncode == 0
                
            elif ext == '.exe':
                # EXE installer
                args = [installer_path]
                
                if install_args:
                    args.extend(install_args.split())
                elif silent_mode:
                    # Try common silent flags
                    args.extend(['/S', '/quiet', '/silent', '/VERYSILENT'])
                
                result = subprocess.run(
                    args,
                    capture_output=True,
                    text=True,
                    timeout=600,  # 10 min timeout
                    cwd=os.path.dirname(installer_path)
                )
                
                output_lines.append(f"EXE Installer executed with return code: {result.returncode}")
                if result.stdout:
                    output_lines.append(f"STDOUT: {result.stdout}")
                if result.stderr:
                    output_lines.append(f"STDERR: {result.stderr}")
                
                # EXE return codes: 0 = success typically
                success = result.returncode == 0
                
            elif ext == '.zip':
                # ZIP file - extract and look for installer
                import zipfile
                extract_dir = os.path.join(os.path.dirname(installer_path), 'extracted')
                os.makedirs(extract_dir, exist_ok=True)
                
                with zipfile.ZipFile(installer_path, 'r') as zip_ref:
                    zip_ref.extractall(extract_dir)
                
                # Look for .exe or .msi in extracted files
                installer_found = None
                for root, dirs, files in os.walk(extract_dir):
                    for file in files:
                        if file.endswith(('.exe', '.msi')):
                            installer_found = os.path.join(root, file)
                            break
                    if installer_found:
                        break
                
                if installer_found:
                    # Recursively call execute_installer
                    return self.execute_installer(installer_found, install_args, silent_mode)
                else:
                    return {'success': False, 'output': 'No installer found in ZIP file'}
            else:
                return {'success': False, 'output': f"Unsupported installer type: {ext}"}
            
            # Cleanup temp file after successful installation
            if success:
                try:
                    os.remove(installer_path)
                    logger.info(f"Cleaned up installer: {installer_path}")
                except Exception as e:
                    logger.warning(f"Failed to cleanup installer: {e}")
            
            return {
                'success': success,
                'output': '\n'.join(output_lines)
            }
        except subprocess.TimeoutExpired:
            return {'success': False, 'output': 'Installation timed out after 10 minutes'}
        except Exception as e:
            logger.error(f"Failed to execute installer: {e}")
            return {'success': False, 'output': f"Installation error: {str(e)}"}

    def run(self):
        logger.info(f"Starting Agent for Machine ID: {self.machine_id}")
        
        # Initialize CPU counter
        psutil.cpu_percent(interval=None)
        
        last_metrics_time = 0
        last_report_time = 0
        last_wallpaper_check_time = 0

        while True:
            if not self.token:
                if not self.login():
                    time.sleep(10)  # Wait before retry
                    continue

            # Always ensure registered
            self.register_or_update()

            # Check for commands frequently (every loop)
            if self.computer_db_id:
                self.check_commands()

            current_time = time.time()

            # Send metrics every 30s
            if current_time - last_metrics_time >= 30:
                if self.computer_db_id:
                    self.send_metrics_report()
                last_metrics_time = current_time

            # Send detailed report every 5 minutes (300s)
            if current_time - last_report_time >= 300:
                if self.computer_db_id:
                    self.send_detailed_report()
                last_report_time = current_time

            # Enforce lab default wallpaper every 5 minutes (300s)
            if current_time - last_wallpaper_check_time >= 300:
                if self.computer_db_id:
                    self._enforce_lab_wallpaper()
                last_wallpaper_check_time = current_time

            # Short sleep for responsive command handling
            time.sleep(5)

if __name__ == "__main__":
    agent = Agent()
    agent.run()
