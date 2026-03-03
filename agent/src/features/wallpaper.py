import os
import subprocess
import tempfile
import platform
from src import config
from pathlib import Path

from src.utils.logger import setup_logger
from src.api_client import ApiClient

logger = setup_logger(__name__)

def run_silent(*args, **kwargs):
    if platform.system() == "Windows":
        kwargs["creationflags"] = 0x08000000  # subprocess.CREATE_NO_WINDOW
    return subprocess.run(*args, **kwargs)

class WallpaperManager:
    def __init__(self, api_client: ApiClient):
        self.api = api_client
        self._cached_lab_wallpaper_url = None
        self._cached_lab_wallpaper_enabled = True
        self._wallpaper_task_checked = False

    def enforce_lab_wallpaper(self):
        """Verifica o wallpaper padrão do lab no servidor e, se o atual for diferente, aplica o padrão."""
        if not self.api.computer_id:
            return
            
        try:
            response = self.api.get("/agent/me")
            if response.status_code == 200:
                pc_data = response.json()
                lab_data = pc_data.get('lab')
                if lab_data:
                    self._cached_lab_wallpaper_url = lab_data.get('default_wallpaper_url')
                    self._cached_lab_wallpaper_enabled = lab_data.get('default_wallpaper_enabled', True)
        except Exception as e:
            logger.debug(f"Failed to sync lab wallpaper info: {e}")

        if not getattr(self, '_cached_lab_wallpaper_enabled', True):
            return
            
        url = (self._cached_lab_wallpaper_url or "").strip()
        if not url:
            return
            
        if url.startswith("/"):
            base = config.SERVER_URL.rstrip("/").replace("/api/v1", "").rstrip("/")
            url = base + url
        else:
            # If the backend sent an absolute URL using localhost or 127.0.0.1 
            # We boldly rewrite it using the agent's actual operational base URL.
            from urllib.parse import urlparse, urlunparse
            parsed_url = urlparse(url)
            if parsed_url.hostname in ['localhost', '127.0.0.1']:
                working_base = getattr(self.api, 'base_url', config.API_BASE_URL)
                parsed_base = urlparse(working_base)
                old_url = url
                # Replace scheme and netloc with the actual server's configuration
                url = urlunparse((parsed_base.scheme, parsed_base.netloc, parsed_url.path, parsed_url.params, parsed_url.query, parsed_url.fragment))
                if url == old_url:
                    logger.warning(f"URL rewrite attempted but result is identical! Working base was: {working_base}")
                else:
                    logger.info(f"Rewrote local wallpaper URL from {old_url} to {url}")
            
        try:
            current_path = self._get_current_wallpaper_path()
            local_path = self._download_wallpaper(url)
            if not local_path:
                return
                
            normalized_current = (current_path or "").replace("\\", "/").rstrip("/")
            normalized_local = local_path.replace("\\", "/").rstrip("/")
            
            if self._is_windows_service():
                if getattr(self, '_last_applied_url', None) == url:
                    return
            else:
                if normalized_current and normalized_current == normalized_local:
                    return
                
            final_path = self._set_wallpaper(local_path)
            if final_path:
                self._last_applied_url = url
                logger.info("Lab default wallpaper applied: %s", final_path)
        except Exception as e:
            logger.debug("Lab wallpaper enforcement skipped or failed: %s", e)

    def _download_wallpaper(self, url: str) -> str:
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
            r = self.api.session.get(url, stream=True, timeout=30)
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
                ps_script = r"Get-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name Wallpaper -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Wallpaper"
                result = run_silent(
                    ["powershell.exe", "-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", ps_script],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                if result.returncode == 0 and result.stdout and result.stdout.strip():
                    return result.stdout.strip()
                return None
            else:
                result = run_silent(
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

    def _set_wallpaper(self, file_path):
        """Aplica o arquivo como papel de parede. file_path deve ser caminho absoluto."""
        try:
            abs_path = str(Path(file_path).resolve())
            if not os.path.exists(abs_path):
                logger.warning("Wallpaper file does not exist, skipping: %s", abs_path)
                return None
                
            if platform.system() == "Windows":
                if self._is_windows_service():
                    logger.info("Wallpaper: running as service (Session 0), using ProgramData and scheduled task")
                    dest_path = self._copy_wallpaper_to_programdata(abs_path)
                    if not dest_path:
                        return None
                    if not self._write_pending_wallpaper(dest_path):
                        return None
                    self._ensure_wallpaper_script()
                    self._run_wallpaper_task()
                    return dest_path
                    
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
                result = run_silent(
                    ["powershell.exe", "-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", ps_script],
                    capture_output=True,
                    text=True,
                    timeout=15,
                )
                if result.returncode != 0:
                    raise RuntimeError(result.stderr or result.stdout or "Unknown error")
                return abs_path
            else:
                uri = "file://" + abs_path
                result = run_silent(
                    ["gsettings", "set", "org.gnome.desktop.background", "picture-uri", uri],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                if result.returncode != 0:
                    raise RuntimeError(result.stderr or result.stdout or "Unknown error")
                return abs_path
        except Exception as e:
            logger.warning("Failed to set wallpaper: %s", e)
            raise

    # ==== Helper methods for Windows Services ====
    
    def _is_windows_service(self):
        if platform.system() != "Windows":
            return False
        try:
            ps_script = "(Get-Process -Id $PID).SessionId -eq 0"
            result = run_silent(
                ["powershell.exe", "-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", ps_script],
                capture_output=True, text=True, timeout=5,
            )
            return result.returncode == 0 and result.stdout.strip().lower() == "true"
        except Exception:
            return False

    def _wallpaper_programdata_dir(self):
        pd = os.environ.get("ProgramData", "C:\\ProgramData")
        return Path(pd) / "IFLabAgent"

    def _copy_wallpaper_to_programdata(self, source_path):
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
        if platform.system() != "Windows":
            return
        try:
            # *S-1-5-32-545 is the built-in Users group SID, works in any language
            run_silent(["icacls", file_path, "/grant", "*S-1-5-32-545:R", "/q"], capture_output=True, timeout=5)
        except Exception:
            pass

    def _write_pending_wallpaper(self, abs_path):
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
            task_name = 'IFLabAgentSetWallpaper'
            result = run_silent(
                ["schtasks", "/Run", "/TN", task_name],
                capture_output=True, text=True, timeout=15
            )
            if result.returncode == 0:
                logger.info("Wallpaper task result: %s", result.stdout.strip()[:200])
            else:
                logger.debug("Wallpaper task script failed: %s", result.stderr or result.stdout)
        except Exception as e:
            logger.warning("Failed to run wallpaper task: %s", e)

