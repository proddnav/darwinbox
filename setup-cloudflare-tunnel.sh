#!/bin/bash

# Setup Cloudflare Tunnel for N8N
# This provides HTTPS without needing a domain or SSL certificate

echo "Setting up Cloudflare Tunnel for N8N..."

# Download and install cloudflared
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared-linux-amd64.deb

# Create tunnel for N8N
echo "Creating tunnel for N8N on port 5678..."
cloudflared tunnel --url http://localhost:5678

# The tunnel will output a URL like: https://xxxxx.trycloudflare.com
# Use this URL as your N8N webhook URL