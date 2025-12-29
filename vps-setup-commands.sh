#!/bin/bash

# VPS Setup Commands for Darwinbox Telegram Bot
# Copy and run these commands on your VPS

echo "🚀 Starting VPS setup..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
rm get-docker.sh

# Install Docker Compose
echo "🐳 Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create services directory
echo "📁 Creating services directory..."
mkdir -p ~/darwinbox-services
cd ~/darwinbox-services

# Create .env file
echo "📝 Creating environment configuration..."
cat > .env << 'EOF'
# Browserless Configuration
BROWSERLESS_TOKEN=secure_token_abc123xyz789

# n8n Configuration  
N8N_USER=admin
N8N_PASSWORD=DarwinboxN8n2024!
N8N_WEBHOOK_URL=http://145.223.18.204:5678/
EOF

# Create docker-compose.yml
echo "📝 Creating docker-compose.yml..."
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
    networks:
      - darwinbox-network

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
    networks:
      - darwinbox-network

networks:
  darwinbox-network:
    driver: bridge

volumes:
  n8n_data:
EOF

# Start Docker services
echo "🚀 Starting Docker services..."
docker-compose up -d

# Configure firewall
echo "🔥 Configuring firewall..."
sudo apt install -y ufw
sudo ufw allow 22/tcp
sudo ufw allow 5678/tcp
sudo ufw allow 3000/tcp
sudo ufw --force enable

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 30

# Check status
echo "📊 Checking service status..."
docker-compose ps

echo "✅ Setup complete!"
echo ""
echo "🌐 Access your services:"
echo "- n8n: http://145.223.18.204:5678"
echo "  Username: admin"
echo "  Password: DarwinboxN8n2024!"
echo ""
echo "- Browserless: http://145.223.18.204:3000"
echo "  Token: secure_token_abc123xyz789"