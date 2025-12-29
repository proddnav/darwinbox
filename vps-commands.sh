#!/bin/bash

# IMPORTANT: Run these commands ON YOUR VPS, not on your local machine!
# First SSH into your VPS: ssh root@145.223.18.204

# Once connected to VPS, run these commands:

# Update system
apt update && apt upgrade -y

# Install Docker if not installed
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
cat > .env << 'EOF'
BROWSERLESS_TOKEN=a87e6dde8187d824a09ffa508aa9f72bebc05971e1613008452ed3d877ad6d5c
N8N_USER=admin
N8N_PASSWORD=DarwinboxN8n2024!
N8N_WEBHOOK_URL=http://145.223.18.204:5678/
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
      - WEBHOOK_URL=${N8N_WEBHOOK_URL:-http://localhost:5678/}
      - GENERIC_TIMEZONE=UTC
    volumes:
      - n8n_data:/home/node/.n8n
    restart: unless-stopped

volumes:
  n8n_data:
EOF

# Start services
docker-compose up -d

# Configure firewall
ufw allow 22/tcp
ufw allow 5678/tcp
ufw allow 3000/tcp
ufw --force enable

# Check status
docker-compose ps

echo "✅ VPS Setup Complete!"
echo "n8n URL: http://145.223.18.204:5678"
echo "Username: admin"
echo "Password: DarwinboxN8n2024!"