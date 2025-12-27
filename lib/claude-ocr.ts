import { logger } from './logger';

// Get OpenRouter API key from environment
const getOpenRouterApiKey = (): string => {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim() || process.env.CLAUDE_API_KEY?.trim();
  
  if (!apiKey) {
    logger.error('OPENROUTER_API_KEY is not set in environment variables');
    throw new Error('OPENROUTER_API_KEY is not configured. Please set it in your .env file and restart the server.');
  }
  
  // Log API key status (safely - only show first and last few chars)
  const keyPreview = apiKey.length > 20 
    ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`
    : `${apiKey.substring(0, Math.min(10, apiKey.length))}...`;
  
  logger.info(`OpenRouter API key loaded: ${keyPreview} (length: ${apiKey.length})`);
  
  return apiKey;
};

export interface ExtractedData {
  date: string;
  amount: number;
  merchant: string;
  invoiceNumber?: string;
  description: string;
  category?: string;
}

export async function extractDataFromInvoice(imageFile: File): Promise<ExtractedData> {
  // Validate file
  if (!imageFile) {
    throw new Error('No file provided');
  }

  logger.info('Processing file:', { name: imageFile.name, type: imageFile.type, size: imageFile.size });

  // Get OpenRouter API key (will throw if missing)
  const apiKey = getOpenRouterApiKey();

  // Convert file to base64
  const arrayBuffer = await imageFile.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  
  if (!base64 || base64.length === 0) {
    throw new Error('Failed to convert file to base64');
  }
  
  logger.info('File converted to base64, length:', base64.length);
  
  // Determine MIME type - Claude API only supports: image/png, image/jpeg, image/webp, image/gif
  // PDFs need to be converted to images first
  const isPdf = imageFile.name.toLowerCase().endsWith('.pdf') || imageFile.type === 'application/pdf';
  
  if (isPdf) {
    // For now, we'll note that PDF conversion is needed
    // TODO: Implement PDF to image conversion
    logger.warn('PDF file detected. PDF conversion to image is not yet implemented.');
    throw new Error('PDF files require conversion to images. This feature is coming soon. Please convert PDF to PNG or JPEG first.');
  }

  let mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' = 'image/png';
  
  // Map file types to supported Claude formats
  if (imageFile.type === 'image/jpeg' || imageFile.type === 'image/jpg') {
    mimeType = 'image/jpeg';
  } else if (imageFile.type === 'image/png') {
    mimeType = 'image/png';
  } else if (imageFile.type === 'image/webp') {
    mimeType = 'image/webp';
  } else if (imageFile.type === 'image/gif') {
    mimeType = 'image/gif';
  } else {
    // Fallback based on file extension
    const fileName = imageFile.name.toLowerCase();
    if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
      mimeType = 'image/jpeg';
    } else if (fileName.endsWith('.png')) {
      mimeType = 'image/png';
    } else if (fileName.endsWith('.webp')) {
      mimeType = 'image/webp';
    } else if (fileName.endsWith('.gif')) {
      mimeType = 'image/gif';
    }
    // Default to png if we can't determine
  }

  let response: any = null;
  // Try multiple model names (OpenRouter format with anthropic/ prefix)
  const modelsToTry = [
    'anthropic/claude-3.5-sonnet',
    'anthropic/claude-3-opus',
    'anthropic/claude-3-sonnet',
    'anthropic/claude-3-haiku'
  ];
  
  let lastError: any = null;
  let modelUsed = '';
  
  // Create the image URL in OpenAI format for OpenRouter
  const imageUrl = `data:${mimeType};base64,${base64}`;
  const promptText = `Extract the following information from this invoice/receipt image:

1. Date (format: YYYY-MM-DD)
2. Total Amount (number only, no currency symbols)
3. Merchant/Vendor name (business name - CRITICAL: Extract the actual company/business name, NOT pickup/delivery locations, addresses, or customer names)
4. Invoice Number/Receipt Number/Bill Number (look for fields like "Invoice #", "Receipt #", "Bill No", "Order #", "Transaction ID", etc.)
5. Description/Purpose (what was purchased - be specific, e.g., "Airport transfer", "Hotel booking", "Restaurant meal", "Flight ticket", "Business lunch", "Food expense", "Rapido ride", "Taxi service")
6. Category (suggest one: Travel, Food, Accommodation, Office Supplies, Cafe, Miscellaneous, Other)

CRITICAL for Date Format Conversion:
- Convert ALL date formats to YYYY-MM-DD
- If date is in DD/MM/YY format (e.g., "17/11/25"), convert to "2025-11-17" (assume 20YY for 2-digit years)
- If date is in DD/MM/YYYY format (e.g., "17/11/2025"), convert to "2025-11-17"
- If date is in MM/DD/YYYY format (e.g., "11/17/2025"), convert to "2025-11-17"
- Look for date fields labeled: "Date", "Transaction Date", "Bill Date", "Receipt Date", etc.
- Extract the date from the receipt header or transaction details section

IMPORTANT for Merchant/Vendor Name:
- Extract the ACTUAL BUSINESS/COMPANY NAME that issued the invoice/receipt
- For restaurant receipts: Look for the restaurant/establishment name in the header (e.g., "Drinks Section", "Restaurant Name", "Cafe Name")
- Examples: "Rapido", "Uber", "Ola", "Swiggy", "Zomato", "Hotel Taj", "Drinks Section", "Restaurant Name", "Airline Name"
- DO NOT use: pickup points, delivery addresses, customer names, location names, street addresses, or any address details
- Look for: company logos, business names in headers/footers, service provider names, app names (like "Rapido", "Uber")
- For ride-sharing apps: Use the app name (e.g., "Rapido", "Uber", "Ola"), NOT the pickup/drop locations
- For food delivery: Use the platform name (e.g., "Swiggy", "Zomato") or restaurant name, NOT delivery address
- For hotels: Use the hotel name, NOT the address or location
- For restaurants: Use the restaurant/establishment name from the header, NOT the address
- The merchant should be the entity you paid money to, not where you were picked up from or delivered to

IMPORTANT for Invoice Number:
- Look for any number that appears after labels like: "Invoice", "Receipt", "Bill", "Order", "Transaction", "Ref", "Reference", "ID", "Number", "#", "No.", "Bill No:", "Bill No", "Receipt #", "Invoice #"
- It may be formatted as: INV-12345, RCP-2024-001, #123456, Bill No: 789, Bill No 83142, etc.
- Extract the number immediately following these labels
- If no invoice number is found, use empty string ""

IMPORTANT for Category:
- For food/restaurant bills (restaurants, food items, meals, dining, lunch, dinner, breakfast, catering), use "Travel" category
- Only use "Cafe" category for actual cafe/coffee shop visits (not regular restaurants)
- Use "Travel" for: restaurants, food bills, meals, dining, catering, food expenses
- Use "Food" as a fallback if unsure, but prefer "Travel" for business meal expenses

For the description, be specific about the expense type. CRITICAL for transportation/ride-sharing services:
- Check the pickup and drop locations/addresses in the invoice
- Extract the actual drop location/address from the invoice
- If drop address contains "airport", "airport terminal", "airport gate", or is clearly an airport location (e.g., "Kempegowda Airport", "Mumbai Airport", "Airport Road", "Terminal 1", "Terminal 2", etc.):
  * Use format: "Airport transfer to [airport name]" - include the full airport name/location
  * Examples:
    - Drop: "Kempegowda International Airport" → Description: "Airport transfer to Kempegowda International Airport"
    - Drop: "Mumbai Airport Terminal 2" → Description: "Airport transfer to Mumbai Airport Terminal 2"
    - Drop: "Indira Gandhi International Airport" → Description: "Airport transfer to Indira Gandhi International Airport"
- If drop address is NOT airport-related:
  * Use format: "Local conveyance to [drop location]" - include the actual drop location/address
  * Examples:
    - Drop: "123 Main Street" → Description: "Local conveyance to 123 Main Street"
    - Drop: "Office Building, Sector 5" → Description: "Local conveyance to Office Building, Sector 5"
    - Drop: "XYZ Restaurant" → Description: "Local conveyance to XYZ Restaurant"
    - Drop: "Hotel Taj, MG Road" → Description: "Local conveyance to Hotel Taj, MG Road"
- For ride-sharing apps (Rapido, Uber, Ola), analyze the drop location to determine if it's airport-related and include the location in the description

Other examples:
- "Restaurant meal" or "Business lunch" or "Food expense" for restaurant/food bills
- "Hotel booking" or "Lodging" for accommodation
- "Flight ticket" for air travel
- "Cafe visit" only for actual cafe/coffee shop expenses

Return ONLY a valid JSON object in this exact format:
{
  "date": "YYYY-MM-DD",
  "amount": 0,
  "merchant": "string",
  "invoiceNumber": "string",
  "description": "string",
  "category": "string"
}

If any field cannot be determined, use empty string for strings and 0 for amount.`;

  for (const model of modelsToTry) {
    try {
      logger.info(`Trying OpenRouter API with model: ${model}`);
      
      const apiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'https://darwinbox-reimbursements.vercel.app',
          'X-Title': 'Darwinbox Reimbursements Bot'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl
                  }
                },
                {
                  type: 'text',
                  text: promptText
                }
              ]
            }
          ],
          max_tokens: 1024
        })
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({}));
        throw new Error(`OpenRouter API error (${apiResponse.status}): ${errorData.error?.message || apiResponse.statusText}`);
      }

      const data = await apiResponse.json();
      response = data;
      modelUsed = model;
      logger.info(`✅ OpenRouter API call successful with model: ${model}`);
      break; // Success, exit loop
    } catch (error: any) {
      lastError = error;
      const status = error?.status || (error?.message?.includes('401') ? 401 : null);
      if (status === 404) {
        // Model not found, try next one
        logger.info(`Model ${model} not found (404), trying next...`);
        continue;
      } else {
        // Different error (auth, rate limit, etc.) - stop trying
        logger.error(`Error with model ${model}:`, error?.message);
        break;
      }
    }
  }
  
  if (!response) {
    // All models failed
    const error: unknown = lastError;
    // Log full error details for debugging
    const errorDetails: any = error;
    logger.error('OpenRouter API error details:', {
      message: errorDetails?.message,
      status: errorDetails?.status,
      statusText: errorDetails?.statusText,
      error: error,
    });
    
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      const status = (error as any).status;
      
      // Check for API key errors - be more specific
      if (errorMsg.includes('api_key') || 
          errorMsg.includes('authentication') || 
          errorMsg.includes('401') ||
          errorMsg.includes('unauthorized') ||
          status === 401) {
        throw new Error(
          `Invalid OpenRouter API key. ` +
          `Please verify your OPENROUTER_API_KEY in environment variables is correct. ` +
          `Original error: ${error.message}`
        );
      }
      
      // Check for rate limit errors
      if (errorMsg.includes('rate_limit') || 
          errorMsg.includes('429') || 
          status === 429) {
        throw new Error('OpenRouter API rate limit exceeded. Please try again later.');
      }
      
      // Check for other HTTP errors
      if (status) {
        throw new Error(`OpenRouter API error (${status}): ${error.message}`);
      }
      
      // Generic error
      throw new Error(`OpenRouter API error: ${error.message}`);
    }
    
    // Unknown error type
    throw new Error(`Unknown error calling OpenRouter API: ${String(error)}`);
  }

  // Extract JSON from response (OpenRouter format)
  if (!response.choices || response.choices.length === 0 || !response.choices[0].message?.content) {
    throw new Error('Empty response from OpenRouter API');
  }

  const responseText = response.choices[0].message.content;
  
  if (!responseText) {
    throw new Error('No text content in OpenRouter response');
  }
  
  // Try to find JSON in the response - handle multiple JSON objects or code blocks
  let jsonMatch = responseText.match(/\{[\s\S]*\}/);
  
  // If no match, try to find JSON in code blocks
  if (!jsonMatch) {
    const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      jsonMatch = [codeBlockMatch[1], codeBlockMatch[1]];
    }
  }
  
  // Try to find the last JSON object (in case there are multiple)
  if (!jsonMatch) {
    const allMatches = responseText.match(/\{[\s\S]*?\}/g);
    if (allMatches && allMatches.length > 0) {
      jsonMatch = [allMatches[allMatches.length - 1], allMatches[allMatches.length - 1]];
    }
  }
  
  if (!jsonMatch) {
    logger.error('OpenRouter response text:', responseText);
    throw new Error('No JSON found in OpenRouter response. Response: ' + responseText.substring(0, 200));
  }

  let extracted: ExtractedData;
  try {
    // Clean the JSON string - remove any trailing commas or invalid characters
    let jsonString = jsonMatch[0].trim();
    // Remove trailing commas before closing braces/brackets
    jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
    extracted = JSON.parse(jsonString) as ExtractedData;
  } catch (parseError) {
    logger.error('JSON parse error:', parseError);
    logger.error('JSON string that failed:', jsonMatch[0].substring(0, 500));
    throw new Error(`Failed to parse JSON from OpenRouter response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }
  
  return {
    date: extracted.date || '',
    amount: extracted.amount || 0,
    merchant: extracted.merchant || '',
    invoiceNumber: extracted.invoiceNumber || '',
    description: extracted.description || '',
    category: extracted.category || 'Other',
  };
}

