#!/usr/bin/env python3
"""
IFG Lab Manager - Agent Auto-Update Script
This script checks for updates and downloads/installs them automatically.
"""

import os
import sys
import json
import shutil
import requests
import logging
import platform
import subprocess
from pathlib import Path
from urllib.parse import urljoin

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
AGENT_DIR = Path(__file__).parent.absolute()
BACKUP_DIR = AGENT_DIR / "backups"
VERSION_FILE = AGENT_DIR / ".agent_version"
CONFIG_FILE = AGENT_DIR / "config.py"

# Try to get API URL from config
try:
    import config
    API_BASE_URL = os.getenv('API_BASE_URL', getattr(config, 'API_BASE_URL', 'http://localhost:8000/api/v1'))
except ImportError:
    API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000/api/v1')


def get_current_version():
    """Get the current agent version."""
    if VERSION_FILE.exists():
        try:
            with open(VERSION_FILE, 'r') as f:
                return f.read().strip()
        except Exception as e:
            logger.warning(f"Error reading version file: {e}")
    return "0.0.0"


def save_version(version):
    """Save the current version."""
    try:
        with open(VERSION_FILE, 'w') as f:
            f.write(version)
    except Exception as e:
        logger.error(f"Error saving version: {e}")


def check_for_updates(api_base_url, token=None):
    """Check for available updates from the server."""
    try:
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        # Endpoint to check for updates
        url = urljoin(api_base_url.rstrip('/') + '/', 'agent/check-update')
        
        current_version = get_current_version()
        response = requests.get(
            url,
            headers=headers,
            params={'current_version': current_version},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            return data
        elif response.status_code == 404:
            logger.info("Update endpoint not available (expected in older versions)")
            return None
        else:
            logger.warning(f"Error checking for updates: {response.status_code}")
            return None
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Error connecting to server: {e}")
        return None


def download_update(download_url, token=None):
    """Download the update package."""
    try:
        headers = {}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        logger.info(f"Downloading update from {download_url}...")
        response = requests.get(download_url, headers=headers, stream=True, timeout=60)
        response.raise_for_status()
        
        # Save to temporary file
        temp_file = AGENT_DIR / "update_package.zip"
        with open(temp_file, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        logger.info("Update downloaded successfully")
        return temp_file
        
    except Exception as e:
        logger.error(f"Error downloading update: {e}")
        return None


def backup_current_version():
    """Create a backup of the current agent installation."""
    try:
        BACKUP_DIR.mkdir(exist_ok=True)
        
        current_version = get_current_version()
        backup_path = BACKUP_DIR / f"agent_backup_{current_version}"
        
        if backup_path.exists():
            shutil.rmtree(backup_path)
        
        # Backup main files (exclude .venv, backups, etc.)
        exclude_patterns = ['.venv', 'backups', '__pycache__', '*.pyc', '.agent_identity']
        
        shutil.copytree(
            AGENT_DIR,
            backup_path,
            ignore=shutil.ignore_patterns(*exclude_patterns)
        )
        
        logger.info(f"Backup created at {backup_path}")
        return backup_path
        
    except Exception as e:
        logger.error(f"Error creating backup: {e}")
        return None


def extract_update(package_file, extract_to=None):
    """Extract the update package."""
    if extract_to is None:
        extract_to = AGENT_DIR / "update_temp"
    
    try:
        import zipfile
        
        if extract_to.exists():
            shutil.rmtree(extract_to)
        extract_to.mkdir(parents=True, exist_ok=True)
        
        logger.info("Extracting update package...")
        with zipfile.ZipFile(package_file, 'r') as zip_ref:
            zip_ref.extractall(extract_to)
        
        logger.info("Update extracted successfully")
        return extract_to
        
    except Exception as e:
        logger.error(f"Error extracting update: {e}")
        return None


def apply_update(extracted_dir):
    """Apply the update by copying files."""
    try:
        logger.info("Applying update...")
        
        # List of files/directories to update (exclude config and identity)
        files_to_update = ['main.py', 'requirements.txt']
        
        for item in files_to_update:
            src = extracted_dir / item
            dst = AGENT_DIR / item
            
            if src.exists():
                if dst.exists():
                    shutil.copy2(src, dst)
                    logger.info(f"Updated {item}")
                else:
                    shutil.copy2(src, dst)
                    logger.info(f"Created {item}")
        
        # Update requirements if changed
        new_requirements = extracted_dir / "requirements.txt"
        if new_requirements.exists():
            logger.info("Updating Python dependencies...")
            venv_python = AGENT_DIR / ".venv" / "bin" / "python"
            if platform.system() == "Windows":
                venv_python = AGENT_DIR / ".venv" / "Scripts" / "python.exe"
            
            if venv_python.exists():
                subprocess.run(
                    [str(venv_python), "-m", "pip", "install", "-r", str(new_requirements)],
                    check=False
                )
        
        logger.info("Update applied successfully")
        return True
        
    except Exception as e:
        logger.error(f"Error applying update: {e}")
        return False


def cleanup(temp_files):
    """Clean up temporary files."""
    for item in temp_files:
        try:
            if item.is_file():
                item.unlink()
            elif item.is_dir():
                shutil.rmtree(item)
        except Exception as e:
            logger.warning(f"Error cleaning up {item}: {e}")


def main():
    """Main update function."""
    logger.info("Starting agent update check...")
    
    # Get token if available (from environment or config)
    token = os.getenv('AGENT_TOKEN')
    
    # Check for updates
    update_info = check_for_updates(API_BASE_URL, token)
    
    if not update_info:
        logger.info("No updates available or update check failed")
        return 0
    
    if not update_info.get('available', False):
        logger.info(f"Agent is up to date (current: {get_current_version()})")
        return 0
    
    new_version = update_info.get('version')
    download_url = update_info.get('download_url')
    
    if not download_url:
        logger.error("Update available but no download URL provided")
        return 1
    
    logger.info(f"Update available: {new_version}")
    
    # Ask for confirmation (unless running in non-interactive mode)
    if os.getenv('AUTO_UPDATE') != '1':
        try:
            response = input(f"Update to version {new_version}? (y/N): ")
            if response.lower() != 'y':
                logger.info("Update cancelled by user")
                return 0
        except (EOFError, KeyboardInterrupt):
            logger.info("Update cancelled")
            return 0
    
    # Create backup
    backup_path = backup_current_version()
    if not backup_path:
        logger.error("Failed to create backup. Aborting update.")
        return 1
    
    temp_files = []
    
    try:
        # Download update
        package_file = download_update(download_url, token)
        if not package_file:
            logger.error("Failed to download update")
            return 1
        
        temp_files.append(package_file)
        
        # Extract update
        extracted_dir = extract_update(package_file)
        if not extracted_dir:
            logger.error("Failed to extract update")
            return 1
        
        temp_files.append(extracted_dir)
        
        # Apply update
        if not apply_update(extracted_dir):
            logger.error("Failed to apply update")
            logger.info(f"Backup available at {backup_path}")
            return 1
        
        # Save new version
        save_version(new_version)
        
        logger.info(f"Successfully updated to version {new_version}")
        logger.info("Please restart the agent service to apply changes")
        
        return 0
        
    except Exception as e:
        logger.error(f"Error during update: {e}")
        logger.info(f"Backup available at {backup_path}")
        return 1
        
    finally:
        # Cleanup
        cleanup(temp_files)


if __name__ == "__main__":
    sys.exit(main())
