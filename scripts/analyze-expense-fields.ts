import { firefox, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

interface FormField {
  name: string;
  type: string;
  id?: string;
  label: string;
  placeholder?: string;
  required: boolean;
  selector: string;
  visible: boolean;
  value?: string;
}

interface ExpenseTypeFields {
  expenseTypeValue: string;
  expenseTypeTitle: string;
  fields: FormField[];
}

interface CategoryFields {
  categoryValue: string;
  categoryTitle: string;
  expenseTypes: ExpenseTypeFields[];
}

async function initBrowser(): Promise<BrowserContext> {
  const profileDir = path.join(os.homedir(), '.darwinbox-browser-data');
  
  const browser = await firefox.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 720 },
    timeout: 30000,
  });

  return browser;
}

async function getFieldsFromAddExpenses(page: Page): Promise<FormField[]> {
  const fields: FormField[] = [];
  
  // Wait for form to stabilize and dynamic fields to load
  await page.waitForTimeout(4000);

  // Wait for the addExpenses container to be visible
  await page.waitForSelector('#addExpenses', { timeout: 10000 });
  
  // Focus on the addExpenses container
  const addExpensesContainer = page.locator('#addExpenses');
  
  // Wait a bit more for AJAX-loaded fields
  await page.waitForTimeout(2000);
  
  // Get all form elements within addExpenses (including dynamically loaded ones)
  const allInputs = await addExpensesContainer.locator('input, textarea, select').all();
  
  console.log(`    Found ${allInputs.length} total input elements`);
  
  for (const input of allInputs) {
    try {
      const tagName = await input.evaluate(el => el.tagName.toLowerCase());
      const type = await input.getAttribute('type') || tagName;
      const name = await input.getAttribute('name') || '';
      const id = await input.getAttribute('id') || '';
      const placeholder = await input.getAttribute('placeholder') || '';
      const readonly = await input.getAttribute('readonly') !== null;
      const value = await input.getAttribute('value') || '';
      
      // Skip hidden inputs unless they have meaningful names
      if (type === 'hidden' && !name.includes('UserExpensesForm')) {
        continue;
      }

      // Check if visible
      const isVisible = await input.isVisible().catch(() => false);
      if (type !== 'hidden' && !isVisible) {
        continue;
      }

      // Get label - try multiple methods
      let label = '';
      try {
        // Method 1: Associated label with 'for' attribute
        if (id) {
          const labelElement = addExpensesContainer.locator(`label[for="${id}"]`).first();
          label = await labelElement.textContent() || '';
        }
        
        // Method 2: Parent label
        if (!label) {
          const parentLabel = await input.locator('xpath=ancestor::label').first();
          label = await parentLabel.textContent() || '';
        }
        
        // Method 3: Preceding label
        if (!label) {
          const precedingLabel = await input.locator('xpath=preceding-sibling::label').first();
          label = await precedingLabel.textContent() || '';
        }
        
        // Method 4: Parent form-group label
        if (!label) {
          const formGroup = await input.locator('xpath=ancestor::div[contains(@class, "form-group")]').first();
          const groupLabel = await formGroup.locator('label').first();
          label = await groupLabel.textContent() || '';
        }
      } catch (e) {
        // Use placeholder or name as fallback
        label = placeholder || name || id;
      }

      // Clean label
      label = label.replace(/\*/g, '').trim();

      // Check if required
      const required = await input.getAttribute('required') !== null || 
                       label.includes('*') ||
                       await input.evaluate((el: HTMLElement) => {
                         const label = el.closest('.form-group')?.querySelector('label');
                         return label?.textContent?.includes('*') || false;
                       }) || false;

      // Build selector
      let selector = '';
      if (id) {
        selector = `#${id}`;
      } else if (name) {
        selector = `[name="${name}"]`;
      } else {
        selector = tagName;
      }

      // Skip if no meaningful identifier
      if (!name && !id && type !== 'file') {
        continue;
      }

      fields.push({
        name: name || id || selector,
        type: readonly ? 'date-readonly' : type,
        id: id || undefined,
        label: label,
        placeholder: placeholder || undefined,
        required: required,
        selector: selector,
        visible: isVisible,
        value: value || undefined,
      });
    } catch (e) {
      // Skip this field if we can't analyze it
      continue;
    }
  }

  // Remove duplicates based on name/id
  const uniqueFields = new Map<string, FormField>();
  for (const field of fields) {
    const key = field.id || field.name;
    if (key && !uniqueFields.has(key)) {
      uniqueFields.set(key, field);
    }
  }

  return Array.from(uniqueFields.values());
}

