import socket
import platform
import psutil
from typing import Dict, Any

from src.utils.logger import setup_logger

logger = setup_logger(__name__)

def get_hardware_info() -> Dict[str, Any]:
    """Collects hardware information including CPU, Memory, Disk, and Network."""
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
