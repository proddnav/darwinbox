#!/bin/bash

# VPS Docker Commands Helper
# This script helps you run Docker commands on your VPS

VPS_HOST="srv1230742"
VPS_USER="root"

echo "Connecting to VPS and running Docker commands..."

# SSH into VPS and run docker-compose ps
ssh ${VPS_USER}@${VPS_HOST} << 'EOF'
cd ~/darwinbox-services

# Check Docker version
echo "=== Docker Version ==="
docker --version
docker-compose --version

echo -e "\n=== Docker Compose Status ==="
docker-compose ps

echo -e "\n=== Running Containers ==="
docker ps

echo -e "\n=== All Containers (including stopped) ==="
docker ps -a
EOF