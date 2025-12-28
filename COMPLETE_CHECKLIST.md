# Complete Pre-Deployment Checklist

This checklist covers EVERYTHING you need to do before the Telegram bot is ready to use.

## 📋 Phase 1: Preparation & Setup (1-2 hours)

### ✅ Step 1: Install Dependencies Locally
- [ ] Fix npm permissions (if needed - see INSTALL_INSTRUCTIONS.md)
- [ ] Run `npm install` in project directory
- [ ] Verify installation: Check that `node_modules` folder exists

### ✅ Step 2: Create All Required Accounts

#### 2.1 GitHub Account (Free)
- [ ] Go to github.com and sign up
- [ ] Create a new repository (private recommended)
- [ ] Save repository URL

#### 2.2 Upstash Redis (Free Tier)
- [ ] Go to upstash.com and sign up
- [ ] Create a new Redis database
- [ ] Choose region (closest to your VPS/Vercel)
- [ ] Copy the Redis URL (looks like: `redis://default:xxx@xxx.upstash.io:6379`)
- [ ] **SAVE THIS URL** - you'll need it later

#### 2.3 Telegram Bot
- [ ] Open Telegram app
- [ ] Search for `@BotFather`
- [ ] Send `/newbot` command
- [ ] Follow instructions to create bot:
  - Choose bot name (e.g., "Darwinbox Expense Bot")
  - Choose username (e.g., "darwinbox_expense_bot")
