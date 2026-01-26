import time
import json
import os
import uuid
import platform
import logging
import requests
import socket
import psutil
import config
import mss
import mss.tools
from PIL import Image
import io
import base64
import subprocess

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
        self.computer_db_id = None # ID in the database

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
        """Collect installed software (basic implementation)."""
        softwares = []
        try:
            # For Linux, try dpkg
            if platform.system() == 'Linux':
                # Use subprocess run directly instead of import inside function
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
                    # Limit to first 100 to avoid overwhelming the server
                    softwares = softwares[:100]
        except Exception as e:
            logger.warning(f"Could not collect software list: {e}")
        
        return softwares

    def collect_data(self):
        """Collect system information."""
        return {
            'lab_id': config.LAB_ID,
            'machine_id': self.machine_id,
            'hostname': socket.gethostname(),
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
                'softwares': software_list
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
                    os.system("rundll32.exe user32.dll,LockWorkStation")
                    success = True
                    output = "Lock command issued."
                else:
                    # Try common linux lock commands
                    # Use loginctl if available (systemd)
                    if os.system("loginctl lock-session") != 0:
                        os.system("xdg-screensaver lock || gnome-screensaver-command -l")
                    success = True
                    output = "Lock command issued (Linux best effort)."

            elif command_type == 'message':
                msg = params.get('message', 'Alert from Admin')
                if platform.system() == 'Linux':
                    # Try notify-send (requires libnotify-bin)
                     os.system(f"notify-send 'Admin Alert' '{msg}'")
                elif platform.system() == 'Windows':
                     os.system(f"msg * \"{msg}\"")
                success = True
                output = f"Message displayed: {msg}"
            
            elif command_type == 'wol':
                target_mac = params.get('target_mac')
                if target_mac:
                    self.send_wol(target_mac)
                    success = True
                    output = f"WoL packet sent to {target_mac}"
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

            else:
                output = f"Unknown command: {command_type}"
                success = False

        except Exception as e:
            output = str(e)
            success = False
            
        self.update_command_status(command_id, 'completed' if success else 'failed', output)

    def update_command_status(self, command_id, status, output=None):
        try:
            url = f"{config.API_BASE_URL}/commands/{command_id}/status"
            payload = {'status': status}
            if output: payload['output'] = output
            self.session.put(url, json=payload)
        except Exception as e:
            logger.error(f"Failed to update command status: {e}")

    def run(self):
        logger.info(f"Starting Agent for Machine ID: {self.machine_id}")
        
        # Initialize CPU counter
        psutil.cpu_percent(interval=None)
        
        last_metrics_time = 0
        last_report_time = 0
        
        while True:
            if not self.token:
                if not self.login():
                    time.sleep(10) # Wait before retry
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
            
            # Short sleep for responsive command handling
            time.sleep(5)

if __name__ == "__main__":
    agent = Agent()
    agent.run()
