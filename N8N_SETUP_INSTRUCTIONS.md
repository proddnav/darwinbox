# N8N Darwinbox Workflow Setup Instructions

## Prerequisites
- N8N instance running at http://145.223.18.204:5678
- Telegram Bot Token
- Your deployed app URL (Vercel URL)

## Step 1: Import the Workflow

1. Access N8N at http://145.223.18.204:5678
2. Click **"Workflows"** → **"Import from URL or file"**
3. Upload the `n8n-darwinbox-workflow.json` file
4. Click **"Import"**

## Step 2: Configure Environment Variables

1. In N8N, go to **Settings** (gear icon) → **Variables**
2. Add the following variable:
   ```
   Variable Name: BASE_URL
   Variable Value: https://your-vercel-app.vercel.app
   ```
   Replace with your actual Vercel deployment URL

## Step 3: Set Up Telegram Credentials

1. In the workflow, find any Telegram node
2. Click on **"Telegram Bot"** credential
3. Click **"Create New"**
4. Enter:
   - Credential Name: `Telegram Bot`
   - Access Token: `YOUR_BOT_TOKEN` (from BotFather)
5. Click **"Create"**

## Step 4: Update the Workflow

### Update BASE_URL in Set Variables Node
1. Find the **"Set Variables"** node at the beginning
2. Double-click to open
3. Change the BASE_URL value to your Vercel deployment URL
4. Click **"Execute Node"** to test

### Configure Webhook URL
1. In the **Telegram Trigger** node
2. Copy the webhook URL shown
3. This will be automatically registered when you activate the workflow

## Step 5: Test the Workflow

### Test Each Component:

1. **Telegram Connection**
   - Execute the Telegram Trigger node
   - Send a message to your bot
   - Check if the trigger receives it

2. **File Processing**
   - Send an image to your bot
   - Check if it flows through to OCR

3. **API Endpoints**
   - Verify all HTTP Request nodes point to correct URLs
   - Test each endpoint individually

## Step 6: Activate the Workflow

1. Toggle the **Active** switch in the top right
2. The webhook will be automatically registered with Telegram
3. Your bot is now ready!

## How It Works:

1. **User sends invoice image** → Telegram Trigger receives it
2. **File is downloaded** → Sent to OCR API
3. **OCR extracts data** → Shows confirmation to user
4. **User confirms** → Asks for email
5. **User provides email** → Generates login link
6. **User logs in** → Bot monitors login status
7. **Login detected** → Submits expense automatically
8. **Success notification** → Sent to user

## Troubleshooting:

### Bot not responding
- Check if workflow is active
- Verify Telegram credentials
- Check N8N logs

### OCR failing
- Verify BASE_URL is correct
- Check your Vercel app is deployed
- Ensure OCR API is working

### Login not detected
- Check Redis connection
- Verify session management
- Check API logs

### Submission failing
- Ensure Browserless is running
- Check session validity
- Verify form selectors

## Important Notes:

1. **Security**: The workflow includes the Browserless token. Keep this secure.
2. **Rate Limits**: Be aware of Telegram's rate limits
3. **Session Timeout**: Login links expire in 15 minutes
4. **Monitoring**: Check execution logs regularly

## Testing the Complete Flow:

1. Send `/start` to your bot
2. Send an invoice image
3. Confirm the extracted data
4. Enter your email when asked
5. Click the login link
6. Complete Darwinbox login
7. Wait for success notification

The expense should be automatically submitted!