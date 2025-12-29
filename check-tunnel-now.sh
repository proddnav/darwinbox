#!/bin/bash

echo "🔍 Checking your tunnel URL..."

ssh root@145.223.18.204 << 'EOF'
echo "Getting tunnel URL from service logs..."

# Get the URL from the journal
TUNNEL_URL=$(journalctl -u n8n-tunnel -n 200 --no-pager | grep -o 'https://[^[:space:]]*\.trycloudflare\.com' | head -1)

if [ -z "$TUNNEL_URL" ]; then
    echo "Checking service status..."
    systemctl status n8n-tunnel --no-pager
    echo ""
    echo "Let me restart the tunnel..."
    systemctl restart n8n-tunnel
    sleep 5
    TUNNEL_URL=$(journalctl -u n8n-tunnel -n 50 --no-pager | grep -o 'https://[^[:space:]]*\.trycloudflare\.com' | head -1)
fi

if [ -n "$TUNNEL_URL" ]; then
    echo ""
    echo "✅ SUCCESS! Your N8N HTTPS URL is:"
    echo ""
    echo "👉 $TUNNEL_URL"
    echo ""
    echo "You can now:"
    echo "1. Open $TUNNEL_URL in your browser"
    echo "2. Import the workflow JSON file"
    echo "3. Configure your Telegram bot"
    echo ""
    
    # Update docker-compose with the URL
    cd ~/darwinbox-services
    if ! grep -q "WEBHOOK_URL" docker-compose.yml; then
        # Add WEBHOOK_URL after N8N_BASIC_AUTH_ACTIVE
        sed -i '/N8N_BASIC_AUTH_ACTIVE=false/a\      - WEBHOOK_URL='$TUNNEL_URL'/' docker-compose.yml
        docker compose up -d n8n
        echo "✅ N8N configuration updated!"
    fi
else
    echo "Let me check the tunnel directly..."
    # Show last few lines of tunnel output
    journalctl -u n8n-tunnel --no-pager -n 20
fi

# Also check if services are running
echo ""
echo "📊 Service Status:"
docker compose ps
EOF