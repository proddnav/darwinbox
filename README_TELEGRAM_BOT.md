# Darwinbox Reimbursements Telegram Bot

Complete automation system for submitting expense reimbursements to Darwinbox via Telegram bot, powered by n8n and Playwright.

## 🎯 What This Does

1. **User uploads invoice** to Telegram bot
2. **Bot extracts data** using Claude OCR
3. **User confirms** the extracted data
4. **User logs in** to Darwinbox via secure link
5. **Automation runs** - fills expense form and submits
6. **User gets notified** when complete

## 📁 Project Structure

```
.
├── app/
│   ├── api/
│   │   ├── ocr/                    # Invoice OCR endpoint
│   │   ├── submit/                 # Expense submission endpoint
│   │   ├── login/                  # Login endpoints
│   │   └── telegram/               # Telegram bot endpoints
│   └── login/[token]/              # Login web interface
├── lib/
│   ├── session-manager-redis.ts    # Redis-based session management
│   ├── session-storage.ts          # Session storage layer
│   ├── redis-client.ts             # Redis client
│   ├── browserless-client.ts       # Browserless integration
│   └── playwright-automation.ts    # Playwright automation (existing)
├── docker-compose.yml              # Docker services (Browserless, n8n)
├── DEPLOYMENT_GUIDE.md             # Complete deployment instructions
├── N8N_WORKFLOW_GUIDE.md           # n8n workflow setup guide
└── QUICK_START.md                  # Quick start guide
```

## 🚀 Quick Start

1. **Follow [QUICK_START.md](./QUICK_START.md)** for fastest setup
2. **Or follow [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** for detailed instructions

## 📋 Prerequisites

- Node.js 18+ (for local development)
- Docker & Docker Compose (for VPS)
- GitHub account (for code hosting)
- Vercel account (for Next.js hosting, free)
- Hostinger VPS or similar ($5-10/month)
- Upstash Redis account (free tier)
- Claude API key
- Telegram account

## 🏗️ Architecture

```
┌─────────────┐
│   Telegram  │ User uploads invoice
│     Bot     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│     n8n     │ Orchestrates workflow
│  Workflows  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Next.js API│ OCR, login, submission
│   (Vercel)  │
└──────┬──────┘
       │
       ├──► Redis (Upstash) - Session storage
       │
       └──► Browserless (VPS) - Browser automation
            └──► Playwright - Fills Darwinbox forms
```

## 🔧 Setup Steps

### 1. Infrastructure Setup

- [ ] Setup Upstash Redis
- [ ] Create Telegram Bot
- [ ] Setup Hostinger VPS
- [ ] Deploy Browserless & n8n (Docker)

### 2. API Deployment

- [ ] Push code to GitHub
- [ ] Deploy to Vercel
- [ ] Configure environment variables

### 3. n8n Configuration

- [ ] Access n8n dashboard
- [ ] Create Telegram credential
- [ ] Setup workflows (see N8N_WORKFLOW_GUIDE.md)

### 4. Testing

- [ ] Test OCR extraction
- [ ] Test login flow
- [ ] Test expense submission
- [ ] Test complete end-to-end flow

## 📝 Environment Variables

Required environment variables (set in Vercel):

```
CLAUDE_API_KEY=your-claude-api-key
REDIS_URL=your-upstash-redis-url
BROWSERLESS_URL=http://your-vps-ip:3000
BROWSERLESS_TOKEN=your-browserless-token
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

## 📚 Documentation

- **[QUICK_START.md](./QUICK_START.md)** - Get started in 30 minutes
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Detailed deployment instructions
- **[N8N_WORKFLOW_GUIDE.md](./N8N_WORKFLOW_GUIDE.md)** - Complete n8n workflow setup

## 🔒 Security Notes

- Never commit secrets to git
- Use environment variables for all sensitive data
- Use strong passwords for n8n
- Keep tokens secure
- Regularly update dependencies
- Use HTTPS in production

## 🐛 Troubleshooting

### Services won't start
- Check Docker is running: `docker ps`
- Check logs: `docker-compose logs`
- Verify ports aren't in use

### Redis connection fails
- Verify REDIS_URL format
- Check Upstash dashboard
- Test connection with redis-cli

### n8n workflow errors
- Check execution logs in n8n
- Verify API URLs are correct
- Check environment variables

### Playwright automation fails
- Check Browserless is running
- Verify BROWSERLESS_URL is correct
- Check Browserless logs

## 📞 Support

For issues:
1. Check logs in n8n, Vercel, and Browserless
2. Review documentation
3. Check error messages carefully
4. Verify all environment variables are set

## 🎓 Learning Resources

- [n8n Documentation](https://docs.n8n.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Browserless Documentation](https://www.browserless.io/docs/)
- [Vercel Documentation](https://vercel.com/docs)

## 📄 License

[Your License Here]

## 🙏 Credits

Built with:
- Next.js
- Playwright
- n8n
- Browserless
- Claude AI
- Telegram Bot API

