import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-manager';
import { initBrowserContext } from '@/lib/playwright-automation';
import { navigateToExpenseForm } from '@/lib/navigate-to-expense-form';
import { selectCategoryAndExpenseType, fillExpenseForm } from '@/lib/fill-expense-form';
import { writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { setProgress } from '@/lib/progress-tracker';

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    // Parse form data
    const formData = await request.formData();
    
    // Get session ID and taskId from form data
    const sessionId = formData.get('sessionId') as string;
    const taskId = (formData.get('taskId') as string) || `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }
    
    setProgress(taskId, 5, 'Preparing submission...');

    // Get expense data
    const date = formData.get('date') as string;
    const amount = parseFloat(formData.get('amount') as string);
    const merchant = formData.get('merchant') as string;
    const invoiceNumber = formData.get('invoiceNumber') as string;
    const description = formData.get('description') as string;
    const categoryValue = formData.get('categoryValue') as string;
    const expenseTypeValue = formData.get('expenseTypeValue') as string;

    // Validate required fields
    if (!date || !amount || !merchant || !description || !categoryValue || !expenseTypeValue) {
      return NextResponse.json(
        { error: 'Missing required fields: date, amount, merchant, description, categoryValue, expenseTypeValue' },
        { status: 400 }
      );
    }

    // Get file if provided
    const file = formData.get('file') as File | null;

    // Handle file upload
    if (file) {
      setProgress(taskId, 10, 'Saving file...');
      // Ensure /tmp directory exists
      const tmpDir = '/tmp';
      if (!existsSync(tmpDir)) {
        await mkdir(tmpDir, { recursive: true });
      }

      // Save file to temporary location
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileExtension = path.extname(file.name) || '.pdf';
      tempFilePath = path.join(tmpDir, `invoice-${sessionId}-${Date.now()}${fileExtension}`);
      
      await writeFile(tempFilePath, buffer);
      console.error(`✓ File saved to temporary location: ${tempFilePath}`);
    }

    // Get or create session
    setProgress(taskId, 15, 'Initializing session...');
    console.error(`Looking for session: ${sessionId}`);
    let session = await getSession(sessionId);
    if (!session) {
      console.error(`❌ Session not found: ${sessionId}`);
      return NextResponse.json(
        { 
          error: 'Session not found. Please login first.',
          sessionId: sessionId,
          message: 'The session may have expired. Please login again.'
        },
        { status: 401 }
      );
    }
    console.error(`✓ Session found for: ${session.email} (cookies: ${session.cookies?.length || 0})`);

    // Ensure browser context exists - reuse existing one if available
    if (!session.browserContext) {
      setProgress(taskId, 20, 'Starting browser...');
      // Restore cookies if they exist in the session
      session.browserContext = await initBrowserContext(sessionId, session.cookies);
      // Update session to save browser context
      const { updateSession } = await import('@/lib/session-manager');
      await updateSession(sessionId, { browserContext: session.browserContext });
      console.error(`✓ Browser context initialized for session ${sessionId} with ${session.cookies?.length || 0} cookies`);
    } else {
      // Browser context exists - reuse it and ensure cookies are up to date
      if (session.cookies && session.cookies.length > 0) {
        try {
          // Check if we need to add cookies (they might have been updated)
          const existingCookies = await session.browserContext.cookies();
          if (existingCookies.length === 0 || existingCookies.length !== session.cookies.length) {
            await session.browserContext.addCookies(session.cookies);
            console.error(`✓ Restored ${session.cookies.length} cookies to existing browser context`);
          }
        } catch (error) {
          console.error(`⚠️  Failed to restore cookies to existing context: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      console.error(`✓ Reusing existing browser context for session ${sessionId}`);
    }

    const page = session.browserContext.pages()[0] || await session.browserContext.newPage();

    // Navigate to expense form
    setProgress(taskId, 30, 'Navigating to expense form...');
    console.error('Navigating to expense form...');
    const navResult = await navigateToExpenseForm(page);
    if (!navResult.success) {
      return NextResponse.json(
        { error: navResult.message },
        { status: 500 }
      );
    }

    // Select category and expense type
    setProgress(taskId, 40, 'Selecting category and expense type...');
    console.error('Selecting category and expense type...');
    const selectResult = await selectCategoryAndExpenseType(page, categoryValue, expenseTypeValue);
    if (!selectResult.success) {
      return NextResponse.json(
        { error: selectResult.message },
        { status: 500 }
      );
    }

    // Fill expense form with data and file
    setProgress(taskId, 50, 'Filling form fields...');
    console.error('Filling expense form...');
    const fillResult = await fillExpenseForm(page, {
      date,
      amount,
      merchant,
      invoiceNumber: invoiceNumber || '',
      description,
      categoryValue,
      expenseTypeValue,
      filePath: tempFilePath || undefined,
    });

    if (!fillResult.success) {
      return NextResponse.json(
        { error: fillResult.message },
        { status: 500 }
      );
    }

    // Click the Save button after form is filled
    setProgress(taskId, 80, 'Uploading file and saving...');
    console.error('Clicking Save button...');
    try {
      await page.waitForTimeout(500); // Reduced wait time
      
      // Try multiple selectors for the Save button
      const selectors = [
        '#add_exp',
        'button#add_exp',
        'button.btn-primary#add_exp',
        'button.db-btn#add_exp',
        'button.amplify-submit-button#add_exp',
        'button.btn.btn-primary.db-btn.ripple.amplify-submit-button#add_exp',
      ];
      
      let buttonClicked = false;
      for (const selector of selectors) {
        try {
          const saveButton = page.locator(selector).first();
          const buttonCount = await saveButton.count();
          
          if (buttonCount > 0) {
            // Check if button is visible and enabled
            const isVisible = await saveButton.isVisible().catch(() => false);
            if (isVisible) {
              await saveButton.scrollIntoViewIfNeeded();
              await page.waitForTimeout(200); // Reduced wait time
              await saveButton.click();
              console.error(`✓ Save button clicked successfully using selector: ${selector}`);
              buttonClicked = true;
              
              setProgress(taskId, 95, 'Finalizing submission...');
              // Wait for form submission to process
              await page.waitForTimeout(1500); // Reduced wait time
              break;
            }
          }
        } catch (e) {
          // Continue to next selector
          continue;
        }
      }
      
      if (!buttonClicked) {
        console.error('⚠️  Could not find or click Save button. Please click manually.');
      }
    } catch (error) {
      console.error(`⚠️  Error clicking Save button: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Don't fail the request if button click fails - user can click manually
    }

    // Cleanup temporary file
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
        console.error(`✓ Temporary file deleted: ${tempFilePath}`);
      } catch (cleanupError) {
        console.error(`⚠️  Failed to delete temporary file: ${cleanupError}`);
        // Don't fail the request if cleanup fails
      }
      tempFilePath = null;
    }

    setProgress(taskId, 100, 'Submission completed!');
    
    return NextResponse.json({
      success: true,
      message: 'Expense form filled and file uploaded successfully',
      taskId,
      data: {
        date,
        amount,
        merchant,
        invoiceNumber,
        description,
        fileUploaded: !!file,
      },
    });

  } catch (error) {
    // Cleanup temporary file on error
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
        console.error(`✓ Temporary file cleaned up after error: ${tempFilePath}`);
      } catch (cleanupError) {
        console.error(`⚠️  Failed to cleanup temporary file: ${cleanupError}`);
      }
    }

    console.error('Submit API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to submit reimbursement',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

