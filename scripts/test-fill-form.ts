import { firefox, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import { fillExpenseForm, selectCategoryAndExpenseType } from '../lib/fill-expense-form';

async function initBrowser(): Promise<BrowserContext> {
  const profileDir = path.join(os.homedir(), '.darwinbox-browser-data');
  
  const browser = await firefox.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 720 },
    timeout: 30000,
  });

  return browser;
}

async function testFillForm() {
  const browser = await initBrowser();
  const page = browser.pages()[0] || await browser.newPage();

  try {
    console.log('Step 1: Navigating to Darwinbox...');
    await page.goto('https://zepto.darwinbox.in/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForTimeout(3000);

    // Check login
    try {
      await page.waitForSelector('img[src="/images/Icons_latest/attendance.png"]', { timeout: 5000 });
      console.log('✓ Logged in');
    } catch (e) {
      console.log('Please login...');
      await page.waitForSelector('img[src="/images/Icons_latest/attendance.png"]', { timeout: 300000 });
      console.log('✓ Login detected');
    }

    // Navigate to form
    console.log('\nStep 2: Navigating to expense form...');
    await page.click('img[src="/images/Icons_latest/reimbursement.png"]');
    await page.waitForTimeout(3000);
    await page.click('button#createButtonTop');
    await page.waitForTimeout(2000);
    await page.click('a.dropdown-item:has-text("Request Reimbursement")');
    await page.waitForTimeout(3000);
    await page.click('button.db-btn.style-primary:has-text("CREATE")');
    await page.waitForTimeout(4000);
    await page.click('a.add_expense_button');
    await page.waitForTimeout(3000);
    await page.click('a.add_expense_manual_ocr');
    await page.waitForTimeout(3000);

    // Test with combination 2.1: Business Travel - Airport Transfer
    console.log('\nStep 3: Selecting Category and Expense Type (2.1)...');
    const selectResult = await selectCategoryAndExpenseType(
      page,
      'a66f40962b1f55', // Business Travel Expense
      'a64aea39add3ea'  // Business Travel - Airport Transfer
    );

    if (!selectResult.success) {
      console.error('❌ Failed to select category/expense type:', selectResult.message);
      return;
    }

    console.log('Step 4: Filling form fields...\n');
    
    // Fill form with test data - use today's date (can't use future dates)
    const today = new Date();
    const todayFormatted = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;
    const todayYYYYMMDD = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    
    const fillResult = await fillExpenseForm(page, {
      date: todayYYYYMMDD, // Use today's date (past/today dates only allowed)
      amount: 1500,
      merchant: 'Uber',
      invoiceNumber: 'UBR-2026-001',
      description: 'Airport transfer from office to airport',
      categoryValue: 'a66f40962b1f55',
      expenseTypeValue: 'a64aea39add3ea',
    });

    if (fillResult.success) {
      console.log('\n✅ Form filled successfully!');
      console.log('\nForm Status:');
      console.log(`  ✓ Expense Date: ${todayFormatted} (today's date)`);
      console.log('  ✓ Amount: 1500 INR');
      console.log('  ✓ Merchant: Uber');
      console.log('  ✓ Invoice Number: UBR-2026-001');
      console.log('  ✓ Description: Airport transfer from office to airport');
      console.log('\n⚠️  File upload not included (as requested)');
      console.log('\nBrowser will stay open. Please verify the form fields are filled correctly.');
      console.log('You can manually upload the invoice and submit if everything looks good.');
    } else {
      console.error('\n❌ Failed to fill form:', fillResult.message);
    }

    // Keep browser open
    console.log('\nPress Ctrl+C to close the browser.');
    await new Promise(() => {}); // Keep script running
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testFillForm();

