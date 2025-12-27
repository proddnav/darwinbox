import { firefox, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as os from 'os';

async function initBrowser(): Promise<BrowserContext> {
  const profileDir = path.join(os.homedir(), '.darwinbox-browser-data');
  
  const browser = await firefox.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 720 },
    timeout: 30000,
  });

  return browser;
}

async function testSingleCombination() {
  const browser = await initBrowser();
  const page = browser.pages()[0] || await browser.newPage();

  try {
    console.log('Navigating to Darwinbox...');
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
    }

    // Navigate to form
    console.log('Navigating to expense form...');
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

    // Test with one combination: Business Travel Expense → Business Travel - Meals
    const categoryValue = 'a66f40962b1f55';
    const expenseTypeValue = 'a64acfb46e8520';

    console.log('\nSelecting Category: Business Travel Expense...');
    
    // Select category
    await page.evaluate((catValue) => {
      const inputs = document.querySelectorAll('#addExpenses input.search');
      if (inputs[0]) {
        const input = inputs[0] as HTMLInputElement;
        let dropdown: HTMLElement | null = null;
        let element: HTMLElement | null = input;
        while (element && !dropdown) {
          if (element.classList.contains('ui') && element.classList.contains('dropdown')) {
            dropdown = element;
            break;
          }
          element = element.parentElement;
        }
        if (dropdown) dropdown.click();
      }
    }, categoryValue);
    
    await page.waitForTimeout(1500);
    
    const categoryOption = page.locator(`#addExpenses div.menu div.item[data-value="${categoryValue}"]`).first();
    await categoryOption.evaluate((el) => (el as HTMLElement).click());
    await page.waitForTimeout(3000);

    console.log('Selecting Expense Type: Business Travel - Meals...');
    
    // Select expense type
    await page.evaluate((expValue) => {
      const inputs = document.querySelectorAll('#addExpenses input.search');
      if (inputs[1]) {
        const input = inputs[1] as HTMLInputElement;
        let dropdown: HTMLElement | null = null;
        let element: HTMLElement | null = input;
        while (element && !dropdown) {
          if (element.classList.contains('ui') && element.classList.contains('dropdown')) {
            dropdown = element;
            break;
          }
          element = element.parentElement;
        }
        if (dropdown) dropdown.click();
      }
    }, expenseTypeValue);
    
    await page.waitForTimeout(1500);
    
    const expenseTypeOption = page.locator(`#addExpenses div.menu div.item[data-value="${expenseTypeValue}"]`).first();
    await expenseTypeOption.evaluate((el) => (el as HTMLElement).click());
    
    await page.waitForTimeout(5000); // Wait longer for fields

    console.log('\nAnalyzing fields...');
    
    // Get all inputs in #addExpenses
    const inputs = await page.locator('#addExpenses input, #addExpenses textarea, #addExpenses select').all();
    console.log(`Found ${inputs.length} form elements`);
    
    // Log each field
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      try {
        const tagName = await input.evaluate(el => el.tagName.toLowerCase());
        const type = await input.getAttribute('type') || tagName;
        const name = await input.getAttribute('name') || '';
        const id = await input.getAttribute('id') || '';
        const isVisible = await input.isVisible().catch(() => false);
        
        // Get label
        let label = '';
        if (id) {
          try {
            label = await page.locator(`label[for="${id}"]`).first().textContent() || '';
          } catch (e) {}
        }
        
        console.log(`  ${i + 1}. ${tagName} - name: "${name}", id: "${id}", type: "${type}", visible: ${isVisible}, label: "${label.trim()}"`);
      } catch (e) {
        console.log(`  ${i + 1}. Error reading field`);
      }
    }

    console.log('\n✓ Test complete. Browser will stay open for inspection.');
    console.log('Check the browser window to see what fields are visible.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testSingleCombination();

