#!/bin/bash

# SIMPLE VPS SETUP - No special tools needed!
# Just copy and run commands step by step

echo "🚀 DARWINBOX VPS SETUP GUIDE"
echo "============================"
echo ""
echo "This guide will help you set up your VPS manually."
echo ""
echo "📋 STEP 1: Connect to your VPS"
echo "------------------------------"
echo "Open a new Terminal window and run:"
echo ""
echo "ssh root@145.223.18.204"
echo ""
echo "Enter your password when prompted."
echo ""
read -p "Press Enter when you're connected to your VPS..."
echo ""

echo "📋 STEP 2: Copy and paste these commands"
echo "---------------------------------------"
echo "Copy ALL the text below and paste it into your VPS terminal:"
echo ""
echo "================== COPY FROM HERE =================="
cat << 'EOF'
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create services directory
mkdir -p ~/darwinbox-services
cd ~/darwinbox-services

# Create .env file
cat > .env << 'ENVEOF'
BROWSERLESS_TOKEN=a87e6dde8187d824a09ffa508aa9f72bebc05971e1613008452ed3d877ad6d5c
N8N_USER=admin
N8N_PASSWORD=DarwinboxN8n2024!
N8N_WEBHOOK_URL=http://145.223.18.204:5678/
ENVEOF

# Create docker-compose.yml
cat > docker-compose.yml << 'DCEOF'
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
DCEOF

# Start services
docker-compose up -d

# Configure firewall
apt install -y ufw
ufw allow 22/tcp
ufw allow 5678/tcp
ufw allow 3000/tcp
ufw --force enable

# Wait for services
echo "Waiting for services to start..."
sleep 30

# Check status
docker-compose ps

echo "✅ SETUP COMPLETE!"
echo "n8n: http://145.223.18.204:5678"
echo "Username: admin"
echo "Password: DarwinboxN8n2024!"
EOF
echo "================== COPY TO HERE =================="
echo ""
echo "After pasting, wait for all commands to complete (about 5-10 minutes)."
echo ""
read -p "Press Enter when the setup is complete..."
echo ""

echo "📋 STEP 3: Verify everything is working"
echo "--------------------------------------"
echo "Open your browser and check:"
echo ""
echo "1. n8n: http://145.223.18.204:5678"
echo "   Username: admin"
echo "   Password: DarwinboxN8n2024!"
echo ""
echo "2. If n8n loads, your setup is complete! 🎉"
echo ""
echo "If you have any issues, the services might still be starting."
echo "Wait a few minutes and try again."