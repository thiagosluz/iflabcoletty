# IFG Lab Manager - Agent Installation Script for Windows
# This script installs the agent as a Windows Service using NSSM (Non-Sucking Service Manager)

param(
    [string]$ServiceName = "IFLabAgent",
    [string]$ServiceDisplayName = "IFG Lab Manager Agent",
    [string]$ServiceDescription = "IFG Lab Manager Agent - Monitors computer status and reports to server"
)

$ErrorActionPreference = "Stop"

# Colors for output (PowerShell 5.1+)
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-ColorOutput Green "=== IFG Lab Manager - Agent Installation (Windows) ==="
Write-Output ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-ColorOutput Red "Error: This script must be run as Administrator"
    Write-Output "Right-click PowerShell and select 'Run as Administrator'"
    exit 1
}

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AgentDir = $ScriptDir

Write-Output "Agent directory: $AgentDir"
Write-Output ""

# Check Python
Write-ColorOutput Yellow "Checking Python installation..."
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Python not found"
    }
    Write-ColorOutput Green "Found: $pythonVersion"
} catch {
    Write-ColorOutput Red "Error: Python is not installed or not in PATH"
    Write-Output "Please install Python 3.8 or higher from https://www.python.org/downloads/"
    Write-Output "Make sure to check 'Add Python to PATH' during installation"
    exit 1
}

# Check Python version
$versionOutput = python --version 2>&1
$versionMatch = $versionOutput -match "Python (\d+)\.(\d+)"
if ($versionMatch) {
    $major = [int]$matches[1]
    $minor = [int]$matches[2]
    if ($major -lt 3 -or ($major -eq 3 -and $minor -lt 8)) {
        Write-ColorOutput Red "Error: Python 3.8 or higher is required. Found: Python $major.$minor"
        exit 1
    }
}

# Check for NSSM
Write-ColorOutput Yellow "Checking for NSSM (Non-Sucking Service Manager)..."
$nssmPath = $null

# Check common locations
$nssmLocations = @(
    "$env:ProgramFiles\nssm\nssm.exe",
    "$env:ProgramFiles(x86)\nssm\nssm.exe",
    "$AgentDir\nssm\nssm.exe",
    "nssm.exe"
)

foreach ($location in $nssmLocations) {
    if (Test-Path $location) {
        $nssmPath = $location
        Write-ColorOutput Green "Found NSSM at: $nssmPath"
        break
    }
}

if (-not $nssmPath) {
    Write-ColorOutput Yellow "NSSM not found. Downloading NSSM..."
    
    $nssmDir = "$AgentDir\nssm"
    if (-not (Test-Path $nssmDir)) {
        New-Item -ItemType Directory -Path $nssmDir | Out-Null
    }
    
    $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $nssmZip = "$nssmDir\nssm.zip"
    
    try {
        # Determine architecture
        $arch = if ([Environment]::Is64BitOperatingSystem) { "win64" } else { "win32" }
        
        Write-Output "Downloading NSSM..."
        Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip -UseBasicParsing
        
        Write-Output "Extracting NSSM..."
        Expand-Archive -Path $nssmZip -DestinationPath $nssmDir -Force
        Remove-Item $nssmZip
        
        $nssmPath = "$nssmDir\nssm-2.24\$arch\nssm.exe"
        
        if (-not (Test-Path $nssmPath)) {
            throw "NSSM extraction failed"
        }
        
        Write-ColorOutput Green "NSSM downloaded and extracted successfully"
    } catch {
        Write-ColorOutput Red "Error downloading NSSM: $_"
        Write-Output "Please download NSSM manually from https://nssm.cc/download"
        Write-Output "Extract it to: $nssmDir"
        exit 1
    }
}

# Create virtual environment
Write-ColorOutput Yellow "Setting up Python virtual environment..."
Set-Location $AgentDir

if (-not (Test-Path ".venv")) {
    python -m venv .venv
    Write-ColorOutput Green "Virtual environment created"
} else {
    Write-ColorOutput Green "Virtual environment already exists"
}

# Install dependencies
Write-ColorOutput Yellow "Installing Python dependencies..."
& "$AgentDir\.venv\Scripts\python.exe" -m pip install --upgrade pip
& "$AgentDir\.venv\Scripts\pip.exe" install -r requirements.txt

# Check if service already exists
$serviceExists = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue

if ($serviceExists) {
    Write-ColorOutput Yellow "Service '$ServiceName' already exists. Removing old service..."
    & $nssmPath stop $ServiceName
    Start-Sleep -Seconds 2
    & $nssmPath remove $ServiceName confirm
    Start-Sleep -Seconds 1
}

# Install service using NSSM
Write-ColorOutput Yellow "Installing Windows Service..."
$pythonExe = "$AgentDir\.venv\Scripts\python.exe"
$mainScript = "$AgentDir\main.py"

& $nssmPath install $ServiceName $pythonExe "$mainScript"
& $nssmPath set $ServiceName DisplayName $ServiceDisplayName
& $nssmPath set $ServiceName Description $ServiceDescription
& $nssmPath set $ServiceName Start SERVICE_AUTO_START
& $nssmPath set $ServiceName AppDirectory $AgentDir
& $nssmPath set $ServiceName AppStdout "$AgentDir\logs\service.log"
& $nssmPath set $ServiceName AppStderr "$AgentDir\logs\service_error.log"

# Create logs directory
$logsDir = "$AgentDir\logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
}

# Set recovery options (restart on failure)
& $nssmPath set $ServiceName AppRestartDelay 10000
& $nssmPath set $ServiceName AppExit Default Restart

Write-Output ""
Write-ColorOutput Green "=== Installation Complete ==="
Write-Output ""
Write-Output "Service installed: $ServiceName"
Write-Output "Service display name: $ServiceDisplayName"
Write-Output "Agent directory: $AgentDir"
Write-Output ""

Write-ColorOutput Yellow "Configuration:"
Write-Output "Before starting the service, configure the agent by:"
Write-Output "  1. Setting environment variables in the service (use NSSM GUI or command line)"
Write-Output "  2. Or create a .env file in $AgentDir"
Write-Output ""

Write-ColorOutput Yellow "Useful commands:"
Write-Output "  Start service:    Start-Service $ServiceName"
Write-Output "  Stop service:      Stop-Service $ServiceName"
Write-Output "  Restart service:   Restart-Service $ServiceName"
Write-Output "  Check status:      Get-Service $ServiceName"
Write-Output "  View logs:         Get-Content $logsDir\service.log -Tail 50 -Wait"
Write-Output "  Remove service:    & `"$nssmPath`" remove $ServiceName confirm"
Write-Output ""

Write-ColorOutput Yellow "To configure environment variables:"
Write-Output "  Option 1: Use NSSM GUI:"
Write-Output "    & `"$nssmPath`" edit $ServiceName"
Write-Output ""
Write-Output "  Option 2: Use command line:"
Write-Output "    & `"$nssmPath`" set $ServiceName AppEnvironmentExtra `"API_BASE_URL=http://your-server:8000/api/v1`""
Write-Output "    & `"$nssmPath`" set $ServiceName AppEnvironmentExtra `"LAB_ID=1`""
Write-Output "    & `"$nssmPath`" set $ServiceName AppEnvironmentExtra `"AGENT_EMAIL=admin@iflab.com`""
Write-Output "    & `"$nssmPath`" set $ServiceName AppEnvironmentExtra `"AGENT_PASSWORD=your-password`""
Write-Output ""

Write-ColorOutput Green "Installation completed successfully!"
Write-ColorOutput Yellow "Remember to configure the agent before starting the service."
Write-Output ""
