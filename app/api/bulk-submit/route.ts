import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-manager';
import { initBrowserContext } from '@/lib/playwright-automation';
import { navigateToExpenseForm } from '@/lib/navigate-to-expense-form';
import { selectCategoryAndExpenseType, fillExpenseForm } from '@/lib/fill-expense-form';
import { writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { setProgress } from '@/lib/progress-tracker';
import { Page } from 'playwright';

interface InvoiceData {
  date: string;
  amount: string;
  merchant: string;
  invoiceNumber: string;
  description: string;
  categoryValue: string;
  expenseTypeValue: string;
}

async function clickCreateExpenseButton(page: Page): Promise<{ success: boolean; message: string }> {
  try {
    // Wait for page to settle after saving previous expense
    await page.waitForTimeout(2000);
    
    // Scroll to top first to ensure we can see the button (it might be pushed up)
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    await page.waitForTimeout(1000);
    
    // Step 1: Click "+ Create Expense" button with retry logic
    const createExpenseSelectors = [
      'a.add_expense_button',
      '.add_expense_button',
      'span:has-text("+ Create Expense")',
      'a:has-text("+ Create Expense")',
      'button:has-text("+ Create Expense")',
      '[class*="add_expense"]',
      'a[href*="add_expense"]',
    ];
    
    let createExpenseClicked = false;
    const maxRetries = 3;
    
    for (let retry = 0; retry < maxRetries && !createExpenseClicked; retry++) {
      if (retry > 0) {
        // Scroll to top again on retry
        await page.evaluate(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        await page.waitForTimeout(1000);
      }
      
      for (const selector of createExpenseSelectors) {
        try {
          // Wait for button to be available
          await page.waitForSelector(selector, { timeout: 3000, state: 'attached' }).catch(() => {});
          
          const button = page.locator(selector).first();
          const count = await button.count();
          
          if (count > 0) {
            // Check if button is in viewport or scroll to it
            const isVisible = await button.isVisible().catch(() => false);
            
            if (!isVisible) {
              // Button exists but not visible - scroll to it
              await button.scrollIntoViewIfNeeded();
              await page.waitForTimeout(500);
            }
            
            // Verify it's now visible and clickable
            const nowVisible = await button.isVisible().catch(() => false);
            if (nowVisible) {
              // Ensure button is in viewport
              await button.evaluate((el) => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              });
              await page.waitForTimeout(500);
              
              // Try to click
              await button.click({ timeout: 3000 });
              console.error(`✓ "+ Create Expense" button clicked (attempt ${retry + 1})`);
              createExpenseClicked = true;
              break;
            }
          }
        } catch (e) {
          // Continue to next selector
          continue;
        }
      }
    }
    
    if (!createExpenseClicked) {
      return { success: false, message: 'Could not find or click "+ Create Expense" button after multiple attempts' };
    }
    
    // Step 2: Wait for the modal/popup to appear
    await page.waitForTimeout(3000);
    
    // Step 3: Click "Skip & Add Expenses Manually" link
    const skipSelectors = [
      'a.add_expense_manual_ocr',
      'a:has-text("Skip & Add Expenses Manually")',
      'a:has-text("Skip")',
      '.add_expense_manual_ocr',
    ];
    
    let skipClicked = false;
    for (const selector of skipSelectors) {
      try {
        const skipLink = page.locator(selector).first();
        const count = await skipLink.count();
        if (count > 0) {
          const isVisible = await skipLink.isVisible().catch(() => false);
          if (isVisible) {
            await skipLink.scrollIntoViewIfNeeded();
            await page.waitForTimeout(300);
            await skipLink.click();
            console.error(`✓ "Skip & Add Expenses Manually" link clicked`);
            skipClicked = true;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!skipClicked) {
      return { success: false, message: 'Could not find "Skip & Add Expenses Manually" link' };
    }
    
    // Step 4: Wait for expense form to be visible
    await page.waitForTimeout(3000);
    await page.waitForSelector('#addExpenses', { timeout: 10000 });
    
    return { success: true, message: 'Successfully clicked + Create Expense and Skip & Add Expenses Manually' };
  } catch (error) {
    return {
      success: false,
      message: `Error clicking + Create Expense: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function POST(request: NextRequest) {
  let tempFilePaths: string[] = [];
  try {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;
    const taskId = (formData.get('taskId') as string) || `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const invoicesJson = formData.get('invoices') as string;
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }
    if (!invoicesJson) {
      return NextResponse.json({ error: 'Invoices data is required' }, { status: 400 });
    }

    let invoices: InvoiceData[];
    try {
      invoices = JSON.parse(invoicesJson);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid invoices data format' }, { status: 400 });
    }

    if (!Array.isArray(invoices) || invoices.length === 0) {
      return NextResponse.json({ error: 'At least one invoice is required' }, { status: 400 });
    }

    const fileMap = new Map<number, File>();
    for (let i = 0; i < invoices.length; i++) {
      const file = formData.get(`file_${i}`) as File;
      if (file) fileMap.set(i, file);
    }

    if (fileMap.size !== invoices.length) {
      return NextResponse.json({ error: `Expected ${invoices.length} files but got ${fileMap.size}` }, { status: 400 });
    }

    setProgress(taskId, 5, `Preparing to submit ${invoices.length} expenses...`);

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found. Please login first.' }, { status: 401 });
    }

    // Ensure browser context exists - recreate if needed (e.g., after server restart)
    if (!session.browserContext) {
      setProgress(taskId, 10, 'Starting browser...');
      // Restore cookies if they exist in the session
      session.browserContext = await initBrowserContext(sessionId, session.cookies);
      // Update session to save browser context
      const { updateSession } = await import('@/lib/session-manager');
      await updateSession(sessionId, { browserContext: session.browserContext });
      console.error(`✓ Browser context initialized for session ${sessionId} with ${session.cookies?.length || 0} cookies`);
    } else {
      // Browser context exists - verify it's still valid
      try {
        const pages = session.browserContext.pages();
        if (pages.length === 0) {
          // Browser context exists but no pages - recreate it
          setProgress(taskId, 10, 'Recreating browser...');
          session.browserContext = await initBrowserContext(sessionId, session.cookies);
          const { updateSession } = await import('@/lib/session-manager');
          await updateSession(sessionId, { browserContext: session.browserContext });
          console.error(`✓ Browser context recreated for session ${sessionId}`);
        }
      } catch (e) {
        // Browser context is invalid - recreate it
        setProgress(taskId, 10, 'Recreating browser...');
        session.browserContext = await initBrowserContext(sessionId, session.cookies);
        const { updateSession } = await import('@/lib/session-manager');
        await updateSession(sessionId, { browserContext: session.browserContext });
        console.error(`✓ Browser context recreated for session ${sessionId} (was invalid)`);
      }
    }

    if (session.cookies && session.cookies.length > 0) {
      try {
        const existingCookies = await session.browserContext.cookies();
        if (existingCookies.length === 0 || existingCookies.length !== session.cookies.length) {
          await session.browserContext.addCookies(session.cookies);
        }
      } catch (error) {
        console.error(`⚠️  Failed to restore cookies: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const page = session.browserContext.pages()[0] || await session.browserContext.newPage();
    setProgress(taskId, 15, 'Navigating to expense form...');
    const navResult = await navigateToExpenseForm(page);
    if (!navResult.success) {
      return NextResponse.json({ error: navResult.message }, { status: 500 });
    }

    const results = [];
    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];
      const invoiceNum = i + 1;
      const totalInvoices = invoices.length;

      setProgress(taskId, 20 + Math.floor((i / totalInvoices) * 70), `Processing expense ${invoiceNum}/${totalInvoices}...`);

      try {
        const file = fileMap.get(i);
        if (!file) {
          results.push({ invoiceNum, success: false, error: 'File not found' });
          continue;
        }

        const tmpDir = '/tmp';
        if (!existsSync(tmpDir)) {
          await mkdir(tmpDir, { recursive: true });
        }

        const arrayBuffer = await file.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);
        const fileExtension = path.extname(file.name) || '.pdf';
        const tempFilePath = path.join(tmpDir, `invoice-${sessionId}-${Date.now()}-${i}${fileExtension}`);
        await writeFile(tempFilePath, fileBuffer);
        tempFilePaths.push(tempFilePath);

        setProgress(taskId, 20 + Math.floor((i / totalInvoices) * 70) + 5, `Filling form for expense ${invoiceNum}/${totalInvoices}...`);
        const selectResult = await selectCategoryAndExpenseType(page, invoice.categoryValue, invoice.expenseTypeValue);
        if (!selectResult.success) {
          results.push({ invoiceNum, success: false, error: selectResult.message });
          continue;
        }

        setProgress(taskId, 20 + Math.floor((i / totalInvoices) * 70) + 10, `Filling form fields for expense ${invoiceNum}/${totalInvoices}...`);
        const fillResult = await fillExpenseForm(page, {
          date: invoice.date,
          amount: parseFloat(invoice.amount),
          merchant: invoice.merchant,
          invoiceNumber: invoice.invoiceNumber || '',
          description: invoice.description,
          categoryValue: invoice.categoryValue,
          expenseTypeValue: invoice.expenseTypeValue,
          filePath: tempFilePath,
        });

        if (!fillResult.success) {
          results.push({ invoiceNum, success: false, error: fillResult.message });
          continue;
        }

        setProgress(taskId, 20 + Math.floor((i / totalInvoices) * 70) + 15, `Saving expense ${invoiceNum}/${totalInvoices}...`);
        await page.waitForTimeout(500);
        
        const saveSelectors = ['#add_exp', 'button#add_exp', 'button.btn-primary#add_exp'];
        let saved = false;
        for (const selector of saveSelectors) {
          try {
            const saveButton = page.locator(selector).first();
            if (await saveButton.count() > 0 && await saveButton.isVisible().catch(() => false)) {
              await saveButton.scrollIntoViewIfNeeded();
              await page.waitForTimeout(200);
              await saveButton.click();
              console.error(`✓ Save button clicked for expense ${invoiceNum}`);
              saved = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (!saved) {
          results.push({ invoiceNum, success: false, error: 'Could not click Save button' });
          continue;
        }

        // Wait for save to complete and page to update
        // Longer wait when there are many expenses (button might be pushed up)
        const waitTime = invoices.length > 5 ? 4000 : 3000;
        await page.waitForTimeout(waitTime);
        
        // Wait for any loading indicators to disappear
        try {
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        } catch (e) {
          // Ignore if networkidle times out
        }

        if (i < invoices.length - 1) {
          setProgress(taskId, 20 + Math.floor((i / totalInvoices) * 70) + 20, `Creating next expense form for ${invoiceNum + 1}/${totalInvoices}...`);
          const createExpenseResult = await clickCreateExpenseButton(page);
          if (!createExpenseResult.success) {
            results.push({ invoiceNum, success: false, error: createExpenseResult.message });
            // Don't continue if we can't create next expense - stop processing
            break;
          }
        }

        results.push({ invoiceNum, success: true });
      } catch (error) {
        results.push({
          invoiceNum,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    for (const filePath of tempFilePaths) {
      try {
        await unlink(filePath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    setProgress(taskId, 100, 'All expenses processed!');

    return NextResponse.json({
      success: true,
      message: `Successfully submitted ${successCount} out of ${invoices.length} expenses`,
      results,
      successCount,
      failedCount,
      totalCount: invoices.length,
    });

  } catch (error) {
    for (const filePath of tempFilePaths) {
      try {
        await unlink(filePath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    console.error('Bulk Submit API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to submit expenses',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
