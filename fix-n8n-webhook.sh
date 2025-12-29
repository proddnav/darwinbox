#!/bin/bash

echo "🔧 Fixing N8N webhook configuration..."

ssh root@145.223.18.204 << 'EOF'
cd ~/darwinbox-services

echo "📝 Updating docker-compose.yml with webhook URL..."

# Backup current file
cp docker-compose.yml docker-compose.yml.backup

# Add WEBHOOK_URL to n8n service
cat > docker-compose-update.yml << 'COMPOSE'
services:
  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=false
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://mortality-mileage-chemical-exhibits.trycloudflare.com
      - N8N_WEBHOOK_BASE_URL=https://mortality-mileage-chemical-exhibits.trycloudflare.com
    volumes:
      - n8n_data:/home/node/.n8n
    restart: unless-stopped

  browserless:
    image: browserless/chrome:latest
    ports:
      - "3000:3000"
    environment:
      - TOKEN=mySecureToken9959547700
      - MAX_CONCURRENT_SESSIONS=10
      - TIMEOUT=60000
    restart: unless-stopped

volumes:
  n8n_data:
COMPOSE

# Replace the old file
mv docker-compose-update.yml docker-compose.yml

echo "🔄 Restarting N8N with correct webhook configuration..."
docker compose down
docker compose up -d

echo ""
echo "✅ Done! N8N has been restarted with the correct HTTPS webhook URL."
echo ""
echo "📋 Next steps:"
echo "1. Go back to N8N"
echo "2. Refresh the page (Ctrl+R)"
echo "3. Open your workflow"
echo "4. The webhook should now use HTTPS"
echo "5. Activate the workflow"
EOF