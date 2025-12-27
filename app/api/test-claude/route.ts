import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Test endpoint to verify Claude API key is working
 * GET /api/test-claude
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.CLAUDE_API_KEY?.trim();
    
    // Check if API key exists
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'CLAUDE_API_KEY is not set in environment variables',
        keyStatus: 'NOT_SET',
        instructions: 'Add CLAUDE_API_KEY=your-key-here to your .env file and restart the server'
      }, { status: 500 });
    }
    
    // Show key info (safely)
    const keyPreview = apiKey.length > 20 
      ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`
      : `${apiKey.substring(0, Math.min(10, apiKey.length))}...`;
    
    const keyInfo = {
      exists: true,
      length: apiKey.length,
      preview: keyPreview,
      startsWithSkAnt: apiKey.startsWith('sk-ant-'),
      formatValid: apiKey.startsWith('sk-ant-') && apiKey.length >= 50
    };
    
    // Try to initialize Anthropic client
    let clientInitialized = false;
    try {
      const anthropic = new Anthropic({ apiKey });
      clientInitialized = true;
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to initialize Anthropic client',
        keyInfo,
        clientError: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }
    
    // Try a simple API call to verify the key works
    // Try multiple model names to find one that works
    let apiTestSuccess = false;
    let apiTestError = null;
    const modelsToTry = [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620', 
      'claude-3-sonnet-20240229',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307'
    ];
    
    for (const model of modelsToTry) {
      try {
        const anthropic = new Anthropic({ apiKey });
        const response = await anthropic.messages.create({
          model: model,
          max_tokens: 10,
          messages: [{
            role: 'user',
            content: 'Say "OK" if you can read this.'
          }]
        });
        
        apiTestSuccess = true;
        console.log(`✅ Model ${model} works!`);
        break;
      } catch (error: any) {
        if (error?.status !== 404) {
          // If it's not a 404, it might be a different error (auth, etc.)
          apiTestError = {
            message: error?.message || String(error),
            status: error?.status,
            statusText: error?.statusText,
            model: model
          };
          break;
        }
        // Continue to next model if this one doesn't exist
        console.log(`Model ${model} not found, trying next...`);
      }
    }
    
    if (!apiTestSuccess && !apiTestError) {
      apiTestError = {
        message: 'None of the tested models are available. Please check Anthropic documentation for available models.',
        status: 404
      };
    }
    
    return NextResponse.json({
      success: apiTestSuccess,
      keyInfo,
      clientInitialized,
      apiTest: {
        success: apiTestSuccess,
        error: apiTestError
      },
      message: apiTestSuccess 
        ? '✅ Claude API key is working correctly!'
        : `❌ Claude API key test failed: ${apiTestError?.message || 'Unknown error'}`
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

