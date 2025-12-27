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

async function validateCombination21() {
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

    // Combination 2.1: Business Travel Expense → Business Travel - Airport Transfer
    const categoryValue = 'a66f40962b1f55';
    const expenseTypeValue = 'a64aea39add3ea';

    console.log('\nStep 3: Selecting Category: Business Travel Expense...');
    
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

    console.log('Step 4: Selecting Expense Type: Business Travel - Airport Transfer...');
    
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
    
    await page.waitForTimeout(5000); // Wait for fields to load

    console.log('\nStep 5: Analyzing all visible fields...\n');
    
    // Get all visible inputs, textareas, selects in #addExpenses
    const allFields = await page.locator('#addExpenses input:visible, #addExpenses textarea:visible, #addExpenses select:visible').all();
    console.log(`Found ${allFields.length} visible form elements\n`);
    
    const fieldDetails: any[] = [];
    
    for (let i = 0; i < allFields.length; i++) {
      const field = allFields[i];
      try {
        const tagName = await field.evaluate(el => el.tagName.toLowerCase());
        const type = await field.getAttribute('type') || tagName;
        const name = await field.getAttribute('name') || '';
        const id = await field.getAttribute('id') || '';
        const placeholder = await field.getAttribute('placeholder') || '';
        
        // Get label
        let label = '';
        let isRequired = false;
        
        try {
          if (id) {
            const labelElement = page.locator(`label[for="${id}"]`).first();
            label = await labelElement.textContent() || '';
            isRequired = label.includes('*');
          }
          
          // Try parent form-group
          if (!label) {
            const formGroup = await field.locator('xpath=ancestor::div[contains(@class, "form-group")]').first();
            const groupLabel = await formGroup.locator('label').first();
            label = await groupLabel.textContent() || '';
            isRequired = label.includes('*');
          }
        } catch (e) {
          label = placeholder || name || id;
        }
        
        // Clean label
        label = label.replace(/\*/g, '').trim();
        
        // Get selector
        let selector = '';
        if (id) {
          selector = `#${id}`;
        } else if (name) {
          selector = `[name="${name}"]`;
        }
        
        const fieldInfo = {
          index: i + 1,
          tagName,
          type,
          name,
          id,
          label,
          placeholder: placeholder || undefined,
          required: isRequired || await field.getAttribute('required') !== null,
          selector,
        };
        
        fieldDetails.push(fieldInfo);
        
        console.log(`${i + 1}. ${label || name || id} ${isRequired ? '* (required)' : ''}`);
        console.log(`   Type: ${type}, ID: ${id || 'none'}, Name: ${name || 'none'}`);
        console.log(`   Selector: ${selector || 'N/A'}\n`);
        
      } catch (e) {
        console.log(`${i + 1}. Error reading field\n`);
      }
    }

    // Check for Currency and Amount fields (they're in a special container)
    console.log('\nChecking for Currency and Amount fields...');
    const currencyContainer = await page.locator('.dbox-currency-container, .currency').first();
    const currencyExists = await currencyContainer.count() > 0;
    console.log(`Currency container found: ${currencyExists}`);
    
    if (currencyExists) {
      // Try to find currency dropdown
      const currencyDropdown = await page.locator('dbx-dropdown[name="UserExpensesForm[currency]"], select[name="UserExpensesForm[currency]"]').first();
      if (await currencyDropdown.count() > 0) {
        console.log('  ✓ Currency dropdown found');
      }
      
      // Try to find amount input
      const amountInput = await page.locator('input.amount, input[name*="amount"]').first();
      if (await amountInput.count() > 0) {
        const amountName = await amountInput.getAttribute('name');
        const amountId = await amountInput.getAttribute('id');
        console.log(`  ✓ Amount input found - Name: ${amountName}, ID: ${amountId}`);
      }
      
      // Check for hidden amount field
      const hiddenAmount = await page.locator('input[name="UserExpensesForm[amount]"]').first();
      if (await hiddenAmount.count() > 0) {
        console.log(`  ✓ Hidden amount field found - Name: ${await hiddenAmount.getAttribute('name')}`);
      }
    }

    // Check for file upload button
    console.log('\nChecking for file upload...');
    const fileUpload = await page.locator('#uploadBtn').first();
    const fileUploadExists = await fileUpload.count() > 0;
    console.log(`File upload button found: ${fileUploadExists}`);
    if (fileUploadExists) {
      const fileUploadName = await fileUpload.getAttribute('name');
      const fileUploadId = await fileUpload.getAttribute('id');
      console.log(`  ID: ${fileUploadId}, Name: ${fileUploadName}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\nVALIDATION SUMMARY FOR 2.1 (Business Travel - Airport Transfer)\n');
    console.log('='.repeat(80));
    
    // Validate against user's list
    const userFields = [
      { name: 'Expense Date', required: true },
      { name: 'Currency', required: false },
      { name: 'Amount', required: false },
      { name: 'Merchant', required: false },
      { name: 'Invoice number', required: false },
      { name: 'Description', required: true },
      { name: 'File Upload (Browse)', required: false },
    ];
    
    // Note: The script found Merchant and Invoice number as required, but user said they're not
    // This might vary by expense type or configuration
    
    console.log('\nFields you mentioned:');
    userFields.forEach(f => {
      console.log(`  - ${f.name}${f.required ? ' *' : ''}`);
    });
    
    console.log('\nFields found in browser:');
    fieldDetails.forEach(f => {
      console.log(`  - ${f.label}${f.required ? ' *' : ''} (${f.type})`);
    });
    
    console.log('\n✓ Validation complete. Browser will stay open for manual inspection.');
    console.log('Please verify the fields match what you see in the browser.\n');

    // Keep browser open
    await new Promise(() => {}); // Keep script running
    
  } catch (error) {
    console.error('Error:', error);
  }
}

validateCombination21();

