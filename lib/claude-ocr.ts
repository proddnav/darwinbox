import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || '',
});

export interface ExtractedData {
  date: string;
  amount: number;
  merchant: string;
  description: string;
  category?: string;
}

export async function extractDataFromInvoice(imageFile: File): Promise<ExtractedData> {
  // Convert file to base64
  const arrayBuffer = await imageFile.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  
  // Ensure mime type is one of the allowed types
  let mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' = 'image/png';
  
  if (imageFile.type === 'image/jpeg' || imageFile.type === 'image/jpg') {
    mediaType = 'image/jpeg';
  } else if (imageFile.type === 'image/gif') {
    mediaType = 'image/gif';
  } else if (imageFile.type === 'image/webp') {
    mediaType = 'image/webp';
  }

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: 'text',
            text: `Extract the following information from this invoice/receipt image:

1. Date (format: YYYY-MM-DD)
2. Total Amount (number only, no currency symbols)
3. Merchant/Vendor name (business name)
4. Description/Purpose (what was purchased)
5. Category (suggest one: Travel, Food, Accommodation, Office Supplies, Other)

Return ONLY a valid JSON object in this exact format:
{
  "date": "YYYY-MM-DD",
  "amount": 0,
  "merchant": "string",
  "description": "string",
  "category": "string"
}

If any field cannot be determined, use empty string for strings and 0 for amount.`,
          },
        ],
      },
    ],
  });

  // Extract JSON from response
  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  
  // Try to find JSON in the response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  const extracted = JSON.parse(jsonMatch[0]) as ExtractedData;
  
  return {
    date: extracted.date || '',
    amount: extracted.amount || 0,
    merchant: extracted.merchant || '',
    description: extracted.description || '',
    category: extracted.category || 'Other',
  };
}

