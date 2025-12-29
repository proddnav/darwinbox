# 🚀 TELEGRAM BOT LAUNCH CHECKLIST - TODAY

## 📋 Pre-Launch Status Check

### ✅ What's Already Working:
- ✅ Complete codebase with all endpoints
- ✅ OCR processing with Claude Vision API  
- ✅ Login flow with token generation
- ✅ Playwright automation (cloud-ready via Browserless)
- ✅ Session management with Redis
- ✅ n8n workflow integration design

### ❌ What's Missing:
1. **API Key Update**: Code uses Claude API instead of OpenRouter
2. **Environment Variables**: Missing critical configs
3. **VPS Not Setup**: No running services yet
4. **Vercel Not Deployed**: API not accessible
5. **Telegram Webhook**: Not connected
6. **n8n Workflows**: Not created/imported

---

## 🔧 STEP-BY-STEP LAUNCH GUIDE

### STEP 1: Fix API Integration (5 min)
Update the code to use OpenRouter instead of Claude API:

```bash
# In your local machine
cd /Users/Pranav_1/darwinbox-reimbursements

# Update claude-ocr.ts to use OpenRouter
# The file currently uses CLAUDE_API_KEY
```

**Files to update:**
- `lib/claude-ocr.ts` - Change API endpoint and headers
- `.env` - Add `OPENROUTER_API_KEY`

### STEP 2: Prepare Environment Variables (10 min)

Create a complete `.env` file with ALL required variables:

```env
# API Keys
OPENROUTER_API_KEY=sk-or-v1-xxxxx
REDIS_URL=redis://default:xxxxx@xxxxx.upstash.io:6379
TELEGRAM_BOT_TOKEN=123456789:ABCdef...

# VPS Services  
BROWSERLESS_URL=http://YOUR_VPS_IP:3000
BROWSERLESS_TOKEN=secure_token_here
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app

# Additional
NODE_ENV=production
```

### STEP 3: Setup VPS (30 min)

1. **SSH into VPS:**
```bash
ssh root@YOUR_VPS_IP
```

2. **Run automated setup:**
```bash
# Download and run setup script
curl -o setup.sh https://raw.githubusercontent.com/your-repo/main/vps-setup.sh
chmod +x setup.sh
./setup.sh
```

3. **Configure services:**
```bash
cd ~/darwinbox-services

# Edit environment file
nano .env

# Add these values:
BROWSERLESS_TOKEN=generate_secure_token_here
N8N_PASSWORD=StrongPassword123!
N8N_WEBHOOK_URL=http://YOUR_VPS_IP:5678/

# Start services
docker-compose up -d

# Verify services running
docker-compose ps
```

### STEP 4: Deploy to Vercel (15 min)

1. **Push code changes:**
```bash
git add .
git commit -m "Update to use OpenRouter API"
git push origin main
```

2. **Deploy on Vercel:**
- Go to [vercel.com](https://vercel.com)
- Import your GitHub repository
- Add ALL environment variables from Step 2
- Deploy

3. **Copy deployment URL**
- Update `NEXT_PUBLIC_BASE_URL` in Vercel settings
- Redeploy

### STEP 5: Configure Telegram Bot (5 min)

1. **Set webhook:**
```bash
curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "http://YOUR_VPS_IP:5678/webhook/telegram-bot"}'
```

2. **Verify webhook:**
```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

### STEP 6: Setup n8n Workflows (20 min)

1. **Access n8n:**
- Open `http://YOUR_VPS_IP:5678`
- Login with credentials from VPS setup

2. **Create Telegram Credential:**
- Credentials → Add → Telegram
- Name: `Telegram Bot`
- Access Token: Your bot token
- Save

3. **Create Environment Variable:**
- Settings → Variables → Add
- Name: `NEXT_PUBLIC_BASE_URL`
- Value: Your Vercel URL

4. **Create Workflows:**

**Workflow 1: Invoice Processor**
- Telegram Trigger (Message)
- HTTP Request: POST `{{$vars.NEXT_PUBLIC_BASE_URL}}/api/ocr`
- Send confirmation message with buttons

**Workflow 2: Callback Handler**
- Telegram Trigger (Callback)
- If confirm → Ask for email
- HTTP Request: POST `/api/telegram/init-login`
- Send login URL

**Workflow 3: Submit Expense**
- Wait node (2 sec intervals)
- HTTP Request: GET `/api/login/status`
- When logged in → POST `/api/submit`
- Send success message

5. **Activate all workflows**

### STEP 7: End-to-End Testing (10 min)

1. **Test bot connection:**
```bash
# In Telegram, message your bot
/start
```

2. **Test complete flow:**
- Send invoice image
- Confirm extracted data
- Provide email
- Click login link
- Login to Darwinbox
- Wait for success message

---

## 🚨 TROUBLESHOOTING

### Bot Not Responding:
```bash
# Check webhook
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# Check n8n logs
docker logs darwinbox-services_n8n_1
```

### OCR Failing:
- Check Vercel function logs
- Verify OpenRouter API key and credits
- Test API endpoint directly

### Login Not Working:
```bash
# Check Browserless
curl http://YOUR_VPS_IP:3000/
# Should return Browserless status

# Check Redis connection
# In Vercel logs
```

### Automation Failing:
- Check Darwinbox selectors haven't changed
- Verify session cookies in Redis
- Check Browserless container logs

---

## ✅ SUCCESS CRITERIA

You'll know it's working when:
1. Bot responds to `/start` command
2. OCR extracts invoice data correctly
3. Login link opens Darwinbox
4. Bot detects successful login
5. Expense appears in Darwinbox
6. User receives success message

---

## 🎯 QUICK LAUNCH COMMANDS

```bash
# 1. On VPS
docker-compose up -d
docker-compose ps

# 2. Set Telegram webhook
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d "url=http://VPS_IP:5678/webhook/telegram-bot"

# 3. Test bot
# Send /start in Telegram

# 4. Monitor logs
docker logs -f darwinbox-services_n8n_1
```

---

## 📞 SUPPORT

If stuck at any step:
1. Check container logs: `docker logs <container_name>`
2. Verify all environment variables are set
3. Ensure all ports are accessible (3000, 5678)
4. Test each component individually

**Estimated Total Time: 1.5 - 2 hours**