#!/bin/bash

echo "🚀 Setting up HTTPS for your N8N automatically..."

# SSH into VPS and set up Cloudflare tunnel
ssh root@145.223.18.204 << 'EOF'
cd ~/darwinbox-services

# Install cloudflared
echo "📦 Installing Cloudflare tunnel..."
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared-linux-amd64.deb >/dev/null 2>&1
rm cloudflared-linux-amd64.deb

# Create a service to run the tunnel permanently
echo "⚙️ Creating tunnel service..."
cat > /etc/systemd/system/n8n-tunnel.service << 'SERVICE'
[Unit]
Description=Cloudflare Tunnel for N8N
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root
ExecStart=/usr/bin/cloudflared tunnel --url http://localhost:5678 --no-autoupdate
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE

# Enable and start the service
systemctl daemon-reload
systemctl enable n8n-tunnel
systemctl start n8n-tunnel

echo "⏳ Waiting for tunnel to start..."
sleep 5

# Get the tunnel URL
echo "🔍 Getting your HTTPS URL..."
systemctl status n8n-tunnel --no-pager | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1 > /tmp/tunnel-url.txt
TUNNEL_URL=$(cat /tmp/tunnel-url.txt)

if [ -z "$TUNNEL_URL" ]; then
    # Try alternative method
    journalctl -u n8n-tunnel -n 50 | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1 > /tmp/tunnel-url.txt
    TUNNEL_URL=$(cat /tmp/tunnel-url.txt)
fi

echo ""
echo "✅ HTTPS tunnel is running!"
echo "📌 Your N8N HTTPS URL is: $TUNNEL_URL"
echo ""
echo "🔄 Updating N8N configuration..."

# Update docker-compose with webhook URL
cp docker-compose.yml docker-compose.yml.backup
sed -i "/n8n:/,/^[^ ]/{/environment:/a\\      - WEBHOOK_URL=$TUNNEL_URL/" docker-compose.yml

# Restart N8N with new configuration
echo "🔄 Restarting N8N..."
docker compose down
docker compose up -d

echo ""
echo "✅ All done! Your N8N is now accessible via HTTPS at:"
echo "👉 $TUNNEL_URL"
echo ""
echo "📝 Next steps:"
echo "1. Go to $TUNNEL_URL"
echo "2. Import your workflow"
echo "3. The Telegram webhook will work now!"

EOF