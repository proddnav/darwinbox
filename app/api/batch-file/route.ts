import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

/**
 * Get invoice file content by ID
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const invoiceId = searchParams.get('invoiceId');
    
    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    const tmpDir = path.join(process.cwd(), 'tmp', 'invoices');
    const metadataPath = path.join(tmpDir, `${invoiceId}.json`);
    
    if (!existsSync(metadataPath)) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    const metadata = JSON.parse(await readFile(metadataPath, 'utf-8'));
    const filePath = metadata.filePath;
    
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Invoice file not found' },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(filePath);
    const fileExtension = path.extname(metadata.fileName);
    const contentType = metadata.fileType || 
      (fileExtension === '.pdf' ? 'application/pdf' :
       fileExtension === '.png' ? 'image/png' :
       fileExtension === '.jpg' || fileExtension === '.jpeg' ? 'image/jpeg' :
       'application/octet-stream');

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${metadata.fileName}"`,
      },
    });

  } catch (error) {
    console.error('Get invoice file error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get invoice file',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}






