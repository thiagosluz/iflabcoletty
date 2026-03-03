import os
import subprocess
import time
from pathlib import Path

from src.utils.logger import setup_logger

logger = setup_logger(__name__)

class KioskManager:
    def __init__(self, agent_dir: str):
        self.agent_dir = Path(agent_dir)
        self.active_file = r"C:\ProgramData\IFLabAgent\kiosk_active.txt"
        self.unlock_file = r"C:\ProgramData\IFLabAgent\unlock_kiosk.txt"

    def enforce_kiosk_process(self):
        """Monitor kiosk_active.txt and ensure the kiosk process is running in user session."""
        if not os.path.exists(self.active_file):
            return

        try:
            # Check if kiosk is already running in user session
            kiosk_running = False
            import psutil
            for p in psutil.process_iter(['name', 'cmdline']):
                try:
                    if p.info['name'] and 'python' in p.info['name'].lower():
                        cmdline = p.info.get('cmdline') or []
                        if any('kiosk.py' in arg for arg in cmdline):
                            kiosk_running = True
                            break
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass

            if not kiosk_running:
                logger.debug("Kiosk is active but process not running. Attempting to launch in user session...")
                import sys
                script_path = self.ensure_kiosk_script()
                if script_path:
                    python_exe = sys.executable.replace('python.exe', 'pythonw.exe')
                    if not os.path.exists(python_exe):
                        python_exe = sys.executable
                        
                    ps_script = f'''
$cs = Get-WmiObject -Class Win32_ComputerSystem
$user = $cs.UserName
if (-not $user) {{ exit 1 }}
if ($user -match '^(.+)\\\\(.+)$') {{
    $domain = $matches[1]
    $username = $matches[2]
}} else {{
    $domain = $env:COMPUTERNAME
    $username = $user
}}
$taskName = "IFLabKiosk_" + [System.Guid]::NewGuid().ToString("N").Substring(0,8)
cmd /c "schtasks /Create /TN `"$taskName`" /TR `"{python_exe} `"{script_path}`"`" /SC ONCE /ST 23:59 /F /RU `"$domain\\$username`" /RL HIGHEST" 2>&1 | Out-Null
cmd /c "schtasks /Run /TN `"$taskName`"" 2>&1 | Out-Null
Start-Sleep -Milliseconds 800
cmd /c "schtasks /Delete /TN `"$taskName`" /F" 2>&1 | Out-Null
exit 0
'''
                    try:
                        subprocess.run(
                            ['powershell.exe', '-ExecutionPolicy', 'Bypass', '-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps_script],
                            capture_output=True, timeout=15
                        )
                    except Exception as e:
                        logger.error(f"Failed to launch kiosk task: {e}")
        except Exception as e:
            logger.debug(f"Error checking kiosk process: {e}")



    def ensure_kiosk_script(self) -> str:
        """Returns the path to the kiosk lock script, generating it if necessary."""
        script_path = self.agent_dir / "src" / "kiosk.py"
        try:
            os.makedirs(script_path.parent, exist_ok=True)
            with open(script_path, "w", encoding="utf-8") as f:
                f.write("""import tkinter as tk
import os, time, sys
import ctypes
from ctypes import wintypes
import atexit

unlock_file = r"C:\\ProgramData\\IFLabAgent\\unlock_kiosk.txt"
active_file = r"C:\\ProgramData\\IFLabAgent\\kiosk_active.txt"

if not os.path.exists(active_file):
    sys.exit(0)

# Low-Level Keyboard Hook
WH_KEYBOARD_LL = 13
WM_KEYDOWN = 0x0100
WM_SYSKEYDOWN = 0x0104

VK_TAB = 0x09
VK_LWIN = 0x5B
VK_RWIN = 0x5C
VK_ESCAPE = 0x1B
VK_F4 = 0x73
LLKHF_ALTDOWN = 0x20

user32 = ctypes.windll.user32

class KBDLLHOOKSTRUCT(ctypes.Structure):
    _fields_ = [("vkCode", wintypes.DWORD),
                ("scanCode", wintypes.DWORD),
                ("flags", wintypes.DWORD),
                ("time", wintypes.DWORD),
                ("dwExtraInfo", ctypes.POINTER(wintypes.ULONG))]

def hook_proc(nCode, wParam, lParam):
    if nCode >= 0:
        vk = lParam.contents.vkCode
        flags = lParam.contents.flags
        
        if vk in (VK_LWIN, VK_RWIN): return 1
        if vk == VK_TAB and (flags & LLKHF_ALTDOWN): return 1
        if vk == VK_F4 and (flags & LLKHF_ALTDOWN): return 1
        if vk == VK_ESCAPE and (ctypes.windll.user32.GetAsyncKeyState(0x11) & 0x8000): return 1

    return user32.CallNextHookEx(None, nCode, wParam, lParam)

CMPFUNC = ctypes.CFUNCTYPE(ctypes.c_long, ctypes.c_int, wintypes.WPARAM, ctypes.POINTER(KBDLLHOOKSTRUCT))
pointer = CMPFUNC(hook_proc)
hook_id = None

def install_hook():
    global hook_id
    hook_id = user32.SetWindowsHookExW(WH_KEYBOARD_LL, pointer, None, 0)

def uninstall_hook():
    global hook_id
    if hook_id:
        user32.UnhookWindowsHookEx(hook_id)
        hook_id = None

def check_unlock(root):
    if os.path.exists(unlock_file):
        uninstall_hook()
        try: os.remove(unlock_file)
        except: pass
        try:
            if os.path.exists(active_file):
                os.remove(active_file)
        except: pass
        root.destroy()
        sys.exit(0)
    root.after(1000, check_unlock, root)

root = tk.Tk()
root.attributes("-fullscreen", True)
root.attributes("-topmost", True)
root.configure(background="black")
root.protocol("WM_DELETE_WINDOW", lambda: None)
root.bind("<Escape>", lambda e: None)
root.bind("<Alt-F4>", lambda e: None)
label = tk.Label(root, text="LABORATÓRIO EM ATENÇÃO", font=("Arial", 48, "bold"), fg="red", bg="black")
label.pack(expand=True)

install_hook()
atexit.register(uninstall_hook)

root.after(1000, check_unlock, root)
root.mainloop()""")
            return str(script_path)
        except Exception as e:
            logger.error(f"Error generating kiosk script: {e}")
            return None