- [ ] Copy the bot token (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
- [ ] **SAVE THIS TOKEN** - you'll need it later

#### 2.4 Claude API Key
- [ ] Go to console.anthropic.com
- [ ] Sign up / Login
- [ ] Navigate to API Keys section
- [ ] Create a new API key
- [ ] Copy the API key
- [ ] **SAVE THIS KEY** - you'll need it later

#### 2.5 Hostinger VPS (or similar)
- [ ] Go to hostinger.com (or your preferred VPS provider)
- [ ] Purchase VPS plan (cheapest is fine, ~$5-10/month)
- [ ] Minimum requirements: 2GB RAM, 1 vCPU
- [ ] Note down:
  - [ ] VPS IP address
  - [ ] SSH username (usually `root`)
  - [ ] SSH password
- [ ] **SAVE THESE CREDENTIALS**

#### 2.6 Vercel Account (Free)
- [ ] Go to vercel.com
- [ ] Sign up with GitHub account (recommended)
- [ ] Account is ready (you'll use it in deployment step)

---

## 📋 Phase 2: VPS Setup (30-45 minutes)

### ✅ Step 3: Connect to VPS

#### 3.1 Connect via SSH
- [ ] **Windows:** Download PuTTY or use Windows Terminal
  - Open PuTTY/Terminal
  - Enter VPS IP address
  - Port: 22
  - Click "Open" / Connect
  - Enter username: `root`
  - Enter password when prompted

- [ ] **Mac/Linux:** Use Terminal
  - Open Terminal
  - Run: `ssh root@YOUR_VPS_IP`
  - Enter password when prompted

- [ ] Verify you're connected (you should see command prompt)

#### 3.2 Install Docker
- [ ] Run these commands one by one:
  ```bash
  sudo apt update && sudo apt upgrade -y
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh get-docker.sh
  sudo usermod -aG docker $USER
  ```
- [ ] Install Docker Compose:
  ```bash
  sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
  ```
- [ ] Verify installation:
  ```bash
  docker --version
  docker-compose --version
  ```
- [ ] Both should show version numbers (if errors, troubleshoot)

#### 3.3 Create Services Directory
- [ ] Run:
  ```bash
  mkdir -p ~/darwinbox-services
  cd ~/darwinbox-services
  ```

#### 3.4 Setup Docker Compose File
- [ ] Create `docker-compose.yml` file:
  ```bash
  nano docker-compose.yml
  ```
- [ ] Copy contents from `docker-compose.yml` in this project
- [ ] **IMPORTANT:** Before saving, replace:
  - `YOUR_SECURE_TOKEN_HERE` → Generate random token (e.g., `mySecureToken123456`)
  - `YOUR_SECURE_PASSWORD_HERE` → Choose strong password for n8n
  - `YOUR_VPS_IP` → Your actual VPS IP address
- [ ] Save file (in nano: `Ctrl+X`, then `Y`, then `Enter`)

#### 3.5 Create .env File (Optional but Recommended)
- [ ] Create `.env` file:
  ```bash
  nano .env
  ```
- [ ] Add these lines (replace with your values):
  ```
  BROWSERLESS_TOKEN=your-random-token-here
  N8N_PASSWORD=your-strong-password-here
  N8N_WEBHOOK_URL=http://YOUR_VPS_IP:5678
  ```
- [ ] Save file

#### 3.6 Start Docker Services
- [ ] Run:
  ```bash
  docker-compose up -d
  ```
- [ ] Wait 2-3 minutes for images to download
- [ ] Check services are running:
  ```bash
  docker-compose ps
  ```
- [ ] Should see both `browserless` and `n8n` with status "Up"

#### 3.7 Verify Services
- [ ] Open browser and go to: `http://YOUR_VPS_IP:5678`
- [ ] Should see n8n login page
- [ ] Login with: `admin` / (your password)
- [ ] ✅ n8n dashboard should load
- [ ] Open: `http://YOUR_VPS_IP:3000`
- [ ] Should see Browserless interface (or connection info)

---

## 📋 Phase 3: Code Deployment (20-30 minutes)

### ✅ Step 4: Push Code to GitHub

#### 4.1 Initialize Git (if not already done)
- [ ] On your local machine (not VPS), open Terminal/Command Prompt
- [ ] Navigate to project directory:
  ```bash
  cd /Users/Pranav_1/darwinbox-reimbursements
  ```
- [ ] Check if git is initialized:
  ```bash
  git status
  ```
- [ ] If error, initialize git:
  ```bash
  git init
  git add .
  git commit -m "Initial commit for Telegram bot"
  ```

#### 4.2 Push to GitHub
- [ ] Add remote (replace with your GitHub repo URL):
  ```bash
  git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
  ```
- [ ] Push code:
  ```bash
  git branch -M main
  git push -u origin main
  ```
- [ ] Verify code is on GitHub (check in browser)

### ✅ Step 5: Deploy to Vercel

#### 5.1 Connect Repository
- [ ] Go to vercel.com
- [ ] Login with GitHub
- [ ] Click "Add New" → "Project"
- [ ] Import your repository
- [ ] Click "Import"

#### 5.2 Configure Environment Variables
- [ ] Before deploying, click "Environment Variables"
- [ ] Add each variable (click "Add" for each):
  
  **Required Variables:**
  - [ ] `CLAUDE_API_KEY` = (your Claude API key)
  - [ ] `REDIS_URL` = (your Upstash Redis URL)
  - [ ] `BROWSERLESS_URL` = `http://YOUR_VPS_IP:3000`
  - [ ] `BROWSERLESS_TOKEN` = (same token you used in docker-compose.yml)
  - [ ] `NEXT_PUBLIC_BASE_URL` = `https://your-app.vercel.app` (you'll update this after first deploy)
  - [ ] `TELEGRAM_BOT_TOKEN` = (your Telegram bot token)

- [ ] Click "Save" after adding all variables

#### 5.3 Deploy
- [ ] Click "Deploy" button
- [ ] Wait for deployment to complete (2-5 minutes)
- [ ] Copy your Vercel URL (e.g., `https://darwinbox-bot-xyz.vercel.app`)
- [ ] **SAVE THIS URL**

#### 5.4 Update NEXT_PUBLIC_BASE_URL
- [ ] Go back to Environment Variables
- [ ] Edit `NEXT_PUBLIC_BASE_URL`
- [ ] Update with your actual Vercel URL
- [ ] Save (will trigger redeploy)

#### 5.5 Verify Deployment
- [ ] Wait for redeploy to complete
- [ ] Visit your Vercel URL in browser
- [ ] Should see your Next.js app (or API endpoints working)
- [ ] Check Vercel logs for any errors

---

## 📋 Phase 4: n8n Configuration (45-60 minutes)

### ✅ Step 6: Setup n8n Credentials

#### 6.1 Access n8n
- [ ] Go to: `http://YOUR_VPS_IP:5678`
- [ ] Login with: `admin` / (your password)

#### 6.2 Create Telegram Credential
- [ ] Click "Settings" (gear icon) → "Credentials"
- [ ] Click "+ Add Credential"
- [ ] Search for "Telegram"
- [ ] Click "Telegram"
- [ ] Fill in:
  - Name: `Telegram Bot`
  - Access Token: (paste your Telegram bot token)
- [ ] Click "Save"

#### 6.3 Add Environment Variable
- [ ] Click "Settings" → "Variables" (or "Environment Variables")
- [ ] Click "Add Variable"
- [ ] Name: `NEXT_PUBLIC_BASE_URL`
- [ ] Value: (your Vercel URL, e.g., `https://your-app.vercel.app`)
- [ ] Click "Save"

### ✅ Step 7: Create n8n Workflows

**See N8N_WORKFLOW_GUIDE.md for detailed workflow setup instructions.**

#### 7.1 Main Invoice Processing Workflow
- [ ] Create new workflow
- [ ] Add Telegram Trigger node (configured with your credential)
- [ ] Add nodes for:
  - [ ] File download from Telegram
  - [ ] OCR API call to `/api/ocr`
  - [ ] Format and send results to user
  - [ ] Handle user confirmation
- [ ] Test workflow with sample invoice

#### 7.2 Login Flow Workflow
- [ ] Create workflow for login process
- [ ] Add nodes for:
  - [ ] Call `/api/telegram/init-login`
  - [ ] Send login URL to user
  - [ ] Poll `/api/login/status` for login completion
  - [ ] Handle login success
- [ ] Test login flow

#### 7.3 Submission Workflow
- [ ] Create workflow for expense submission
- [ ] Add nodes for:
  - [ ] Call `/api/submit` with expense data
  - [ ] Handle submission response
  - [ ] Send success/error notification to user
- [ ] Test submission flow

#### 7.4 Activate Workflows
- [ ] Toggle "Active" switch on all workflows (top right)
- [ ] Workflows should show "Active" status

---

## 📋 Phase 5: Testing & Verification (20-30 minutes)

### ✅ Step 8: Test Complete Flow

#### 8.1 Test Telegram Bot Connection
- [ ] Open Telegram
- [ ] Search for your bot (by username)
- [ ] Send `/start` command
- [ ] Bot should respond

#### 8.2 Test Invoice Upload
- [ ] Send an invoice photo to your bot
- [ ] Check n8n workflow execution (should show in progress)
- [ ] Bot should respond with extracted data
- [ ] Verify OCR data is correct

#### 8.3 Test Login Flow
- [ ] Confirm invoice data (via bot buttons or command)
- [ ] Bot should ask for email
- [ ] Send your email
- [ ] Bot should send login URL
- [ ] Click login URL
- [ ] Login page should open
- [ ] Login to Darwinbox
- [ ] Verify login is detected

#### 8.4 Test Expense Submission
- [ ] After login, bot should proceed with submission
- [ ] Check n8n workflow execution
- [ ] Check Vercel logs for API calls
- [ ] Bot should send success notification
- [ ] Verify expense appears in Darwinbox

#### 8.5 Verify End-to-End
- [ ] Complete full flow: Upload → Confirm → Login → Submit
- [ ] Check all services are working:
  - [ ] n8n workflows executing
  - [ ] Vercel API responding
  - [ ] Redis storing sessions
  - [ ] Browserless handling browsers
  - [ ] Playwright automation working

---

## 📋 Phase 6: Final Configuration (Optional but Recommended)

### ✅ Step 9: Security & Optimization

#### 9.1 Setup Firewall (VPS)
- [ ] Configure firewall to only allow necessary ports:
  ```bash
  sudo ufw allow 22    # SSH
  sudo ufw allow 5678  # n8n
  sudo ufw allow 3000  # Browserless
  sudo ufw enable
  ```

#### 9.2 Setup Domain Name (Optional)
- [ ] Purchase domain (if desired)
- [ ] Point domain to VPS IP
- [ ] Update n8n and Vercel URLs
- [ ] Setup SSL certificate (Let's Encrypt)

#### 9.3 Setup Monitoring
- [ ] Monitor n8n execution logs
- [ ] Monitor Vercel logs
- [ ] Monitor VPS resources (CPU, RAM, disk)
- [ ] Setup alerts (optional)

---

## ✅ Final Verification Checklist

Before declaring everything ready:

- [ ] All services running (Browserless, n8n)
- [ ] Vercel deployment successful
- [ ] All environment variables set correctly
- [ ] n8n workflows created and activated
- [ ] Telegram bot responding
- [ ] OCR working correctly
- [ ] Login flow working
- [ ] Expense submission working
- [ ] End-to-end test successful
- [ ] Error handling in place
- [ ] Logs accessible and being monitored

---

## 🎉 You're Ready!

Once all checkboxes above are complete, your Telegram bot is ready to use!

### Next Steps:
1. Share bot with users
2. Monitor usage and logs
3. Iterate and improve based on feedback
4. Add more features as needed

---

## 📝 Quick Reference: All URLs & Credentials Needed

**Keep this information secure:**

```
VPS IP: YOUR_VPS_IP
VPS SSH: root@YOUR_VPS_IP

Upstash Redis URL: redis://default:xxx@xxx.upstash.io:6379
Telegram Bot Token: 123456789:ABCdef...
Claude API Key: sk-ant-...
Vercel URL: https://your-app.vercel.app
Browserless Token: your-random-token
n8n Password: your-strong-password
```

**Environment Variables in Vercel:**
- CLAUDE_API_KEY
- REDIS_URL
- BROWSERLESS_URL
- BROWSERLESS_TOKEN
- NEXT_PUBLIC_BASE_URL
- TELEGRAM_BOT_TOKEN

---

## 🆘 Need Help?

- Check individual guides:
  - GETTING_STARTED.md - Beginner guide
  - DEPLOYMENT_GUIDE.md - Detailed deployment
  - N8N_WORKFLOW_GUIDE.md - n8n workflows
  - INSTALL_INSTRUCTIONS.md - Local setup
- Check logs in n8n, Vercel, and VPS
- Verify all credentials and URLs are correct

