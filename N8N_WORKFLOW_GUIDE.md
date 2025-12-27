# Complete n8n Workflow Guide for Telegram Bot

This guide will help you set up the complete n8n workflow for your Telegram bot.

## Overview

The workflow handles:
1. Receiving invoice files from Telegram
2. Extracting data using OCR
3. Asking user to confirm
4. Initiating login flow
5. Monitoring login status
6. Submitting expense to Darwinbox
7. Notifying user of completion

---

## Step-by-Step Workflow Setup

### Workflow 1: Invoice Processing (Main Workflow)

#### Node 1: Telegram Trigger

1. **Add Node** → Search "Telegram Trigger"
2. **Create Credential:**
   - Click "Create New Credential"
   - Credential Name: "Telegram Bot"
   - Access Token: (paste your Telegram bot token)
   - Click "Save"
3. **Configure Node:**
   - Update Types: Select "Message"
   - Click "Execute Node" to test

**Output:** Telegram message data

---

#### Node 2: Check Message Type

1. **Add Node** → Search "IF"
2. **Configure:**
   - Condition: `{{ $json.message.photo }}` exists OR `{{ $json.message.document }}` exists
   - Value 1: `{{ $json.message.photo || $json.message.document }}`
   - Operation: "Not Empty"

**Purpose:** Only process messages with files (photos/documents)

---

#### Node 3: Get File from Telegram

1. **Add Node** → Search "Telegram"
2. **Configure:**
   - Operation: "Get File"
   - File ID: `{{ $json.message.photo ? $json.message.photo[$json.message.photo.length - 1].file_id : $json.message.document.file_id }}`
   - Credential: "Telegram Bot"

**Output:** File path/URL

---

#### Node 4: Download File

1. **Add Node** → Search "HTTP Request"
2. **Configure:**
   - Method: GET
   - URL: `https://api.telegram.org/file/bot{{ $credentials.telegramBot.accessToken }}/{{ $json.file_path }}`
   - Response Format: "File"
   - Options → Response: Binary Data

**Output:** Binary file data

---

#### Node 5: Send OCR Processing Message

1. **Add Node** → Search "Telegram"
2. **Configure:**
   - Operation: "Send Message"
   - Chat ID: `{{ $('Telegram Trigger').item.json.message.chat.id }}`
   - Text: "📄 Processing your invoice... Please wait."

**Purpose:** Let user know we're working on it

---

#### Node 6: Call OCR API

1. **Add Node** → Search "HTTP Request"
2. **Configure:**
   - Method: POST
   - URL: `{{ $env.NEXT_PUBLIC_BASE_URL }}/api/ocr`
   - Authentication: None
   - Body Content Type: Form-Data
   - Add Parameter:
     - Name: `file`
     - Value: (select Binary Data from previous node)
     - Type: File

3. **Set URL from Environment Variable:**
   - In n8n Settings → Variables, add:
     - Variable Name: `NEXT_PUBLIC_BASE_URL`
     - Value: `https://your-vercel-url.vercel.app`

**Output:** Extracted invoice data

---

#### Node 7: Format OCR Results

1. **Add Node** → Search "Code"
2. **Add JavaScript:**

```javascript
const ocrData = $input.item.json.data;
const chatId = $('Telegram Trigger').item.json.message.chat.id;

// Format the extracted data nicely
const formatted = `
✅ Invoice Data Extracted:

📅 Date: ${ocrData.date || 'N/A'}
💰 Amount: ₹${ocrData.amount || 'N/A'}
🏪 Merchant: ${ocrData.merchant || 'N/A'}
📝 Description: ${ocrData.description || 'N/A'}
🏷️ Category: ${ocrData.categoryMapping?.category || 'N/A'}
`;

return {
  json: {
    chatId: chatId,
    ocrData: ocrData,
    formattedText: formatted,
    messageId: $('Telegram Trigger').item.json.message.message_id,
  }
};
```

---

#### Node 8: Send OCR Results with Confirm Button

1. **Add Node** → Search "Telegram"
2. **Configure:**
   - Operation: "Send Message"
   - Chat ID: `{{ $json.chatId }}`
   - Text: `{{ $json.formattedText }}\n\n✅ Please confirm if this looks correct:`
   - Additional Fields → Reply Markup:

```json
{
  "inline_keyboard": [
    [
      {
        "text": "✅ Confirm",
        "callback_data": "confirm_" + $json.messageId
      },
      {
        "text": "❌ Cancel",
        "callback_data": "cancel_" + $json.messageId
      }
    ]
  ]
}
```

**Note:** This is simplified. For production, use a Code node to properly format the callback_data.

---

### Workflow 2: Handle Callback (Confirmation)

#### Node 1: Telegram Trigger (Callback)

1. **Add New Workflow**
2. **Add Node** → "Telegram Trigger"
3. **Configure:**
   - Update Types: "Callback Query"
   - Credential: "Telegram Bot"

---

#### Node 2: Check Callback Action

