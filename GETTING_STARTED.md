# Getting Started - Complete Beginner Guide

Welcome! This guide will help you build your Telegram bot step-by-step, even if you've never done this before.

## 🎯 What You're Building

A Telegram bot where users can:
1. Upload invoice photos
2. See extracted data (date, amount, merchant, etc.)
3. Confirm the data
4. Login to Darwinbox via a secure link
5. Automatically submit their expense to Darwinbox
6. Get notified when done

## 📦 What's Already Built

We've prepared the code for you! Here's what's ready:

✅ **API Endpoints** - For OCR, login, and submission
✅ **Redis Session Management** - Stores user sessions securely
✅ **Login Web Interface** - Where users log in to Darwinbox
✅ **Docker Configuration** - For running services on your VPS
✅ **Documentation** - Complete guides for everything

## 🚀 What You Need to Do

Follow these steps in order:

### Step 1: Get Your Accounts Ready (30 minutes)

1. **GitHub Account**
   - Go to github.com → Sign up
   - Free account is fine

2. **Upstash Redis** (Free)
   - Go to upstash.com → Sign up
   - Create a Redis database
   - Copy the connection URL
   - 📝 **Save this URL** - you'll need it later

3. **Telegram Bot**
   - Open Telegram → Search `@BotFather`
   - Send `/newbot` → Follow instructions
   - Copy the bot token (looks like: `123456789:ABCdef...`)
   - 📝 **Save this token**

4. **Claude API Key**
   - Go to console.anthropic.com
   - Create account → Get API key
   - 📝 **Save this key**

5. **Hostinger VPS**
   - Go to hostinger.com → Buy VPS (cheapest plan is fine, ~$5/month)
   - You'll get: IP address, username, password
   - 📝 **Save these details**

### Step 2: Setup Your VPS (20 minutes)

Your VPS is like a computer in the cloud where we'll run services.

1. **Connect to your VPS:**
   - **Windows:** Download PuTTY, enter your VPS IP, connect
   - **Mac/Linux:** Open Terminal, type: `ssh root@YOUR_VPS_IP`
   - Enter your password when asked

2. **Install Docker:**
   Copy and paste these commands one by one:

   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   
   # Verify it worked
   docker --version
   docker-compose --version
   ```

   You should see version numbers. If you see errors, ask for help!

3. **Create folder for services:**
   ```bash
   mkdir -p ~/darwinbox-services
   cd ~/darwinbox-services
   ```

4. **Create docker-compose.yml file:**
   ```bash
   nano docker-compose.yml
   ```
   
   Copy the entire contents of `docker-compose.yml` from this project into the editor.
   
   **Important:** Before saving, replace:
   - `YOUR_SECURE_TOKEN_HERE` with a random string (e.g., `mySecretToken123`)
   - `YOUR_SECURE_PASSWORD_HERE` with a strong password for n8n
   - `YOUR_VPS_IP` with your actual VPS IP address
   
   To save in nano: Press `Ctrl+X`, then `Y`, then `Enter`

5. **Start the services:**
   ```bash
   docker-compose up -d
   ```
   
   This downloads and starts Browserless and n8n. Wait 2-3 minutes.

6. **Check if it worked:**
   ```bash
   docker-compose ps
   ```
   
   You should see both services running. If not, check: `docker-compose logs`

7. **Access n8n:**
   - Open browser → Go to: `http://YOUR_VPS_IP:5678`
   - Login with: `admin` / (your password)
   - 🎉 You should see n8n dashboard!

### Step 3: Push Code to GitHub (10 minutes)

1. **On your computer** (not VPS), open Terminal/Command Prompt

2. **Navigate to your project folder:**
   ```bash
   cd /path/to/darwinbox-reimbursements
   ```

3. **Initialize git and push:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
   
   Replace `YOUR_USERNAME` and `YOUR_REPO` with your GitHub details.

### Step 4: Deploy to Vercel (15 minutes)

1. **Go to vercel.com** → Sign up with GitHub

2. **Import your repository:**
   - Click "Add New" → "Project"
   - Select your repository
   - Click "Import"

