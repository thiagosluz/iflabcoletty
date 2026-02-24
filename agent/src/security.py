import os
import sys
import platform
import subprocess
import hashlib
import json
from pathlib import Path
from base64 import urlsafe_b64encode
from cryptography.fernet import Fernet, InvalidToken

def get_hardware_fingerprint():
    """
    Gera uma string imutável baseada nas características únicas do hardware.
    Usada como entropia para derivar a chave de criptografia local.
    """
    fingerprint_parts = []
    
    # 1. OS Info
    fingerprint_parts.append(platform.system())
    fingerprint_parts.append(platform.machine())
    
    # 2. MAC Address (First active active interface is better, but we will use node for simplicity)
    # uuid.getnode() normally returns the MAC address of the current machine
    import uuid
    mac_node = uuid.getnode()
    fingerprint_parts.append(str(mac_node))
    
    # 3. Motherboard/BIOS UUID (Se disponível)
    os_name = platform.system().lower()
    try:
        if os_name == 'windows':
            output = subprocess.check_output('wmic csproduct get uuid', shell=True).decode()
            uuid_str = output.replace('UUID', '').strip()
            if uuid_str:
                fingerprint_parts.append(uuid_str)
        elif os_name == 'linux':
            # Tenta ler dmi id (requer root no linux normalmente)
            if os.path.exists('/sys/class/dmi/id/product_uuid'):
                with open('/sys/class/dmi/id/product_uuid', 'r') as f:
                    fingerprint_parts.append(f.read().strip())
            else:
                # Fallback to machine-id
                if os.path.exists('/etc/machine-id'):
                    with open('/etc/machine-id', 'r') as f:
                        fingerprint_parts.append(f.read().strip())
    except Exception:
        pass # Ignora falhas na captura avançada, o MAC node servirá como base
        
    # Combina tudo em uma string hash para normalizar
    raw_fingerprint = "-".join(fingerprint_parts)
    # Sha256 to create a fixed length bytes sequence
    return hashlib.sha256(raw_fingerprint.encode('utf-8')).digest()

def _get_encryption_key():
    """
    Deriva a chave Fernet a partir da fingerprint do hardware.
    A chave Fernet requer 32 url-safe base64-encoded bytes.
    """
    hardware_hash = get_hardware_fingerprint()
    return urlsafe_b64encode(hardware_hash)

def get_identity_file_path():
    """
    Retorna o caminho absoluto do arquivo .agent_identity
    """
    if getattr(sys, 'frozen', False):
        base_dir = Path(sys.executable).resolve().parent
    else:
        # Volta dois diretórios (agent/src/security.py -> agent/)
        base_dir = Path(__file__).resolve().parent.parent
        
    return base_dir / '.agent_identity'

def save_api_key(api_key, computer_id=None):
    """
    Criptografa e salva a API_KEY vinculada a essa máquina no disco.
    """
    key = _get_encryption_key()
    f = Fernet(key)
    
    data = {
        'api_key': api_key,
        'computer_id': computer_id
    }
    
    encrypted_data = f.encrypt(json.dumps(data).encode('utf-8'))
    
    identity_path = get_identity_file_path()
    with open(identity_path, 'wb') as file:
        file.write(encrypted_data)
        
    # Tenta restringir a permissão do arquivo (Linux/Mac)
    if platform.system().lower() != 'windows':
        os.chmod(identity_path, 0o600)

def load_api_key():
    """
    Lê localmente e tenta descriptografar a API Key e computer_id.
    Retorna uma tupla (api_key, computer_id) ou (None, None) se falhar.
    """
    identity_path = get_identity_file_path()
    
    if not identity_path.exists():
        return None, None
        
    try:
        with open(identity_path, 'rb') as file:
            encrypted_data = file.read()
            
        key = _get_encryption_key()
        f = Fernet(key)
        
        decrypted_data = f.decrypt(encrypted_data).decode('utf-8')
        data = json.loads(decrypted_data)
        
        return data.get('api_key'), data.get('computer_id')
    except InvalidToken:
        print("Erro Crítico: Identidade do Agente corrompida ou hardware alterado. O token de descriptografia não confere.")
        return None, None
    except Exception as e:
        print(f"Erro ao ler a identidade do agente: {e}")
        return None, None

def clear_legacy_credentials(env_path):
    """
    Remove o AGENT_EMAIL e AGENT_PASSWORD do arquivo .env
    """
    path = Path(env_path)
    if not path.exists():
        return
        
    with open(path, 'r') as file:
        lines = file.readlines()
        
    with open(path, 'w') as file:
        for line in lines:
            if not line.startswith('AGENT_EMAIL=') and not line.startswith('AGENT_PASSWORD='):
                file.write(line)
