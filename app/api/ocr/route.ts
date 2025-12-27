import { NextRequest, NextResponse } from 'next/server';
import { extractDataFromInvoice } from '@/lib/claude-ocr';
import { mapCategoryToReimbursement } from '@/lib/category-mapper';

export async function POST(request: NextRequest) {
  try {
    // Check API key first
    const apiKey = process.env.OPENROUTER_API_KEY?.trim() || process.env.CLAUDE_API_KEY?.trim();
    if (!apiKey) {
      console.error('❌ OPENROUTER_API_KEY is not set in environment variables');
      return NextResponse.json(
        { 
          error: 'Server configuration error',
          message: 'OPENROUTER_API_KEY is not configured. Please set it in your .env file and restart the server.'
        },
        { status: 500 }
      );
    }
    
    // Log API key status (for debugging)
    const keyPreview = apiKey.length > 20 
      ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`
      : `${apiKey.substring(0, Math.min(10, apiKey.length))}...`;
    console.log(`🔑 Using API key: ${keyPreview} (length: ${apiKey.length})`);

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload JPG, PNG, or PDF' },
        { status: 400 }
      );
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    // Extract data using Claude
    console.log('Starting OCR extraction...');
    const extractedData = await extractDataFromInvoice(file);
    console.log('OCR extraction successful:', { 
      date: extractedData.date, 
      amount: extractedData.amount, 
      merchant: extractedData.merchant 
    });

    // Map category to reimbursement category and expense type
    const categoryMapping = mapCategoryToReimbursement(
      extractedData.category || 'Other',
      extractedData.description,
      extractedData.merchant
    );
    console.log('Category mapping:', categoryMapping);

    return NextResponse.json({
      success: true,
      data: {
        ...extractedData,
        categoryMapping,
      },
    });
  } catch (error) {
    console.error('OCR Error Details:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide more specific error messages
    let statusCode = 500;
    if (errorMessage.includes('OPENROUTER_API_KEY') || errorMessage.includes('CLAUDE_API_KEY') || errorMessage.includes('API key') || errorMessage.includes('authentication')) {
      statusCode = 500;
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      statusCode = 429;
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to extract data from invoice',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? {
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined,
        } : undefined
      },
      { status: statusCode }
    );
  }
}

