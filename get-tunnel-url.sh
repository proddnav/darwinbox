#!/bin/bash

echo "🔍 Getting your N8N HTTPS URL..."

ssh root@145.223.18.204 << 'EOF'
# Get the tunnel URL from the service logs
echo "Checking tunnel status..."
sleep 3

# Method 1: From systemctl status
TUNNEL_URL=$(systemctl status n8n-tunnel --no-pager -n 20 | grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' | head -1)

# Method 2: From journal if method 1 didn't work
if [ -z "$TUNNEL_URL" ]; then
    TUNNEL_URL=$(journalctl -u n8n-tunnel --no-pager -n 100 | grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' | head -1)
fi

# Method 3: Check running cloudflared processes
if [ -z "$TUNNEL_URL" ]; then
    echo "Checking cloudflared output..."
    timeout 5 cloudflared tunnel --url http://localhost:5678 2>&1 | grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' | head -1 > /tmp/test-url.txt &
    sleep 4
    TUNNEL_URL=$(cat /tmp/test-url.txt 2>/dev/null)
fi

if [ -n "$TUNNEL_URL" ]; then
    echo ""
    echo "✅ Found your HTTPS URL!"
    echo "📌 N8N HTTPS URL: $TUNNEL_URL"
    echo ""
    echo "Now updating N8N configuration..."
    
    # Fix the docker-compose.yml
    cd ~/darwinbox-services
    
    # First, check if WEBHOOK_URL already exists
    if grep -q "WEBHOOK_URL" docker-compose.yml; then
        echo "Updating existing WEBHOOK_URL..."
        sed -i "s|WEBHOOK_URL=.*|WEBHOOK_URL=$TUNNEL_URL|g" docker-compose.yml
    else
        echo "Adding WEBHOOK_URL to n8n service..."
        # Add WEBHOOK_URL to n8n environment
        awk '/services:/{p=1} p && /n8n:/{n=1} n && /environment:/{e=1; print; next} e && /^[[:space:]]*-/{print "      - WEBHOOK_URL='$TUNNEL_URL'"; e=0} 1' docker-compose.yml > docker-compose.yml.tmp
        mv docker-compose.yml.tmp docker-compose.yml
    fi
    
    # Start services
    echo "Starting services..."
    docker compose up -d
    
    echo ""
    echo "✅ All done!"
    echo ""
    echo "🎉 Your N8N is now available at:"
    echo "👉 $TUNNEL_URL"
    echo ""
    echo "📱 This URL will work with Telegram webhooks!"
else
    echo "❌ Could not get tunnel URL. Let's check the service logs:"
    journalctl -u n8n-tunnel --no-pager -n 50
fi
EOF