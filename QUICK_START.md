# Quick Start Guide - Telegram Bot Setup

This is a simplified guide to get you started quickly. For detailed instructions, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

## Prerequisites Checklist

- [ ] GitHub account
- [ ] Telegram account
- [ ] Hostinger VPS (or similar) - $5-10/month
- [ ] Claude API key from Anthropic
- [ ] Upstash Redis account (free)

---

## 5-Minute Setup (High-Level)

### 1. Setup Redis (2 minutes)

1. Go to [upstash.com](https://upstash.com) → Sign up → Create Redis database
2. Copy the Redis URL (looks like: `redis://default:xxx@xxx.upstash.io:6379`)
3. ✅ Save this URL

### 2. Create Telegram Bot (1 minute)

1. Open Telegram → Search `@BotFather`
2. Send `/newbot` → Follow instructions
3. Copy the bot token (looks like: `123456789:ABCdef...`)
4. ✅ Save this token

### 3. Setup VPS Services (10 minutes)

**On your Hostinger VPS:**

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh

# 2. Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. Create directory
mkdir -p ~/darwinbox-services && cd ~/darwinbox-services

# 4. Create docker-compose.yml (copy from project)
nano docker-compose.yml
# Paste the docker-compose.yml content, update tokens/passwords

# 5. Create .env file
nano .env
# Add:
# BROWSERLESS_TOKEN=your-random-token
# N8N_PASSWORD=your-secure-password
# N8N_WEBHOOK_URL=http://YOUR_VPS_IP:5678

# 6. Start services
docker-compose up -d

# 7. Verify
docker-compose ps
# Should show browserless and n8n running
```

### 4. Deploy to Vercel (5 minutes)

1. **Push code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. **Deploy on Vercel:**
   - Go to [vercel.com](https://vercel.com) → Sign up with GitHub
   - Import your repository
   - Add environment variables (see .env.example)
   - Deploy

3. **Copy your Vercel URL** (e.g., `https://your-app.vercel.app`)

### 5. Configure n8n (15 minutes)

1. **Access n8n:** `http://YOUR_VPS_IP:5678`
2. **Login** with admin/password you set
3. **Create Telegram credential:**
   - Settings → Credentials → Add Credential
   - Search "Telegram" → Create
   - Add your bot token
4. **Create workflow** (see N8N_WORKFLOW_GUIDE.md for details)
5. **Add environment variable:**
   - Settings → Variables
   - Add: `NEXT_PUBLIC_BASE_URL` = your Vercel URL

### 6. Test (2 minutes)

1. Send a photo to your Telegram bot
2. Check n8n workflow execution
3. Verify it processes correctly

---

## Environment Variables Summary

**Vercel Environment Variables:**
```
CLAUDE_API_KEY=your-key
REDIS_URL=your-upstash-url
BROWSERLESS_URL=http://YOUR_VPS_IP:3000
BROWSERLESS_TOKEN=your-token
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
TELEGRAM_BOT_TOKEN=your-bot-token
```

**VPS .env file (for docker-compose):**
```
BROWSERLESS_TOKEN=your-random-token
N8N_PASSWORD=your-secure-password
N8N_WEBHOOK_URL=http://YOUR_VPS_IP:5678
```

---

## Troubleshooting

### Can't access n8n?
```bash
# Check if services are running
docker-compose ps

# Check logs
docker-compose logs n8n

# Restart services
docker-compose restart
```

### Vercel deployment fails?
- Check environment variables are set
- Check build logs in Vercel dashboard
- Ensure all dependencies are in package.json

### Telegram bot not responding?
- Verify bot token is correct
- Check n8n workflow is activated
- Check n8n execution logs

---

## What's Next?

1. Complete n8n workflow setup (see N8N_WORKFLOW_GUIDE.md)
2. Test end-to-end flow
3. Setup domain name (optional)
4. Add SSL certificate (optional)

---

## Need Help?

- Check DEPLOYMENT_GUIDE.md for detailed instructions
- Check N8N_WORKFLOW_GUIDE.md for workflow setup
- Review error logs in n8n and Vercel