1. **Add Node** → "IF"
2. **Configure:**
   - Condition: Check if callback_data starts with "confirm_"
   - Value 1: `{{ $json.callback_query.data }}`
   - Operation: "Contains"
   - Value 2: `confirm_`

---

#### Node 3: Store Confirmed Data

1. **Add Node** → "Code"
2. **Store the confirmed invoice data** (you'll need to store this temporarily)

---

#### Node 4: Ask for Email

1. **Add Node** → "Telegram"
2. **Configure:**
   - Operation: "Send Message"
   - Chat ID: `{{ $json.callback_query.message.chat.id }}`
   - Text: "Please send your Darwinbox email address:"

---

#### Node 5: Wait for Email Response

1. **Add Node** → "Telegram Trigger"
2. **Configure:**
   - Update Types: "Message"
   - Add a filter to only accept messages from the same chat

---

### Workflow 3: Login Flow

#### Node 1: Initiate Login

1. **Add Node** → "HTTP Request"
2. **Configure:**
   - Method: POST
   - URL: `{{ $env.NEXT_PUBLIC_BASE_URL }}/api/telegram/init-login`
   - Body Content Type: JSON
   - Body:
```json
{
  "telegramChatId": "{{ $json.message.chat.id }}",
  "email": "{{ $json.message.text }}"
}
```

---

#### Node 2: Send Login URL

1. **Add Node** → "Telegram"
2. **Configure:**
   - Operation: "Send Message"
   - Chat ID: `{{ $('Previous Node').item.json.message.chat.id }}`
   - Text: `🔐 Please log in to Darwinbox:\n\n{{ $json.loginUrl }}\n\nThis link expires in 15 minutes.`

---

#### Node 3: Poll for Login Status

1. **Add Node** → "Loop Over Items" (or use "Wait" + "HTTP Request" in a loop)
2. **Configure:**
   - This is complex - we'll use a simpler approach with HTTP Request + Wait

**Simpler Approach:**

1. **Add Node** → "HTTP Request"
2. **Configure:**
   - Method: GET
   - URL: `{{ $env.NEXT_PUBLIC_BASE_URL }}/api/login/status?telegramChatId={{ $('Previous Node').item.json.message.chat.id }}`

3. **Add Node** → "IF"
4. **Configure:**
   - Condition: `{{ $json.loggedIn }}` equals `true`

5. **If false, add Wait node** (2 seconds)

6. **Loop back** to HTTP Request node (max 150 times = 5 minutes)

---

#### Node 4: Login Success - Submit Expense

1. **Add Node** → "HTTP Request"
2. **Configure:**
   - Method: POST
   - URL: `{{ $env.NEXT_PUBLIC_BASE_URL }}/api/submit`
   - Body Content Type: Form-Data
   - Parameters:
     - sessionId: `{{ $json.sessionId }}`
     - date: (from stored OCR data)
     - amount: (from stored OCR data)
     - merchant: (from stored OCR data)
     - description: (from stored OCR data)
     - categoryValue: (from stored OCR data)
     - expenseTypeValue: (from stored OCR data)

---

#### Node 5: Send Success Notification

1. **Add Node** → "Telegram"
2. **Configure:**
   - Operation: "Send Message"
   - Chat ID: (from stored chat ID)
   - Text: "✅ Expense submitted successfully to Darwinbox!"

---

## Complete Workflow JSON Export

For easier setup, here's a complete workflow you can import. However, you'll need to adjust URLs and credentials.

**To Import:**
1. In n8n, click "Workflows" → "Import from File"
2. Copy the workflow JSON (I'll create this in a separate file)
3. Adjust credentials and URLs

---

## Environment Variables in n8n

Go to **Settings → Variables** and add:

```
NEXT_PUBLIC_BASE_URL=https://your-vercel-url.vercel.app
```

---

## Testing Your Workflow

1. **Activate the workflow** (toggle in top right)
2. **Send a photo** to your Telegram bot
3. **Monitor execution** in n8n
4. **Check logs** for errors

---

## Common Issues & Solutions

### Issue: File download fails
**Solution:** Make sure Telegram bot token is correct and bot has file access

### Issue: OCR API returns error
**Solution:** Check Vercel logs and ensure CLAUDE_API_KEY is set

### Issue: Login status never becomes true
**Solution:** 
- Check if user actually logged in
- Verify session is being saved in Redis
- Check API logs

### Issue: Workflow times out
**Solution:** Increase timeout in Wait nodes or use webhooks instead of polling

---

## Advanced: Using Webhooks Instead of Polling

For better performance, use webhooks instead of polling:

1. **Create webhook endpoint** in your Next.js API
2. **Call webhook** when login is detected
3. **Trigger n8n workflow** via webhook

This is more efficient than polling every 2 seconds.

---

## Next Steps

After setting up the workflows:
1. Test with a real invoice
2. Monitor execution logs
3. Add error handling
4. Add retry logic
5. Set up monitoring/alerting

