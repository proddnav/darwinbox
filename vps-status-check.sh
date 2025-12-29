#!/bin/bash

# VPS Status Checker - Shows what's done and what needs to be done
# Run this to see the current state of your VPS setup

echo "🔍 VPS SETUP STATUS CHECKER"
echo "=========================="
echo ""
echo "This script will check what tasks are already completed on your VPS."
echo ""

# VPS Details
VPS_IP="145.223.18.204"
VPS_USER="root"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ask for VPS password
echo "Please enter your VPS password to check the status:"
read -s VPS_PASSWORD
echo ""

# Function to execute commands on VPS
check_on_vps() {
    sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "$1" 2>/dev/null
}

echo "Connecting to VPS..."
if ! check_on_vps "echo 'Connected'" > /dev/null; then
    echo -e "${RED}❌ Failed to connect to VPS. Please check your password.${NC}"
    echo ""
    echo "If you need to install sshpass first, run:"
    echo "  brew install hudochenkov/sshpass/sshpass"
    exit 1
fi

echo -e "${GREEN}✅ Connected to VPS successfully!${NC}"
echo ""

# Check system update status
echo "1. System Updates:"
LAST_UPDATE=$(check_on_vps "stat -c %y /var/cache/apt/pkgcache.bin 2>/dev/null | cut -d' ' -f1")
if [ -n "$LAST_UPDATE" ]; then
    echo -e "   ${GREEN}✅ Last updated: $LAST_UPDATE${NC}"
else
    echo -e "   ${RED}❌ Never updated${NC}"
fi

# Check Docker
echo ""
echo "2. Docker Installation:"
DOCKER_VERSION=$(check_on_vps "docker --version 2>/dev/null")
if [ -n "$DOCKER_VERSION" ]; then
    echo -e "   ${GREEN}✅ Installed: $DOCKER_VERSION${NC}"
else
    echo -e "   ${RED}❌ Not installed${NC}"
fi

# Check Docker Compose
echo ""
echo "3. Docker Compose Installation:"
COMPOSE_VERSION=$(check_on_vps "docker-compose --version 2>/dev/null")
if [ -n "$COMPOSE_VERSION" ]; then
    echo -e "   ${GREEN}✅ Installed: $COMPOSE_VERSION${NC}"
else
    echo -e "   ${RED}❌ Not installed${NC}"
fi

# Check directory
echo ""
echo "4. Darwinbox Services Directory:"
if check_on_vps "test -d ~/darwinbox-services"; then
    echo -e "   ${GREEN}✅ Directory exists${NC}"
    
    # Check .env file
    echo ""
    echo "5. Environment File (.env):"
    if check_on_vps "test -f ~/darwinbox-services/.env"; then
        echo -e "   ${GREEN}✅ .env file exists${NC}"
        ENV_CONTENT=$(check_on_vps "cat ~/darwinbox-services/.env")
        echo "   Content:"
        echo "$ENV_CONTENT" | sed 's/^/      /'
    else
        echo -e "   ${RED}❌ .env file missing${NC}"
    fi
    
    # Check docker-compose.yml
    echo ""
    echo "6. Docker Compose Configuration:"
    if check_on_vps "test -f ~/darwinbox-services/docker-compose.yml"; then
        echo -e "   ${GREEN}✅ docker-compose.yml exists${NC}"
    else
        echo -e "   ${RED}❌ docker-compose.yml missing${NC}"
    fi
else
    echo -e "   ${RED}❌ Directory doesn't exist${NC}"
fi

# Check running services
echo ""
echo "7. Docker Services Status:"
SERVICES=$(check_on_vps "cd ~/darwinbox-services 2>/dev/null && docker-compose ps --format 'table {{.Name}}\t{{.Status}}' 2>/dev/null")
if [ -n "$SERVICES" ]; then
    echo -e "   ${GREEN}✅ Services found:${NC}"
    echo "$SERVICES" | sed 's/^/      /'
else
    echo -e "   ${RED}❌ No services running${NC}"
fi

# Check firewall
echo ""
echo "8. Firewall Configuration:"
UFW_STATUS=$(check_on_vps "ufw status 2>/dev/null | grep -E 'Status|5678|3000'")
if echo "$UFW_STATUS" | grep -q "Status: active"; then
    echo -e "   ${GREEN}✅ Firewall active${NC}"
    if echo "$UFW_STATUS" | grep -q "5678"; then
        echo -e "   ${GREEN}✅ n8n port (5678) open${NC}"
    else
        echo -e "   ${RED}❌ n8n port (5678) not open${NC}"
    fi
    if echo "$UFW_STATUS" | grep -q "3000"; then
        echo -e "   ${GREEN}✅ Browserless port (3000) open${NC}"
    else
        echo -e "   ${RED}❌ Browserless port (3000) not open${NC}"
    fi
else
    echo -e "   ${RED}❌ Firewall not configured${NC}"
fi

# Test services
echo ""
echo "9. Service Accessibility:"
echo -n "   Testing n8n (http://${VPS_IP}:5678)... "
if curl -s -o /dev/null -w "%{http_code}" "http://${VPS_IP}:5678" | grep -q "200\|401"; then
    echo -e "${GREEN}✅ Accessible${NC}"
else
    echo -e "${RED}❌ Not accessible${NC}"
fi

echo -n "   Testing Browserless (http://${VPS_IP}:3000)... "
if curl -s -o /dev/null -w "%{http_code}" "http://${VPS_IP}:3000" | grep -q "401"; then
    echo -e "${GREEN}✅ Accessible (requires auth)${NC}"
else
    echo -e "${RED}❌ Not accessible${NC}"
fi

echo ""
echo "=========================="
echo "📊 SUMMARY"
echo "=========================="

# Count completed tasks
COMPLETED=0
TOTAL=9

[ -n "$LAST_UPDATE" ] && ((COMPLETED++))
[ -n "$DOCKER_VERSION" ] && ((COMPLETED++))
[ -n "$COMPOSE_VERSION" ] && ((COMPLETED++))
check_on_vps "test -d ~/darwinbox-services" && ((COMPLETED++))
check_on_vps "test -f ~/darwinbox-services/.env" && ((COMPLETED++))
check_on_vps "test -f ~/darwinbox-services/docker-compose.yml" && ((COMPLETED++))
[ -n "$SERVICES" ] && ((COMPLETED++))
echo "$UFW_STATUS" | grep -q "Status: active" && ((COMPLETED++))
curl -s -o /dev/null -w "%{http_code}" "http://${VPS_IP}:5678" | grep -q "200\|401" && ((COMPLETED++))

echo ""
if [ $COMPLETED -eq $TOTAL ]; then
    echo -e "${GREEN}🎉 All tasks completed! ($COMPLETED/$TOTAL)${NC}"
    echo "Your VPS is fully set up and running!"
else
    echo -e "${YELLOW}⚠️  Setup incomplete: $COMPLETED/$TOTAL tasks done${NC}"
    echo ""
    echo "To complete the setup, run:"
    echo "  ./automated-vps-setup.sh"
fi

echo ""