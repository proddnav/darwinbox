import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

/**
 * API endpoint to handle batch file uploads
 * Stores files temporarily and returns invoice IDs
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      );
    }

    // Create temp directory if it doesn't exist
    const tmpDir = path.join(process.cwd(), 'tmp', 'invoices');
    if (!existsSync(tmpDir)) {
      await mkdir(tmpDir, { recursive: true });
    }

    const invoiceIds: string[] = [];

    // Save each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const invoiceId = `invoice_${Date.now()}_${i}_${Math.random().toString(36).substring(7)}`;
      invoiceIds.push(invoiceId);

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileExtension = path.extname(file.name) || '.pdf';
      const filePath = path.join(tmpDir, `${invoiceId}${fileExtension}`);
      
      await writeFile(filePath, buffer);
      
      // Store metadata
      const metadata = {
        id: invoiceId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        filePath: filePath,
        status: 'pending' as const,
      };
      
      // Store in a way that can be retrieved (using a simple JSON file)
      const metadataPath = path.join(tmpDir, `${invoiceId}.json`);
      await writeFile(metadataPath, JSON.stringify(metadata));
    }

    return NextResponse.json({
      success: true,
      invoiceIds,
      count: invoiceIds.length,
    });

  } catch (error) {
    console.error('Batch upload error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload files',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get invoice file by ID
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

    const { readFile } = await import('fs/promises');
    const metadata = JSON.parse(await readFile(metadataPath, 'utf-8'));
    
    return NextResponse.json({
      success: true,
      invoice: metadata,
    });

  } catch (error) {
    console.error('Get invoice error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get invoice',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}







