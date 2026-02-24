#!/bin/bash

# IFG Lab Manager - Agent Installation Script for Linux
# This script installs the agent as a systemd service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$SCRIPT_DIR"
SERVICE_NAME="iflab-agent"
SERVICE_USER="${SERVICE_USER:-iflab}"

# Parse parameters
API_BASE_URL=""
LAB_ID=""
INSTALLATION_TOKEN=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --url) API_BASE_URL="$2"; shift ;;
        --lab) LAB_ID="$2"; shift ;;
        --token) INSTALLATION_TOKEN="$2"; shift ;;
        *) echo -e "${RED}Unknown parameter passed: $1${NC}"; exit 1 ;;
    esac
    shift
done

echo -e "${GREEN}=== IFG Lab Manager - Agent Installation (Linux) ===${NC}\n"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Check Python 3
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 is not installed${NC}"
    echo "Please install Python 3.8 or higher:"
    echo "  Ubuntu/Debian: sudo apt-get install python3 python3-venv python3-pip"
    echo "  CentOS/RHEL: sudo yum install python3 python3-pip"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
REQUIRED_VERSION="3.8"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo -e "${RED}Error: Python 3.8 or higher is required. Found: $PYTHON_VERSION${NC}"
    exit 1
fi

# Create service user if it doesn't exist
if ! id "$SERVICE_USER" &>/dev/null; then
    echo -e "${YELLOW}Creating service user: $SERVICE_USER${NC}"
    useradd -r -s /bin/bash -d "$AGENT_DIR" "$SERVICE_USER"
else
    echo -e "${GREEN}Service user $SERVICE_USER already exists${NC}"
fi

# Create virtual environment
echo -e "${YELLOW}Setting up Python virtual environment...${NC}"
cd "$AGENT_DIR"

if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    echo -e "${GREEN}Virtual environment created${NC}"
else
    echo -e "${GREEN}Virtual environment already exists${NC}"
fi

# Install dependencies
echo -e "${YELLOW}Installing Python dependencies...${NC}"
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# Create .env file if parameters were provided
if [ -n "$API_BASE_URL" ] && [ -n "$LAB_ID" ] && [ -n "$INSTALLATION_TOKEN" ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cat > "$AGENT_DIR/.env" <<EOF
API_BASE_URL=$API_BASE_URL
LAB_ID=$LAB_ID
INSTALLATION_TOKEN=$INSTALLATION_TOKEN
EOF
    echo -e "${GREEN}.env file created successfully!${NC}"
fi

# Set permissions
echo -e "${YELLOW}Setting permissions...${NC}"
chown -R "$SERVICE_USER:$SERVICE_USER" "$AGENT_DIR"
if [ -f "$AGENT_DIR/.env" ]; then
    chmod 600 "$AGENT_DIR/.env"
fi
chmod +x "$AGENT_DIR/main.py"

# Create systemd service file
echo -e "${YELLOW}Creating systemd service...${NC}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=IFG Lab Manager Agent
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$AGENT_DIR
Environment="PATH=$AGENT_DIR/.venv/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=$AGENT_DIR/.venv/bin/python $AGENT_DIR/main.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$AGENT_DIR

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

# Enable service
systemctl enable "$SERVICE_NAME"

echo -e "\n${GREEN}=== Installation Complete ===${NC}\n"
echo -e "Service installed: ${GREEN}$SERVICE_NAME${NC}"
echo -e "Service file: ${GREEN}$SERVICE_FILE${NC}"
echo -e "Agent directory: ${GREEN}$AGENT_DIR${NC}"
echo -e "Service user: ${GREEN}$SERVICE_USER${NC}\n"

echo -e "${YELLOW}Configuration:${NC}"
echo "Before starting the service, configure the agent by editing:"
echo "  - Environment variables in $SERVICE_FILE"
echo "  - Or create a .env file in $AGENT_DIR\n"

echo -e "${YELLOW}Useful commands:${NC}"
echo "  Start service:    sudo systemctl start $SERVICE_NAME"
echo "  Stop service:     sudo systemctl stop $SERVICE_NAME"
echo "  Restart service:  sudo systemctl restart $SERVICE_NAME"
echo "  Check status:     sudo systemctl status $SERVICE_NAME"
echo "  View logs:        sudo journalctl -u $SERVICE_NAME -f"
echo "  Disable service:  sudo systemctl disable $SERVICE_NAME\n"

echo -e "${YELLOW}To configure environment variables, edit $SERVICE_FILE and add:${NC}"
echo "  Environment=\"API_BASE_URL=http://your-server:8000/api/v1\""
echo "  Environment=\"LAB_ID=1\""
echo "  Environment=\"INSTALLATION_TOKEN=your-token\""
echo "  Environment=\"LOG_LEVEL=INFO\"\n"

echo -e "${GREEN}Installation completed successfully!${NC}"
echo -e "${YELLOW}Remember to configure the agent before starting the service.${NC}\n"
