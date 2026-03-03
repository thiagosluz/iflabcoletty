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
    A prioridade é o UUID da BIOS/Placa-mãe para garantir estabilidade mesmo se
    a interface de rede cair ou for alterada.
    """
    fingerprint_parts = []
    
    # 1. OS Info
    fingerprint_parts.append(platform.system())
    fingerprint_parts.append(platform.machine())
    
    # 2. Hardware ID Estável (Motherboard/BIOS UUID preferencialmente)
    hardware_id_found = False
    os_name = platform.system().lower()
    
    try:
        if os_name == 'windows':
            output = subprocess.check_output('wmic csproduct get uuid', shell=True, stderr=subprocess.DEVNULL).decode()
            uuid_str = output.replace('UUID', '').strip()
            # Garante que não é um UUID vazio ou genérico
            if uuid_str and uuid_str.lower() != 'ffffffff-ffff-ffff-ffff-ffffffffffff':
                fingerprint_parts.append(uuid_str)
                hardware_id_found = True
        elif os_name == 'linux':
            # Tenta ler dmi id (requer root no linux normalmente)
            if os.path.exists('/sys/class/dmi/id/product_uuid'):
                with open('/sys/class/dmi/id/product_uuid', 'r') as f:
                    uuid_str = f.read().strip()
                    if uuid_str:
                        fingerprint_parts.append(uuid_str)
                        hardware_id_found = True
            
            # Fallback para machine-id se o product_uuid falhar
            if not hardware_id_found and os.path.exists('/etc/machine-id'):
                with open('/etc/machine-id', 'r') as f:
                    machine_id = f.read().strip()
                    if machine_id:
                        fingerprint_parts.append(machine_id)
                        hardware_id_found = True
    except Exception:
        pass # Ignora falhas na captura avançada
        
    # 3. Fallback apenas se as opções mais estáveis falharem (MAC node)
    if not hardware_id_found:
        import uuid
        mac_node = uuid.getnode()
        fingerprint_parts.append(str(mac_node))
        
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
    try:
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
            
        return True
    except Exception as e:
        print(f"Erro ao salvar api key localmente: {e}")
        return False

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
