# Simple Setup Guide (Non-Technical Users)

I'll help you set up your Darwinbox expense bot! This will take about 30 minutes.

## What You'll Need
- A web browser
- Your VPS password (for step 2)

## Step 1: Deploy to Vercel (10 minutes)

1. **Open your browser** and go to: https://vercel.com
2. **Sign in** with GitHub (or create account)
3. **Click "Import Project"**
4. **Paste this URL**: `https://github.com/proddnav/darwinbox`
5. **Click "Import"**

### Add Environment Variables (IMPORTANT!)
Before clicking Deploy, add these variables one by one:

| Variable Name | Value (copy exactly) |
|--------------|---------------------|
| OPENROUTER_API_KEY | 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 |
| REDIS_URL | redis://default:AdgrAAIncDEwMWE2YmU1NDc1NzA0YWU0YmQxMWIzZDVhYTc3ZGJmOXAxNTUzMzk@advanced-honeybee-55339.upstash.io:6379 |
| BROWSERLESS_URL | http://145.223.18.204:3000 |
| BROWSERLESS_TOKEN | secure_token_abc123xyz789 |
| TELEGRAM_BOT_TOKEN | 8124495283:AAE-3zkAn3iaElPys6TvsC2y587G7vyPd4g |
| NEXT_PUBLIC_BASE_URL | https://your-app.vercel.app |

6. **Click "Deploy"** and wait 2-3 minutes
7. **Copy your URL** (looks like: https://something.vercel.app)
8. **Update NEXT_PUBLIC_BASE_URL**:
   - Go to Settings → Environment Variables
   - Edit NEXT_PUBLIC_BASE_URL
   - Replace with your actual URL
   - Save (will redeploy automatically)

## Step 2: Set Up Your VPS (15 minutes)

### Connect to VPS
1. **Windows**: Open PowerShell
2. **Mac**: Open Terminal
3. Type: `ssh root@145.223.18.204`
4. Enter your password when asked

### Run Setup Commands
Copy and paste these blocks ONE AT A TIME:

**Block 1** - System Update (2 minutes):
```bash
sudo apt update && sudo apt upgrade -y
```

**Block 2** - Install Docker (3 minutes):
```bash
curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh && rm get-docker.sh
```

**Block 3** - Install Docker Compose:
```bash
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose
```

**Block 4** - Create Services:
```bash
mkdir -p ~/darwinbox-services && cd ~/darwinbox-services
```

**Block 5** - Create Configuration:
```bash
cat > .env << 'EOF'
BROWSERLESS_TOKEN=secure_token_abc123xyz789
N8N_USER=admin
N8N_PASSWORD=DarwinboxN8n2024!
N8N_WEBHOOK_URL=http://145.223.18.204:5678/
EOF
```

**Block 6** - Create Docker File:
```bash
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
```

**Block 7** - Start Services (5 minutes):
```bash
docker-compose up -d && sleep 30 && docker-compose ps
```

**Block 8** - Setup Firewall:
```bash
sudo apt install -y ufw && sudo ufw allow 22/tcp && sudo ufw allow 5678/tcp && sudo ufw allow 3000/tcp && sudo ufw --force enable
```

You should see both services as "Up" in the output!

## Step 3: Configure n8n (5 minutes)

1. **Open browser** to: http://145.223.18.204:5678
2. **Login**:
   - Username: `admin`
   - Password: `DarwinboxN8n2024!`

3. **Add Telegram Credential**:
   - Click Settings (⚙️) → Credentials
   - Click "Add Credential"
   - Search "Telegram"
   - Name: `Telegram Bot`
   - Access Token: `8124495283:AAE-3zkAn3iaElPys6TvsC2y587G7vyPd4g`
   - Click "Save"

4. **Add Variable**:
   - Click Settings → Variables
   - Click "Add Variable"
   - Name: `NEXT_PUBLIC_BASE_URL`
   - Value: Your Vercel URL (from Step 1)
   - Click "Save"

5. **Import Workflows**:
   - I'll create these for you in the next step!

## Step 4: Test Your Bot

1. **Open Telegram**
2. **Search** for your bot
3. **Send** `/start`
4. **Send** an invoice photo

## ✅ You're Done!

Your bot is now ready to:
- Receive invoice photos
- Extract data automatically
- Log into Darwinbox
- Submit expenses

## Need Help?

If something isn't working:
1. Check that all services show "Up" on your VPS
2. Make sure you updated NEXT_PUBLIC_BASE_URL in Vercel
3. Verify n8n is accessible at http://145.223.18.204:5678

## Quick Reference

- **n8n**: http://145.223.18.204:5678 (admin/DarwinboxN8n2024!)
- **Your API**: Your Vercel URL
- **VPS**: 145.223.18.204