async function selectCategoryAndExpenseType(
  page: Page,
  categoryValue: string,
  expenseTypeValue: string
): Promise<void> {
  // Select category using JavaScript (same method as category scraping)
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
  
  // Click the category option
  const categoryOption = page.locator(`#addExpenses div.menu div.item[data-value="${categoryValue}"]`).first();
  await categoryOption.evaluate((el) => (el as HTMLElement).click());
  await page.waitForTimeout(2500); // Wait for AJAX to load expense types

  // Select expense type using JavaScript
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
  
  // Click the expense type option
  const expenseTypeOption = page.locator(`#addExpenses div.menu div.item[data-value="${expenseTypeValue}"]`).first();
  await expenseTypeOption.evaluate((el) => (el as HTMLElement).click());
  
  // Wait for AJAX to complete and fields to load
  await page.waitForTimeout(4000);
  
  // Wait for the expense_fields div to be present (indicates fields have loaded)
  try {
    await page.waitForSelector('#expense_fields', { timeout: 5000 });
  } catch (e) {
    // If expense_fields doesn't exist, that's okay - fields might still load
    console.log('    Note: #expense_fields not found, continuing...');
  }
  
  // Additional wait for any dynamic content
  await page.waitForTimeout(2000);
}

async function analyzeAllExpenseFields(): Promise<CategoryFields[]> {
  const browser = await initBrowser();
  const page = browser.pages()[0] || await browser.newPage();
  
  // Load categories from JSON
  const projectRoot = process.cwd();
  const categoriesPath = path.join(projectRoot, 'lib/reimbursement-categories.json');
  const categories: any[] = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'));

  const categoryFields: CategoryFields[] = [];

  try {
    console.log('Step 1: Navigating to Darwinbox...');
    await page.goto('https://zepto.darwinbox.in/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForTimeout(3000);

    // Check if logged in
    console.log('Step 2: Checking login status...');
    try {
      await page.waitForSelector('img[src="/images/Icons_latest/attendance.png"]', { timeout: 5000 });
      console.log('✓ Already logged in');
    } catch (e) {
      console.log('⚠️ Please login to Darwinbox in the browser window');
      await page.waitForSelector('img[src="/images/Icons_latest/attendance.png"]', { timeout: 300000 });
      console.log('✓ Login detected');
    }

    // Navigate to expense form
    console.log('\nStep 3: Navigating to expense form...');
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

    console.log('\nStep 4: Analyzing form fields for each Category × Expense Type...\n');

    // Process each category
    for (let catIdx = 0; catIdx < categories.length; catIdx++) {
      const category = categories[catIdx];
      console.log(`\n[${catIdx + 1}/${categories.length}] Category: ${category.title}`);

      const expenseTypeFields: ExpenseTypeFields[] = [];

      // Process each expense type
      for (let expIdx = 0; expIdx < category.expenseTypes.length; expIdx++) {
        const expenseType = category.expenseTypes[expIdx];
        console.log(`  [${expIdx + 1}/${category.expenseTypes.length}] ${expenseType.title}...`);

        try {
          // Select category and expense type
          await selectCategoryAndExpenseType(page, category.value, expenseType.value);
          
          // Get all fields from #addExpenses
          const fields = await getFieldsFromAddExpenses(page);

          console.log(`    ✓ Found ${fields.length} fields`);

          expenseTypeFields.push({
            expenseTypeValue: expenseType.value,
            expenseTypeTitle: expenseType.title,
            fields: fields,
          });

          // Small delay between expense types
          await page.waitForTimeout(1000);
        } catch (error) {
          console.log(`    ✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      categoryFields.push({
        categoryValue: category.value,
        categoryTitle: category.title,
        expenseTypes: expenseTypeFields,
      });
    }

    // Save results
    const outputPath = path.join(projectRoot, 'lib/expense-form-fields.json');
    fs.writeFileSync(outputPath, JSON.stringify(categoryFields, null, 2));
    console.log(`\n✓ Form fields analysis saved to: ${outputPath}`);

    return categoryFields;

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    console.log('\nBrowser will stay open. Press Ctrl+C to close.');
  }
}

// Run the analyzer
analyzeAllExpenseFields()
  .then((results) => {
    console.log('\n=== ANALYSIS COMPLETE ===');
    results.forEach((cat, idx) => {
      console.log(`\n${idx + 1}. ${cat.categoryTitle}:`);
      cat.expenseTypes.forEach((exp) => {
        console.log(`   - ${exp.expenseTypeTitle}: ${exp.fields.length} fields`);
        const requiredFields = exp.fields.filter(f => f.required);
        if (requiredFields.length > 0) {
          console.log(`     Required: ${requiredFields.map(f => f.label || f.name).join(', ')}`);
        }
      });
    });
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  });

