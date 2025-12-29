#!/bin/bash

# Setup HTTPS for N8N with Nginx and Let's Encrypt
# Run this on your VPS as root

echo "Setting up HTTPS for N8N..."

# Install Nginx and Certbot
apt update
apt install -y nginx certbot python3-certbot-nginx

# Create Nginx configuration for N8N
cat > /etc/nginx/sites-available/n8n << 'EOF'
server {
    server_name n8n.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # WebSocket support
        proxy_set_header Connection '';
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
    }

    listen 80;
}
EOF

# Enable the site
ln -s /etc/nginx/sites-available/n8n /etc/nginx/sites-enabled/

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx

echo "Nginx configured. Now run certbot to get SSL certificate:"
echo "certbot --nginx -d n8n.yourdomain.com"

# Update N8N docker-compose to use webhook URL
echo ""
echo "After SSL is set up, update your docker-compose.yml:"
echo "Add this environment variable to n8n service:"
echo "  WEBHOOK_URL=https://n8n.yourdomain.com/"