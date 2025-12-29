#!/bin/bash

# Automated VPS Setup Script - Does EVERYTHING for you!
# This script runs from your LOCAL machine and sets up the VPS remotely

set -e

echo "🚀 AUTOMATED VPS SETUP FOR DARWINBOX BOT"
echo "========================================"
echo ""

# VPS Details
VPS_IP="145.223.18.204"
VPS_USER="root"

# Service Configuration
BROWSERLESS_TOKEN="a87e6dde8187d824a09ffa508aa9f72bebc05971e1613008452ed3d877ad6d5c"
N8N_USER="admin"
N8N_PASSWORD="DarwinboxN8n2024!"

echo "📋 This script will automatically:"
echo "  ✓ Connect to your VPS"
echo "  ✓ Install all required software"
echo "  ✓ Set up Docker services"
echo "  ✓ Configure firewall"
echo "  ✓ Start all services"
echo ""

# Ask for VPS password
echo "🔑 Please enter your VPS password when prompted..."
echo ""

# Function to execute commands on VPS
execute_on_vps() {
    ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "$1"
}

# Function to check command success
check_status() {
    if [ $? -eq 0 ]; then
        echo "✅ $1 - SUCCESS"
    else
        echo "❌ $1 - FAILED"
        return 1
    fi
}

echo "🔍 Step 1: Checking VPS connection..."
execute_on_vps "echo 'Connected to VPS successfully!'"
check_status "VPS Connection"

echo ""
echo "📦 Step 2: Updating system packages..."
execute_on_vps "apt update && apt upgrade -y"
check_status "System Update"

echo ""
echo "🐳 Step 3: Checking/Installing Docker..."
execute_on_vps "docker --version 2>/dev/null || (curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh && rm get-docker.sh)"
check_status "Docker Installation"

echo ""
echo "🔧 Step 4: Checking/Installing Docker Compose..."
execute_on_vps "docker-compose --version 2>/dev/null || (curl -L 'https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)' -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose)"
check_status "Docker Compose Installation"

echo ""
echo "📁 Step 5: Setting up directory structure..."
execute_on_vps "mkdir -p ~/darwinbox-services"
check_status "Directory Creation"

echo ""
echo "🔐 Step 6: Creating environment configuration..."
execute_on_vps "cd ~/darwinbox-services && cat > .env << 'EOF'
BROWSERLESS_TOKEN=${BROWSERLESS_TOKEN}
N8N_USER=${N8N_USER}
N8N_PASSWORD=${N8N_PASSWORD}
N8N_WEBHOOK_URL=http://${VPS_IP}:5678/
EOF"
check_status "Environment File Creation"

echo ""
echo "📝 Step 7: Creating docker-compose.yml..."
execute_on_vps "cd ~/darwinbox-services && cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  browserless:
    image: browserless/chrome:latest
    ports:
      - \"3000:3000\"
    environment:
      - CONNECTION_TIMEOUT=60000
      - MAX_CONCURRENT_SESSIONS=10
      - TOKEN=\${BROWSERLESS_TOKEN}
      - KEEP_ALIVE=true
    restart: unless-stopped
    shm_size: '2gb'

  n8n:
    image: n8nio/n8n:latest
    ports:
      - \"5678:5678\"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=\${N8N_USER:-admin}
      - N8N_BASIC_AUTH_PASSWORD=\${N8N_PASSWORD}
      - N8N_HOST=0.0.0.0
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=\${N8N_WEBHOOK_URL:-http://localhost:5678/}
      - GENERIC_TIMEZONE=UTC
    volumes:
      - n8n_data:/home/node/.n8n
    restart: unless-stopped

volumes:
  n8n_data:
EOF"
check_status "Docker Compose File Creation"

echo ""
echo "🚀 Step 8: Starting services..."
execute_on_vps "cd ~/darwinbox-services && docker-compose down 2>/dev/null; docker-compose up -d"
check_status "Services Start"

echo ""
echo "🔥 Step 9: Configuring firewall..."
execute_on_vps "apt install -y ufw && ufw allow 22/tcp && ufw allow 5678/tcp && ufw allow 3000/tcp && ufw --force enable"
check_status "Firewall Configuration"

echo ""
echo "⏳ Step 10: Waiting for services to start (30 seconds)..."
sleep 30

echo ""
echo "📊 Step 11: Checking service status..."
execute_on_vps "cd ~/darwinbox-services && docker-compose ps"

echo ""
echo "🧪 Step 12: Testing services..."
echo ""

# Test Browserless
echo -n "Testing Browserless (http://${VPS_IP}:3000)... "
if curl -s -o /dev/null -w "%{http_code}" "http://${VPS_IP}:3000" | grep -q "401"; then
    echo "✅ Working (requires auth)"
else
    echo "❌ Not responding"
fi

# Test n8n
echo -n "Testing n8n (http://${VPS_IP}:5678)... "
if curl -s -o /dev/null -w "%{http_code}" "http://${VPS_IP}:5678" | grep -q "200\|401"; then
    echo "✅ Working"
else
    echo "❌ Not responding"
fi

echo ""
echo "========================================"
echo "🎉 VPS SETUP COMPLETE!"
echo "========================================"
echo ""
echo "📌 Service URLs:"
echo "   n8n: http://${VPS_IP}:5678"
echo "   Username: ${N8N_USER}"
echo "   Password: ${N8N_PASSWORD}"
echo ""
echo "   Browserless: http://${VPS_IP}:3000"
echo "   Token: ${BROWSERLESS_TOKEN}"
echo ""
echo "🔍 To check logs:"
echo "   ssh ${VPS_USER}@${VPS_IP}"
echo "   cd ~/darwinbox-services"
echo "   docker-compose logs -f"
echo ""
echo "✨ Your VPS is now fully configured!"