/**
 * Extract data from invoice image file path (for MCP server usage)
 * @param filePath - Path to the image file
 * @returns Extracted invoice data
 */
export async function extractDataFromInvoicePath(filePath: string): Promise<ExtractedData> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  // Read file from path
  const fileBuffer = await fs.readFile(filePath);
  const fileName = path.basename(filePath);
  
  // Determine MIME type from file extension
  const ext = path.extname(fileName).toLowerCase();
  let mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' = 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') {
    mimeType = 'image/jpeg';
  } else if (ext === '.png') {
    mimeType = 'image/png';
  } else if (ext === '.webp') {
    mimeType = 'image/webp';
  } else if (ext === '.gif') {
    mimeType = 'image/gif';
  }
  
  // Check for PDF
  if (ext === '.pdf') {
    throw new Error('PDF files require conversion to images. Please convert PDF to PNG or JPEG first.');
  }
  
  // Convert to base64
  const base64 = fileBuffer.toString('base64');
  
  if (!base64 || base64.length === 0) {
    throw new Error('Failed to convert file to base64');
  }
  
  logger.info('Processing file from path:', { name: fileName, type: mimeType, size: fileBuffer.length });
  
  // Get OpenRouter API key
  const apiKey = getOpenRouterApiKey();
  
  // Create the image URL in OpenAI format for OpenRouter
  const imageUrl = `data:${mimeType};base64,${base64}`;
  const promptText = `Extract the following information from this invoice/receipt image:

1. Date (format: YYYY-MM-DD)
2. Total Amount (number only, no currency symbols)
3. Merchant/Vendor name (business name - CRITICAL: Extract the actual company/business name, NOT pickup/delivery locations, addresses, or customer names)
4. Invoice Number/Receipt Number/Bill Number (look for fields like "Invoice #", "Receipt #", "Bill No", "Order #", "Transaction ID", etc.)
5. Description/Purpose (what was purchased - be specific, e.g., "Airport transfer", "Hotel booking", "Restaurant meal", "Flight ticket", "Business lunch", "Food expense", "Rapido ride", "Taxi service")
6. Category (suggest one: Travel, Food, Accommodation, Office Supplies, Cafe, Miscellaneous, Other)

CRITICAL for Date Format Conversion:
- Convert ALL date formats to YYYY-MM-DD
- If date is in DD/MM/YY format (e.g., "17/11/25"), convert to "2025-11-17" (assume 20YY for 2-digit years)
- If date is in DD/MM/YYYY format (e.g., "17/11/2025"), convert to "2025-11-17"
- If date is in MM/DD/YYYY format (e.g., "11/17/2025"), convert to "2025-11-17"
- Look for date fields labeled: "Date", "Transaction Date", "Bill Date", "Receipt Date", etc.
- Extract the date from the receipt header or transaction details section

IMPORTANT for Merchant/Vendor Name:
- Extract the ACTUAL BUSINESS/COMPANY NAME that issued the invoice/receipt
- For restaurant receipts: Look for the restaurant/establishment name in the header (e.g., "Drinks Section", "Restaurant Name", "Cafe Name")
- Examples: "Rapido", "Uber", "Ola", "Swiggy", "Zomato", "Hotel Taj", "Drinks Section", "Restaurant Name", "Airline Name"
- DO NOT use: pickup points, delivery addresses, customer names, location names, street addresses, or any address details
- Look for: company logos, business names in headers/footers, service provider names, app names (like "Rapido", "Uber")
- For ride-sharing apps: Use the app name (e.g., "Rapido", "Uber", "Ola"), NOT the pickup/drop locations
- For food delivery: Use the platform name (e.g., "Swiggy", "Zomato") or restaurant name, NOT delivery address
- For hotels: Use the hotel name, NOT the address or location
- For restaurants: Use the restaurant/establishment name from the header, NOT the address
- The merchant should be the entity you paid money to, not where you were picked up from or delivered to

IMPORTANT for Invoice Number:
- Look for any number that appears after labels like: "Invoice", "Receipt", "Bill", "Order", "Transaction", "Ref", "Reference", "ID", "Number", "#", "No.", "Bill No:", "Bill No", "Receipt #", "Invoice #"
- It may be formatted as: INV-12345, RCP-2024-001, #123456, Bill No: 789, Bill No 83142, etc.
- Extract the number immediately following these labels
- If no invoice number is found, use empty string ""

IMPORTANT for Category:
- For food/restaurant bills (restaurants, food items, meals, dining, lunch, dinner, breakfast, catering), use "Travel" category
- Only use "Cafe" category for actual cafe/coffee shop visits (not regular restaurants)
- Use "Travel" for: restaurants, food bills, meals, dining, catering, food expenses
- Use "Food" as a fallback if unsure, but prefer "Travel" for business meal expenses

For the description, be specific about the expense type. CRITICAL for transportation/ride-sharing services:
- Check the pickup and drop locations/addresses in the invoice
- Extract the actual drop location/address from the invoice
- If drop address contains "airport", "airport terminal", "airport gate", or is clearly an airport location (e.g., "Kempegowda Airport", "Mumbai Airport", "Airport Road", "Terminal 1", "Terminal 2", etc.):
  * Use format: "Airport transfer to [airport name]" - include the full airport name/location
  * Examples:
    - Drop: "Kempegowda International Airport" → Description: "Airport transfer to Kempegowda International Airport"
    - Drop: "Mumbai Airport Terminal 2" → Description: "Airport transfer to Mumbai Airport Terminal 2"
    - Drop: "Indira Gandhi International Airport" → Description: "Airport transfer to Indira Gandhi International Airport"
- If drop address is NOT airport-related:
  * Use format: "Local conveyance to [drop location]" - include the actual drop location/address
  * Examples:
    - Drop: "123 Main Street" → Description: "Local conveyance to 123 Main Street"
    - Drop: "Office Building, Sector 5" → Description: "Local conveyance to Office Building, Sector 5"
    - Drop: "XYZ Restaurant" → Description: "Local conveyance to XYZ Restaurant"
    - Drop: "Hotel Taj, MG Road" → Description: "Local conveyance to Hotel Taj, MG Road"
- For ride-sharing apps (Rapido, Uber, Ola), analyze the drop location to determine if it's airport-related and include the location in the description

Other examples:
- "Restaurant meal" or "Business lunch" or "Food expense" for restaurant/food bills
- "Hotel booking" or "Lodging" for accommodation
- "Flight ticket" for air travel
- "Cafe visit" only for actual cafe/coffee shop expenses

Return ONLY a valid JSON object in this exact format:
{
  "date": "YYYY-MM-DD",
  "amount": 0,
  "merchant": "string",
  "invoiceNumber": "string",
  "description": "string",
  "category": "string"
}

If any field cannot be determined, use empty string for strings and 0 for amount.`;

  // Try multiple models (OpenRouter format)
  const modelsToTry = [
    'anthropic/claude-3.5-sonnet',
    'anthropic/claude-3-opus',
    'anthropic/claude-3-sonnet',
    'anthropic/claude-3-haiku'
  ];
  
  let response: any = null;
  let lastError: any = null;
  let modelUsed = '';
  
  for (const model of modelsToTry) {
    try {
      logger.info(`Trying OpenRouter API with model: ${model}`);
      
      const apiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'https://darwinbox-reimbursements.vercel.app',
          'X-Title': 'Darwinbox Reimbursements Bot'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl
                  }
                },
                {
                  type: 'text',
                  text: promptText
                }
              ]
            }
          ],
          max_tokens: 1024
        })
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({}));
        throw new Error(`OpenRouter API error (${apiResponse.status}): ${errorData.error?.message || apiResponse.statusText}`);
      }

      const data = await apiResponse.json();
      response = data;
      modelUsed = model;
      logger.info(`✅ OpenRouter API call successful with model: ${model}`);
      break;
    } catch (error: any) {
      lastError = error;
      const status = error?.status || (error?.message?.includes('401') ? 401 : null);
      if (status === 404) {
        logger.info(`Model ${model} not found (404), trying next...`);
        continue;
      } else {
        logger.error(`Error with model ${model}:`, error?.message);
        break;
      }
    }
  }
  
  if (!response) {
    throw new Error(`Failed to process invoice: ${lastError?.message || 'Unknown error'}`);
  }
  
  // Extract JSON from response (OpenRouter format)
  if (!response.choices || response.choices.length === 0 || !response.choices[0].message?.content) {
    throw new Error('Empty response from OpenRouter API');
  }
  
  const responseText = response.choices[0].message.content;
  
  if (!responseText) {
    throw new Error('No text content in OpenRouter response');
  }
  
  // Try to find JSON in the response - handle multiple JSON objects or code blocks
  let jsonMatch = responseText.match(/\{[\s\S]*\}/);
  
  // If no match, try to find JSON in code blocks
  if (!jsonMatch) {
    const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      jsonMatch = [codeBlockMatch[1], codeBlockMatch[1]];
    }
  }
  
  // Try to find the last JSON object (in case there are multiple)
  if (!jsonMatch) {
    const allMatches = responseText.match(/\{[\s\S]*?\}/g);
    if (allMatches && allMatches.length > 0) {
      jsonMatch = [allMatches[allMatches.length - 1], allMatches[allMatches.length - 1]];
    }
  }
  
  if (!jsonMatch) {
    logger.error('OpenRouter response text:', responseText);
    throw new Error('No JSON found in OpenRouter response. Response: ' + responseText.substring(0, 200));
  }

  let extracted: ExtractedData;
  try {
    // Clean the JSON string - remove any trailing commas or invalid characters
    let jsonString = jsonMatch[0].trim();
    // Remove trailing commas before closing braces/brackets
    jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
    extracted = JSON.parse(jsonString) as ExtractedData;
  } catch (parseError) {
    logger.error('JSON parse error:', parseError);
    logger.error('JSON string that failed:', jsonMatch[0].substring(0, 500));
    throw new Error(`Failed to parse JSON from OpenRouter response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }
  
  return {
    date: extracted.date || '',
    amount: extracted.amount || 0,
    merchant: extracted.merchant || '',
    invoiceNumber: extracted.invoiceNumber || '',
    description: extracted.description || '',
    category: extracted.category || 'Other',
  };
}

