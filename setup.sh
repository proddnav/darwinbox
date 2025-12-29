#\!/bin/bash

# VPS Setup Script for Darwinbox Telegram Bot
echo "🚀 Starting VPS setup for Darwinbox Telegram Bot..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Docker if not already installed
if \! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
else
    echo "✅ Docker already installed"
fi

# Install Docker Compose
if \! command -v docker-compose &> /dev/null; then
    echo "🐳 Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
else
    echo "✅ Docker Compose already installed"
fi

# Create services directory
echo "📁 Creating services directory..."
mkdir -p ~/darwinbox-services
cd ~/darwinbox-services

# Create .env file with configurations
echo "📝 Creating environment configuration..."
cat > .env << 'EOL'
# Browserless Configuration
BROWSERLESS_TOKEN=a87e6dde8187d824a09ffa508aa9f72bebc05971e1613008452ed3d877ad6d5c

# n8n Configuration
N8N_USER=admin
N8N_PASSWORD=DarwinboxN8n2024\!
N8N_WEBHOOK_URL=http://145.223.18.204:5678/
EOL

# Create docker-compose.yml
echo "📝 Creating docker-compose.yml..."
cat > docker-compose.yml << 'EOL'
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
EOL

# Start Docker services
echo "🚀 Starting Docker services..."
docker-compose up -d

# Wait for services to start
echo "⏳ Waiting for services to start (30 seconds)..."
sleep 30

# Check service status
echo "📊 Checking service status..."
docker-compose ps

# Setup firewall
echo "🔥 Configuring firewall..."
sudo apt install -y ufw
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 5678/tcp  # n8n
sudo ufw allow 3000/tcp  # Browserless
sudo ufw --force enable

# Display access information
echo ""
echo "✅ Setup complete\!"
echo ""
echo "🌐 Access your services:"
echo "- n8n: http://145.223.18.204:5678"
echo "  Username: admin"
echo "  Password: DarwinboxN8n2024\!"
echo ""
echo "- Browserless: http://145.223.18.204:3000"
echo "  Token: a87e6dde8187d824a09ffa508aa9f72bebc05971e1613008452ed3d877ad6d5c"
echo ""
echo "📋 Next steps:"
echo "1. Access n8n at http://145.223.18.204:5678"
echo "2. Create Telegram credential"
echo "3. Import workflows"
echo "4. Test the bot"
EOF < /dev/null