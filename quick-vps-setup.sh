#!/bin/bash

# QUICK VPS SETUP - Just SSH to your VPS and run this single command!
# 
# TO USE:
# 1. SSH into your VPS: ssh root@145.223.18.204
# 2. Run this command:
#    curl -sL https://raw.githubusercontent.com/yourusername/darwinbox/main/quick-vps-setup.sh | bash
#
# OR copy and paste this entire script into your VPS terminal

echo "🚀 DARWINBOX VPS QUICK SETUP"
echo "==========================="
echo ""

# Configuration
BROWSERLESS_TOKEN="a87e6dde8187d824a09ffa508aa9f72bebc05971e1613008452ed3d877ad6d5c"
N8N_USER="admin"
N8N_PASSWORD="DarwinboxN8n2024!"
N8N_WEBHOOK_URL="http://$(curl -s ifconfig.me):5678/"

# Update system
echo "📦 Updating system..."
apt update && apt upgrade -y

# Install Docker if needed
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
else
    echo "✅ Docker already installed"
fi

# Install Docker Compose if needed
if ! command -v docker-compose &> /dev/null; then
    echo "🔧 Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    echo "✅ Docker Compose already installed"
fi

# Create directory and files
echo "📁 Setting up services..."
mkdir -p ~/darwinbox-services
cd ~/darwinbox-services

# Create .env file
cat > .env << EOF
BROWSERLESS_TOKEN=${BROWSERLESS_TOKEN}
N8N_USER=${N8N_USER}
N8N_PASSWORD=${N8N_PASSWORD}
N8N_WEBHOOK_URL=${N8N_WEBHOOK_URL}
EOF

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  browserless:
    image: browserless/chrome:latest
    ports:
      - "3000:3000"
    environment:
      - CONNECTION_TIMEOUT=60000
      - MAX_CONCURRENT_SESSIONS=10
      - TOKEN=${BROWSERLESS_TOKEN}
      - KEEP_ALIVE=true
    restart: unless-stopped
    shm_size: '2gb'

  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_USER:-admin}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - N8N_HOST=0.0.0.0
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=${N8N_WEBHOOK_URL}
      - GENERIC_TIMEZONE=UTC
    volumes:
      - n8n_data:/home/node/.n8n
    restart: unless-stopped

volumes:
  n8n_data:
EOF

# Start services
echo "🚀 Starting services..."
docker-compose down 2>/dev/null
docker-compose up -d

# Configure firewall
echo "🔥 Configuring firewall..."
apt install -y ufw
ufw allow 22/tcp
ufw allow 5678/tcp
ufw allow 3000/tcp
ufw --force enable

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 30

# Check status
echo ""
echo "📊 Checking service status..."
docker-compose ps

echo ""
echo "✅ SETUP COMPLETE!"
echo "=================="
echo ""
echo "📌 n8n URL: http://$(curl -s ifconfig.me):5678"
echo "   Username: ${N8N_USER}"
echo "   Password: ${N8N_PASSWORD}"
echo ""
echo "📌 Browserless URL: http://$(curl -s ifconfig.me):3000"
echo "   Token: ${BROWSERLESS_TOKEN}"
echo ""
echo "🎉 Your services are now running!"