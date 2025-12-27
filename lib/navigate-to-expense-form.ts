import { Page } from 'playwright';
import { logger } from './logger';

/**
 * Navigate to the expense form in Darwinbox
 * This function assumes the user is already logged in
 */
export async function navigateToExpenseForm(
  page: Page
): Promise<{ success: boolean; message: string }> {
  try {
    logger.info('Step 1: Navigating to Darwinbox home...');
    
    // Navigate to Darwinbox
    await page.goto('https://zepto.darwinbox.in/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForTimeout(3000);

    // Check if logged in
    try {
      await page.waitForSelector('img[src="/images/Icons_latest/attendance.png"]', { timeout: 5000 });
      logger.info('✓ User is logged in');
    } catch (e) {
      return {
        success: false,
        message: 'Not logged in. Please login to Darwinbox first.',
      };
    }

    // Navigate to reimbursements
    logger.info('Step 2: Clicking Reimbursements...');
    await page.click('img[src="/images/Icons_latest/reimbursement.png"]');
    await page.waitForTimeout(3000);

    // Click CREATE button
    logger.info('Step 3: Clicking CREATE button...');
    await page.click('button#createButtonTop');
    await page.waitForTimeout(2000);

    // Click "Request Reimbursement" from dropdown
    logger.info('Step 4: Selecting "Request Reimbursement"...');
    await page.click('a.dropdown-item:has-text("Request Reimbursement")');
    await page.waitForTimeout(3000);

    // Click CREATE on the popup (expense report title)
    logger.info('Step 5: Creating expense report...');
    await page.click('button.db-btn.style-primary:has-text("CREATE")');
    await page.waitForTimeout(4000);

    // Click "+ Create Expense"
    logger.info('Step 6: Clicking "+ Create Expense"...');
    await page.click('a.add_expense_button');
    await page.waitForTimeout(3000);

    // Click "Skip & Add Expenses Manually"
    logger.info('Step 7: Selecting "Skip & Add Expenses Manually"...');
    await page.click('a.add_expense_manual_ocr');
    await page.waitForTimeout(3000);

    // Wait for expense form to be visible
    logger.info('Step 8: Waiting for expense form to load...');
    await page.waitForSelector('#addExpenses', { timeout: 10000 });

    logger.info('✓ Successfully navigated to expense form');
    
    return {
      success: true,
      message: 'Successfully navigated to expense form',
    };

  } catch (error) {
    return {
      success: false,
      message: `Navigation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

