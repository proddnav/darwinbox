# AI-Powered Setup Guide for Darwinbox Reimbursement Bot

This guide helps you set up the complete Darwinbox reimbursement automation system using AI assistance. Follow these steps to deploy your Telegram bot with OCR capabilities, automated browser sessions, and workflow orchestration.

## Prerequisites

- A computer with Node.js installed
- Basic familiarity with terminal/command line
- Credit card for VPS purchase (approximately $5-10/month)
- About 2-3 hours to complete the setup

## Overview

The system consists of:
1. **Telegram Bot** - User interface for submitting expenses
2. **Next.js API** - Handles OCR and automation logic
3. **n8n Workflows** - Orchestrates the entire process
4. **Browserless** - Headless browser for Darwinbox automation
5. **Redis** - Session management
6. **Vercel** - API hosting

## Step-by-Step Setup Process

### Phase 1: Local Setup (15 minutes)

1. **Clone the repository**
   ```bash
   git clone https://github.com/proddnav/darwinbox.git
   cd darwinbox-reimbursements
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Verify installation**
   ```bash
   npm run dev
   ```
   - You should see the development server start
   - Press `Ctrl+C` to stop it

### Phase 2: Create Required Accounts (30 minutes)

You'll need to create accounts for these services:

#### 1. OpenRouter (for AI OCR)
- Visit [openrouter.ai](https://openrouter.ai)
- Sign up and add credits ($5 minimum)
- Go to API Keys section
- Create new API key
- **Save this key**: `OPENROUTER_API_KEY=sk-or-v1-xxx`

#### 2. Upstash Redis (Free)
- Visit [upstash.com](https://upstash.com)
- Sign up for free account
- Create new Redis database
- Choose closest region to your location
- Copy the Redis URL from the dashboard
- **Save this URL**: `REDIS_URL=redis://default:xxx@xxx.upstash.io:6379`

#### 3. Telegram Bot
- Open Telegram app
- Search for `@BotFather`
- Send `/newbot` command
- Choose a name (e.g., "Darwinbox Expense Bot")
- Choose a username (must end with 'bot', e.g., "darwinbox_expense_bot")
- **Save the token**: `TELEGRAM_BOT_TOKEN=123456789:ABCdef...`

