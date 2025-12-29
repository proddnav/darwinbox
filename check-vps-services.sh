#!/bin/bash

# Check VPS Services - No password needed, just checks from outside

echo "🔍 CHECKING VPS SERVICES"
echo "======================="
echo ""

VPS_IP="145.223.18.204"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Checking services from outside (no VPS login needed)..."
echo ""

# Check n8n
echo "1. Checking n8n service..."
echo -n "   Testing http://${VPS_IP}:5678... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${VPS_IP}:5678" --max-time 5)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ n8n is running!${NC}"
    echo "   URL: http://${VPS_IP}:5678"
    echo "   Username: admin"
    echo "   Password: DarwinboxN8n2024!"
else
    echo -e "${RED}❌ n8n is not accessible (HTTP $HTTP_CODE)${NC}"
    echo "   This means either:"
    echo "   - Services are still starting (wait 2-3 minutes)"
    echo "   - Setup hasn't been completed yet"
    echo "   - Firewall is blocking the port"
fi

echo ""
echo "2. Checking Browserless service..."
echo -n "   Testing http://${VPS_IP}:3000... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${VPS_IP}:3000" --max-time 5)
if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Browserless is running!${NC}"
    echo "   URL: http://${VPS_IP}:3000"
    echo "   Token: a87e6dde8187d824a09ffa508aa9f72bebc05971e1613008452ed3d877ad6d5c"
elif [ "$HTTP_CODE" = "200" ]; then
    echo -e "${YELLOW}⚠️  Browserless is running but authentication might be disabled${NC}"
else
    echo -e "${RED}❌ Browserless is not accessible (HTTP $HTTP_CODE)${NC}"
    echo "   This means either:"
    echo "   - Services are still starting (wait 2-3 minutes)"
    echo "   - Setup hasn't been completed yet"
    echo "   - Firewall is blocking the port"
fi

echo ""
echo "3. Checking SSH access..."
echo -n "   Testing SSH port 22... "
nc -z -w2 ${VPS_IP} 22 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ SSH is accessible${NC}"
else
    echo -e "${RED}❌ SSH is not accessible${NC}"
fi

echo ""
echo "======================="
echo "WHAT TO DO NEXT:"
echo "======================="
echo ""

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}🎉 Your services are running!${NC}"
    echo ""
    echo "You can now:"
    echo "1. Open http://${VPS_IP}:5678 in your browser"
    echo "2. Login with admin / DarwinboxN8n2024!"
    echo "3. Set up your n8n workflows"
else
    echo -e "${YELLOW}⚠️  Services are not accessible yet${NC}"
    echo ""
    echo "To complete the setup:"
    echo "1. Run: ssh root@${VPS_IP}"
    echo "2. Copy and paste all commands from vps-commands.sh"
    echo "3. Wait 2-3 minutes for services to start"
    echo "4. Run this script again to check"
    echo ""
    echo "OR use the simple setup guide:"
    echo "./vps-setup-simple.sh"
fi

echo ""