# Complete Deployment Guide - Telegram Bot + n8n + Darwinbox Automation

This guide will help you set up everything from scratch, even if you have zero knowledge. Follow each step carefully.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Setup Upstash Redis (Free)](#step-1-setup-upstash-redis-free)
3. [Step 2: Create Telegram Bot](#step-2-create-telegram-bot)
4. [Step 3: Setup Hostinger VPS](#step-3-setup-hostinger-vps)
5. [Step 4: Deploy Browserless & n8n](#step-4-deploy-browserless--n8n)
6. [Step 5: Deploy Next.js API to Vercel](#step-5-deploy-nextjs-api-to-vercel)
7. [Step 6: Setup n8n Workflows](#step-6-setup-n8n-workflows)
8. [Step 7: Test Everything](#step-7-test-everything)

---

## Prerequisites

Before starting, you need:
- A GitHub account (free)
- A Telegram account
- A Hostinger VPS (starting at ~$5/month) or use Vercel + Hostinger hybrid
- A domain name (optional, but recommended)

---

## Step 1: Setup Upstash Redis (Free)

Redis stores session data (user login sessions, tokens, etc.)

1. **Go to [upstash.com](https://upstash.com)**
2. **Sign up** (free account)
3. **Create a new Redis database:**
   - Click "Create Database"
   - Choose a region close to your VPS/Vercel
   - Click "Create"
4. **Copy the Redis URL:**
   - You'll see something like: `redis://default:xxxxx@xxxxx.upstash.io:6379`
   - **Save this** - you'll need it later

---

## Step 2: Create Telegram Bot

1. **Open Telegram** and search for `@BotFather`
2. **Start a chat** with BotFather
3. **Create a new bot:**
   - Send: `/newbot`
   - Choose a name for your bot (e.g., "Darwinbox Expense Bot")
   - Choose a username (e.g., "darwinbox_expense_bot")
4. **Copy the Bot Token:**
   - BotFather will give you a token like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
   - **Save this** - you'll need it for n8n

---

## Step 3: Setup Hostinger VPS

### 3.1 Purchase VPS

1. Go to [hostinger.com](https://www.hostinger.com)
2. Choose a VPS plan (at least 2GB RAM, 1 vCPU)
3. Complete purchase

### 3.2 Connect to Your VPS

You'll receive SSH credentials. Connect using:

**Windows:**
- Download [PuTTY](https://www.putty.org/)
- Enter your VPS IP address
- Port: 22
- Click "Open"
- Login with username and password

**Mac/Linux:**
```bash
ssh root@YOUR_VPS_IP
# Enter password when prompted
```

### 3.3 Install Docker & Docker Compose

Once connected to your VPS, run these commands:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (replace 'root' with your username if different)
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version

# Log out and log back in for group changes to take effect
exit
```

Reconnect to your VPS after logging out.

### 3.4 Create Directory for Docker Services

```bash
mkdir -p ~/darwinbox-services
cd ~/darwinbox-services
```

---

## Step 4: Deploy Browserless & n8n

### 4.1 Create Docker Compose File

Create a file called `docker-compose.yml` in `~/darwinbox-services`:

```bash
nano docker-compose.yml
```

Paste this content (replace `YOUR_SECURE_TOKEN` with a random string):

```yaml
version: '3.8'

services:
  browserless:
    image: browserless/chrome:latest
    ports:
      - "3000:3000"
    environment:
      - CONNECTION_TIMEOUT=60000
      - MAX_CONCURRENT_SESSIONS=10
      - TOKEN=YOUR_SECURE_TOKEN_HERE
      - KEEP_ALIVE=true
    restart: unless-stopped
    shm_size: '2gb'

  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=YOUR_SECURE_PASSWORD_HERE
      - N8N_HOST=0.0.0.0
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://YOUR_VPS_IP:5678/
    volumes:
      - n8n_data:/home/node/.n8n
    restart: unless-stopped

volumes:
  n8n_data:
```

**To save in nano:** Press `Ctrl+X`, then `Y`, then `Enter`

**Important:** Replace:
- `YOUR_SECURE_TOKEN_HERE` with a random string (e.g., `abc123xyz456`)
- `YOUR_SECURE_PASSWORD_HERE` with a strong password for n8n
- `YOUR_VPS_IP` with your actual VPS IP address

### 4.2 Start Services

```bash
cd ~/darwinbox-services
docker-compose up -d
```

This will download and start both Browserless and n8n. It may take a few minutes.

### 4.3 Verify Services are Running

```bash
docker-compose ps
```

You should see both services with status "Up".

### 4.4 Access n8n

Open your browser and go to: `http://YOUR_VPS_IP:5678`

Login with:
- Username: `admin`
- Password: (the password you set)

---

## Step 5: Deploy Next.js API to Vercel

### 5.1 Push Code to GitHub

1. **Create a new repository on GitHub:**
   - Go to [github.com](https://github.com)
   - Click "New repository"
   - Name it (e.g., "darwinbox-bot")
   - Make it private (recommended)
   - Click "Create repository"

2. **Push your code:**
   ```bash
   # On your local machine (in your project directory)
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

   Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual values.

### 5.2 Deploy to Vercel

1. **Go to [vercel.com](https://vercel.com)**
2. **Sign up** with your GitHub account
3. **Import your repository:**
   - Click "Add New" → "Project"
   - Select your repository
   - Click "Import"

4. **Configure Environment Variables:**
   Before deploying, add these environment variables in Vercel:

   Click "Environment Variables" and add:

   ```
   CLAUDE_API_KEY=your-claude-api-key
   REDIS_URL=your-upstash-redis-url
   BROWSERLESS_URL=http://YOUR_VPS_IP:3000
   BROWSERLESS_TOKEN=YOUR_SECURE_TOKEN_HERE
   N8N_WEBHOOK_URL=http://YOUR_VPS_IP:5678
   NEXT_PUBLIC_BASE_URL=https://your-vercel-url.vercel.app
   TELEGRAM_BOT_TOKEN=your-telegram-bot-token
   ```

   Replace:
   - `your-claude-api-key` - Your Claude API key from Anthropic
   - `your-upstash-redis-url` - The Redis URL from Step 1
   - `YOUR_VPS_IP` - Your VPS IP address
   - `YOUR_SECURE_TOKEN_HERE` - Same token you used in docker-compose.yml
   - `your-vercel-url.vercel.app` - Your Vercel deployment URL (you'll get this after first deploy)
   - `your-telegram-bot-token` - The token from Step 2

5. **Deploy:**
   - Click "Deploy"
   - Wait for deployment to complete
   - Copy your deployment URL (e.g., `https://darwinbox-bot.vercel.app`)

6. **Update NEXT_PUBLIC_BASE_URL:**
   - Go back to Environment Variables
   - Update `NEXT_PUBLIC_BASE_URL` with your actual Vercel URL
   - Redeploy (or it will auto-redeploy)

---

## Step 6: Setup n8n Workflows

Now we'll create the n8n workflows for the Telegram bot.

### 6.1 Create Telegram Bot Workflow

1. **In n8n (http://YOUR_VPS_IP:5678), click "Add Workflow"**

2. **Add Telegram Trigger Node:**
   - Click "+" to add node
   - Search for "Telegram Trigger"
   - Select it
   - Click "Create Credential"
   - Name: "Telegram Bot"
   - Access Token: (your Telegram bot token)
   - Save credentials
   - In the node, select "Message" as the update type

3. **Add Function Node (Format Message):**
   - Add a new node
   - Search for "Code"
   - Add this code to check if message has a photo/document:

   ```javascript
   const message = $input.item.json.message;
   
   if (message.photo || message.document) {
     return {
       json: {
         hasFile: true,
         chatId: message.chat.id,
         messageId: message.message_id,
         fileId: message.photo ? message.photo[message.photo.length - 1].file_id : message.document.file_id,
       }
     };
   }
   
   return {
     json: {
       hasFile: false,
       chatId: message.chat.id,
       text: message.text,
     }
   };
   ```

4. **Add IF Node (Check if file):**
   - Add IF node
   - Condition: `{{ $json.hasFile }}` equals `true`
   - True branch: Continue to OCR
   - False branch: Handle text commands

5. **Add HTTP Request Node (OCR):**
   - Add HTTP Request node
   - Method: POST
   - URL: `https://your-vercel-url.vercel.app/api/ocr`
   - Authentication: None
   - Body Content Type: Form-Data
   - Add parameter:
     - Name: `file`
     - Value: `{{ $json.fileId }}`
     - Type: File

   **Wait** - We need to download the file from Telegram first!

6. **Add Telegram Node (Get File):**
   - Before the OCR node, add a Telegram node
   - Operation: Get File
   - File ID: `{{ $json.fileId }}`

7. **Continue with OCR node** (as above)

8. **Add Telegram Node (Send Results):**
   - Add Telegram node
   - Operation: Send Message
   - Chat ID: `{{ $json.chatId }}`
   - Text: Format the OCR results nicely

This is a simplified workflow. The complete workflow will be more complex. Let me create a detailed n8n workflow guide in the next file.

---

## Step 7: Test Everything

1. **Test Redis Connection:**
   - Your Next.js API should connect automatically
   - Check Vercel logs for "✓ Connected to Redis"

2. **Test Browserless:**
   - Open: `http://YOUR_VPS_IP:3000`
   - You should see Browserless interface

3. **Test n8n:**
   - Open: `http://YOUR_VPS_IP:5678`
   - Login and create a test workflow

4. **Test Telegram Bot:**
   - Send a message to your bot
   - Check n8n workflow execution

---

## Troubleshooting

### Services won't start:
```bash
# Check logs
docker-compose logs

# Restart services
docker-compose restart
```

### Can't access n8n:
- Check firewall: `sudo ufw allow 5678`
- Verify service is running: `docker-compose ps`

### Redis connection fails:
- Verify REDIS_URL in Vercel environment variables
- Check Upstash dashboard for connection status

---

## Next Steps

After completing this guide, you'll need to:
1. Complete the n8n workflow setup (detailed guide coming)
2. Test the complete flow end-to-end
3. Setup domain name and SSL (optional but recommended)

---

## Security Notes

- Keep your tokens and passwords secure
- Use strong passwords for n8n
- Consider setting up a firewall on your VPS
- Use environment variables, never hardcode secrets
- Regularly update Docker images: `docker-compose pull && docker-compose up -d`




