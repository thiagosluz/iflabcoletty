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
                import subprocess
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

    def run(self):
        logger.info(f"Starting Agent for Machine ID: {self.machine_id}")
        
        iteration = 0
        while True:
            if not self.token:
                if not self.login():
                    time.sleep(10) # Wait before retry
                    continue
            
            self.register_or_update()
            
            # Send detailed report every 10 iterations (5 minutes with 30s interval)
            if iteration % 10 == 0 and self.computer_db_id:
                self.send_detailed_report()
            
            iteration += 1
            time.sleep(config.POLL_INTERVAL)

if __name__ == "__main__":
    agent = Agent()
    agent.run()