3. **Add Environment Variables:**
   Before clicking "Deploy", click "Environment Variables" and add these:

   ```
   CLAUDE_API_KEY = (your Claude API key)
   REDIS_URL = (your Upstash Redis URL)
   BROWSERLESS_URL = http://YOUR_VPS_IP:3000
   BROWSERLESS_TOKEN = (the token you set in docker-compose.yml)
   NEXT_PUBLIC_BASE_URL = https://your-app.vercel.app
   TELEGRAM_BOT_TOKEN = (your Telegram bot token)
   ```
   
   **Note:** `NEXT_PUBLIC_BASE_URL` will be your Vercel URL - you'll get it after first deploy, then update this variable.

4. **Deploy:**
   - Click "Deploy"
   - Wait for it to finish
   - Copy your Vercel URL (e.g., `https://darwinbox-bot.vercel.app`)

5. **Update NEXT_PUBLIC_BASE_URL:**
   - Go back to Environment Variables
   - Update `NEXT_PUBLIC_BASE_URL` with your actual Vercel URL
   - It will auto-redeploy

### Step 5: Setup n8n Workflows (45 minutes)

This is the most complex part, but we'll do it step-by-step.

**See [N8N_WORKFLOW_GUIDE.md](./N8N_WORKFLOW_GUIDE.md) for detailed instructions.**

**Quick overview:**
1. In n8n (http://YOUR_VPS_IP:5678), create Telegram credential
2. Create workflow to handle Telegram messages
3. Add nodes for: receiving files → OCR → confirmation → login → submission

### Step 6: Test Everything (10 minutes)

1. **Send a test message** to your Telegram bot
2. **Check n8n** - you should see the workflow executing
3. **Check Vercel logs** - look for any errors
4. **Try the full flow:**
   - Upload invoice
   - Confirm data
   - Login
   - Submit expense

## 🆘 Common Problems & Solutions

### "I can't connect to my VPS"
- Check you're using the correct IP address
- Check your VPS is running (login to Hostinger dashboard)
- Try using PuTTY on Windows, or Terminal on Mac

### "Docker commands don't work"
- Make sure you're connected to VPS (not your local computer)
- Try: `sudo docker` instead of `docker`
- Check Docker is installed: `docker --version`

### "n8n won't load"
- Check if service is running: `docker-compose ps`
- Check logs: `docker-compose logs n8n`
- Make sure port 5678 is open in your VPS firewall

### "Vercel deployment fails"
- Check all environment variables are set
- Check build logs in Vercel
- Make sure your code is pushed to GitHub

### "Telegram bot doesn't respond"
- Check bot token is correct
- Check n8n workflow is activated (toggle in top right)
- Check n8n execution logs

## 📚 Where to Get Help

1. **Check the detailed guides:**
   - [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Complete deployment instructions
   - [N8N_WORKFLOW_GUIDE.md](./N8N_WORKFLOW_GUIDE.md) - n8n workflow setup
   - [QUICK_START.md](./QUICK_START.md) - Quick reference

2. **Check logs:**
   - n8n: Execution logs in n8n dashboard
   - Vercel: Logs in Vercel dashboard
   - VPS: `docker-compose logs`

3. **Common mistakes:**
   - Forgot to add environment variables
   - Wrong URLs or IPs in configuration
   - Services not started (docker-compose up -d)
   - Workflow not activated in n8n

## ✅ Checklist

Use this to track your progress:

- [ ] Created all accounts (GitHub, Upstash, Telegram, Hostinger, Claude)
- [ ] Connected to VPS
- [ ] Installed Docker
- [ ] Started Browserless and n8n services
- [ ] Can access n8n dashboard
- [ ] Pushed code to GitHub
- [ ] Deployed to Vercel
- [ ] Added all environment variables
- [ ] Created Telegram credential in n8n
- [ ] Created n8n workflows
- [ ] Tested complete flow

## 🎉 Next Steps

Once everything is working:

1. **Test with real invoices**
2. **Share your bot** with users
3. **Monitor usage** - check logs regularly
4. **Improve workflows** - add error handling, retries
5. **Setup domain name** (optional) - easier URLs
6. **Add SSL certificate** (optional) - secure your services

## 💡 Tips for Beginners

- **Take your time** - Don't rush, follow steps carefully
- **Save everything** - Keep a document with all your passwords/tokens
- **Test frequently** - Test after each major step
- **Read error messages** - They usually tell you what's wrong
- **Ask for help** - If stuck, check logs and error messages first

Good luck! 🚀