#### 4. VPS Provider (Hostinger recommended)
- Visit [hostinger.com](https://www.hostinger.com/vps-hosting)
- Choose KVM 1 plan (or similar with 2GB RAM minimum)
- Complete purchase
- **Save credentials**:
  - IP Address: `145.223.18.204` (example)
  - Username: `root`
  - Password: (set during purchase)

#### 5. GitHub Account
- Visit [github.com](https://github.com)
- Sign up if you don't have an account
- Fork the repository to your account

#### 6. Vercel Account (Free)
- Visit [vercel.com](https://vercel.com)
- Sign up with your GitHub account
- No configuration needed yet

### Phase 3: VPS Setup (45 minutes)

1. **Connect to your VPS**
   
   Windows (using PowerShell):
   ```bash
   ssh root@YOUR_VPS_IP
   ```
   
   Mac/Linux (using Terminal):
   ```bash
   ssh root@YOUR_VPS_IP
   ```

2. **Run the automated setup**
   
   Copy and paste these commands one section at a time:

   **Section 1 - System Update and Docker**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y

   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   rm get-docker.sh

   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

   **Section 2 - Create Configuration**
   ```bash
   # Create directory
   mkdir -p ~/darwinbox-services
   cd ~/darwinbox-services

   # Create environment file
   cat > .env << 'EOF'
   BROWSERLESS_TOKEN=secure_token_abc123xyz789
   N8N_USER=admin
   N8N_PASSWORD=DarwinboxN8n2024!
   N8N_WEBHOOK_URL=http://YOUR_VPS_IP:5678/
   EOF
   ```

   **Section 3 - Docker Compose Setup**
   ```bash
   # Create docker-compose.yml
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

   **Section 4 - Start Services**
   ```bash
   # Start Docker containers
   docker-compose up -d

   # Configure firewall
   sudo apt install -y ufw
   sudo ufw allow 22/tcp
   sudo ufw allow 5678/tcp
   sudo ufw allow 3000/tcp
   sudo ufw --force enable

   # Check services (wait 30 seconds first)
   sleep 30
   docker-compose ps
   ```

3. **Verify services are running**
   - Open browser and visit: `http://YOUR_VPS_IP:5678`
   - You should see n8n login page
   - Login with: `admin` / `DarwinboxN8n2024!`

### Phase 4: Deploy to Vercel (20 minutes)

1. **Push code to GitHub**
   ```bash
   cd /path/to/darwinbox-reimbursements
   git add .
   git commit -m "Initial setup"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your GitHub repository
   - Configure environment variables:

   ```
   OPENROUTER_API_KEY = sk-or-v1-xxx (your key)
   REDIS_URL = redis://default:xxx@xxx.upstash.io:6379 (your URL)
   BROWSERLESS_URL = http://YOUR_VPS_IP:3000
   BROWSERLESS_TOKEN = secure_token_abc123xyz789
   TELEGRAM_BOT_TOKEN = 123456789:ABCdef... (your token)
   NEXT_PUBLIC_BASE_URL = https://your-app.vercel.app
   ```

3. **Click Deploy**
   - Wait for deployment to complete
   - Copy your Vercel URL
   - Go back to Settings → Environment Variables
   - Update `NEXT_PUBLIC_BASE_URL` with actual URL
   - Redeploy

### Phase 5: Configure n8n Workflows (30 minutes)

1. **Access n8n**
   - Open `http://YOUR_VPS_IP:5678`
   - Login with credentials

2. **Create Telegram Credential**
   - Go to Credentials → Add Credential
   - Search "Telegram"
   - Name: `Telegram Bot`
   - Access Token: (your bot token)
   - Save

3. **Add Environment Variable**
   - Go to Settings → Variables
   - Add Variable:
     - Name: `NEXT_PUBLIC_BASE_URL`
     - Value: `https://your-app.vercel.app`

4. **Import Workflows**
   
   Create three workflows:

   **Workflow 1: Invoice Processing**
   - Telegram Trigger (receives files)
   - HTTP Request to `/api/ocr`
   - Send formatted results to user
   - Handle confirmation

   **Workflow 2: Login Flow**
   - HTTP Request to `/api/telegram/init-login`
   - Send login URL to user
   - Poll `/api/login/status`
   - Proceed when logged in

   **Workflow 3: Expense Submission**
   - HTTP Request to `/api/submit`
   - Handle response
   - Notify user of success/failure

5. **Activate all workflows**
   - Toggle the active switch on each workflow

### Phase 6: Testing (15 minutes)

1. **Test Telegram Bot**
   - Open Telegram
   - Search for your bot username
   - Send `/start`
   - Bot should respond

2. **Test Invoice Upload**
   - Send an invoice image to bot
   - Bot should extract data
   - Verify OCR accuracy

3. **Test Login Flow**
   - Confirm invoice data
   - Provide email when asked
   - Click login link
   - Complete Darwinbox login

4. **Verify Submission**
   - Check n8n execution logs
   - Verify expense in Darwinbox
   - Bot should confirm success

## Troubleshooting

### Common Issues

1. **Bot not responding**
   - Check Telegram token is correct
   - Verify n8n workflows are active
   - Check Vercel deployment logs

2. **OCR not working**
   - Verify OpenRouter API key
   - Check API credits balance
   - Review Vercel function logs

3. **Login failing**
   - Ensure Browserless is running
   - Check Redis connection
   - Verify session storage

4. **Services not accessible**
   - Check VPS firewall settings
   - Verify Docker containers running
   - Ensure correct ports are open

### Getting Help

1. **Check logs**
   - n8n: Execution history
   - Vercel: Function logs
   - VPS: `docker-compose logs`

2. **Verify configurations**
   - All environment variables set correctly
   - URLs use correct IP/domain
   - Tokens match between services

3. **Test individual components**
   - Test OCR API directly
   - Verify Redis connection
   - Check Browserless status

## Maintenance

### Regular Tasks

1. **Monitor usage**
   - Check OpenRouter credits
   - Monitor VPS resources
   - Review error logs

2. **Updates**
   - Keep Docker images updated
   - Update dependencies monthly
   - Check for security patches

3. **Backups**
   - Export n8n workflows regularly
   - Backup environment configurations
   - Document any customizations

## Cost Summary

- **VPS**: $5-10/month
- **OpenRouter**: ~$0.001 per OCR request
- **Upstash Redis**: Free tier (10,000 commands/day)
- **Vercel**: Free tier
- **Total**: ~$5-10/month + usage

## Next Steps

1. **Customize workflows** for your specific needs
2. **Add error handling** in n8n workflows
3. **Set up monitoring** alerts
4. **Create user documentation** for your team
5. **Implement additional features** as needed

## Support Resources

- **Documentation**: Check individual `.md` files in the repository
- **n8n Community**: [community.n8n.io](https://community.n8n.io)
- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Telegram Bot API**: [core.telegram.org/bots](https://core.telegram.org/bots)

---

🎉 **Congratulations!** Your AI-powered expense automation system is now ready to use. Share the bot with your team and start saving time on expense submissions!