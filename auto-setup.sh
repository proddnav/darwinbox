#!/bin/bash

# Automated Setup Script for Non-Technical Users
# This script will set up everything for you!

echo "🤖 Welcome! I'll help you set up your Darwinbox Bot automatically."
echo ""
echo "This will take about 10-15 minutes. Just follow the prompts!"
echo ""

# Set all the credentials
export TELEGRAM_BOT_TOKEN="8124495283:AAE-3zkAn3iaElPys6TvsC2y587G7vyPd4g"
export OPENROUTER_API_KEY="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"
export REDIS_URL="redis://default:AdgrAAIncDEwMWE2YmU1NDc1NzA0YWU0YmQxMWIzZDVhYTc3ZGJmOXAxNTUzMzk@advanced-honeybee-55339.upstash.io:6379"
export VPS_IP="145.223.18.204"
export BROWSERLESS_TOKEN="secure_token_abc123xyz789"
export N8N_PASSWORD="DarwinboxN8n2024!"

# Step 1: Deploy to Vercel
echo "📦 Step 1: Deploying your bot to Vercel..."
echo ""
echo "Please do the following:"
echo "1. Open your browser and go to: https://vercel.com"
echo "2. Click 'Import Project'"
echo "3. Enter this URL: https://github.com/proddnav/darwinbox"
echo "4. Click 'Import'"
echo ""
echo "5. IMPORTANT: Before clicking Deploy, add these Environment Variables:"
echo ""
echo "Click 'Add' for each one and copy-paste exactly:"
echo ""
echo "OPENROUTER_API_KEY"
echo "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"
echo ""
echo "REDIS_URL"
echo "redis://default:AdgrAAIncDEwMWE2YmU1MDc1NzA0YWU0YmQxMWIzZDVhYTc3ZGJmOXAxNTUzMzk@advanced-honeybee-55339.upstash.io:6379"
echo ""
echo "BROWSERLESS_URL"
echo "http://145.223.18.204:3000"
echo ""
echo "BROWSERLESS_TOKEN"
echo "secure_token_abc123xyz789"
echo ""
echo "TELEGRAM_BOT_TOKEN"
echo "8124495283:AAE-3zkAn3iaElPys6TvsC2y587G7vyPd4g"
echo ""
echo "NEXT_PUBLIC_BASE_URL"
echo "https://your-project-name.vercel.app"
echo ""
read -p "Press Enter when you've added all environment variables..."
echo ""
echo "6. Click 'Deploy' and wait for it to complete"
echo "7. Copy your Vercel URL (looks like: https://something.vercel.app)"
echo ""
read -p "Please paste your Vercel URL here and press Enter: " VERCEL_URL
echo ""
echo "8. Go back to Vercel Settings → Environment Variables"
echo "9. Edit NEXT_PUBLIC_BASE_URL and update it to: $VERCEL_URL"
echo "10. This will trigger a redeploy - wait for it to complete"
echo ""
read -p "Press Enter when the redeploy is complete..."

# Step 2: Set up VPS
echo ""
echo "🖥️ Step 2: Setting up your VPS server..."
echo ""
echo "I'll create a setup file for you to run on your VPS."
echo ""

# Create the VPS setup commands
cat > vps-commands.txt << 'VPSEOF'
# Run these commands on your VPS:

# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
rm get-docker.sh

# 3. Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. Create directory
mkdir -p ~/darwinbox-services
cd ~/darwinbox-services

# 5. Create environment file
cat > .env << 'EOF'
BROWSERLESS_TOKEN=secure_token_abc123xyz789
N8N_USER=admin
N8N_PASSWORD=DarwinboxN8n2024!
N8N_WEBHOOK_URL=http://145.223.18.204:5678/
EOF

# 6. Create docker-compose.yml
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

# 7. Start services
docker-compose up -d

# 8. Configure firewall
sudo apt install -y ufw
sudo ufw allow 22/tcp
sudo ufw allow 5678/tcp
sudo ufw allow 3000/tcp
sudo ufw --force enable

# 9. Check status
sleep 30
docker-compose ps
VPSEOF

echo "I've created 'vps-commands.txt' with all the commands you need."
echo ""
echo "To set up your VPS:"
echo "1. Open a new Terminal/PowerShell window"
echo "2. Type: ssh root@145.223.18.204"
echo "3. Enter your VPS password when prompted"
echo "4. Once connected, copy and paste the commands from vps-commands.txt"
echo ""
read -p "Press Enter when your VPS is set up and services are running..."

# Step 3: Configure n8n
echo ""
echo "🔧 Step 3: Setting up n8n workflows..."
echo ""
echo "1. Open your browser and go to: http://145.223.18.204:5678"
echo "2. Login with:"
echo "   Username: admin"
echo "   Password: DarwinboxN8n2024!"
echo ""
echo "3. Once logged in:"
echo "   a. Click 'Settings' → 'Credentials' → 'Add Credential'"
echo "   b. Search for 'Telegram' and select it"
echo "   c. Name: Telegram Bot"
echo "   d. Access Token: 8124495283:AAE-3zkAn3iaElPys6TvsC2y587G7vyPd4g"
echo "   e. Click 'Save'"
echo ""
echo "4. Click 'Settings' → 'Variables'"
echo "   a. Add Variable"
echo "   b. Name: NEXT_PUBLIC_BASE_URL"
echo "   c. Value: $VERCEL_URL"
echo "   d. Click 'Save'"
echo ""
read -p "Press Enter when you've completed the n8n setup..."

# Final steps
echo ""
echo "✅ Almost done! Your bot is ready to use!"
echo ""
echo "📱 To use your bot:"
echo "1. Open Telegram"
echo "2. Search for: @your_bot_username"
echo "3. Send /start to begin"
echo "4. Send an invoice photo to process it"
echo ""
echo "🎉 Congratulations! Your Darwinbox automation bot is now live!"
echo ""
echo "Need help? Check the setup-ai.md file for troubleshooting."