import { firefox, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

interface FormField {
  name: string;
  type: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  selector: string;
  options?: string[]; // For dropdowns/selects
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

async function getFormFields(page: Page): Promise<FormField[]> {
  const fields: FormField[] = [];

  // Wait a bit for form to load
  await page.waitForTimeout(2000);

  // Find all input fields
  const inputs = await page.locator('input, textarea, select').all();
  
  for (const input of inputs) {
    try {
      const tagName = await input.evaluate(el => el.tagName.toLowerCase());
      const type = await input.getAttribute('type') || tagName;
      const name = await input.getAttribute('name') || '';
      const id = await input.getAttribute('id') || '';
      const placeholder = await input.getAttribute('placeholder') || '';
      const required = await input.getAttribute('required') !== null;
      
      // Get label (try multiple ways)
      let label = '';
      try {
        const labelElement = await page.locator(`label[for="${id}"]`).first();
        label = await labelElement.textContent() || '';
      } catch (e) {
        // Try finding parent label
        try {
          const parentLabel = await input.locator('xpath=ancestor::label').first();
          label = await parentLabel.textContent() || '';
        } catch (e2) {
          // Try finding nearby label text
          try {
            const nearbyLabel = await input.locator('xpath=preceding-sibling::label').first();
            label = await nearbyLabel.textContent() || '';
          } catch (e3) {
            // Try finding by placeholder or name
            label = placeholder || name;
          }
        }
      }

      // Get selector
      let selector = '';
      if (id) {
        selector = `#${id}`;
      } else if (name) {
        selector = `[name="${name}"]`;
      } else {
        selector = await input.evaluate(el => {
          if (el.id) return `#${el.id}`;
          if (el.name) return `[name="${el.name}"]`;
          return el.tagName.toLowerCase();
        }) as string;
      }

      // For select/dropdown, get options
      let options: string[] = [];
      if (tagName === 'select' || (type === 'text' && selector.includes('search'))) {
        // Try to get dropdown options
        try {
          const optionElements = await page.locator(`${selector} option`).all();
          for (const opt of optionElements) {
            const text = await opt.textContent();
            const value = await opt.getAttribute('value');
            if (text && text.trim() && value) {
              options.push(`${text.trim()} (${value})`);
            }
          }
        } catch (e) {
          // For semantic UI dropdowns, might need different approach
        }
      }

      // Skip hidden inputs
      const isVisible = await input.isVisible().catch(() => false);
      if (!isVisible && type !== 'hidden') {
        continue;
      }

      // Only add if it's a meaningful field (has name, id, or is visible)
      if (name || id || isVisible) {
        fields.push({
          name: name || id || selector,
          type: type,
          label: label.trim(),
          placeholder: placeholder,
          required: required,
          selector: selector,
          options: options.length > 0 ? options : undefined,
        });
      }
    } catch (e) {
      // Skip this input if we can't read it
      continue;
    }
  }

  return fields;
}

async function analyzeCategoryExpenseType(
  page: Page,
  categoryValue: string,
  categoryTitle: string,
  expenseTypeValue: string,
  expenseTypeTitle: string
): Promise<FormField[]> {
  console.log(`    Analyzing: ${expenseTypeTitle}...`);

  // Click category dropdown
  const categoryInput = page.locator('input.search').first();
  await categoryInput.focus();
  await categoryInput.click({ force: true });
  
  await page.evaluate((catValue) => {
    const inputs = document.querySelectorAll('input.search');
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

  // Select category
  const categoryItem = page.locator(`div.menu div.item[data-value="${categoryValue}"]`).first();
  await categoryItem.evaluate((el) => (el as HTMLElement).click());
  await page.waitForTimeout(2000);

  // Click expense type dropdown
  const expenseTypeInputs = await page.locator('input.search').all();
  if (expenseTypeInputs.length > 1) {
    await expenseTypeInputs[1].focus();
    await expenseTypeInputs[1].click({ force: true });
    
    await page.evaluate((expValue) => {
      const inputs = document.querySelectorAll('input.search');
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

    // Select expense type
    const expenseTypeItem = page.locator(`div.menu div.item[data-value="${expenseTypeValue}"]`).first();
    await expenseTypeItem.evaluate((el) => (el as HTMLElement).click());
    await page.waitForTimeout(3000); // Wait for form fields to load
  }

  // Get form fields
  const fields = await getFormFields(page);

  return fields;
}

async function analyzeAllFields(): Promise<CategoryFields[]> {
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

      // Process each expense type in this category
      for (let expIdx = 0; expIdx < category.expenseTypes.length; expIdx++) {
        const expenseType = category.expenseTypes[expIdx];
        console.log(`  [${expIdx + 1}/${category.expenseTypes.length}] Expense Type: ${expenseType.title}`);

        try {
          const fields = await analyzeCategoryExpenseType(
            page,
            category.value,
            category.title,
            expenseType.value,
            expenseType.title
          );

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
    const outputPath = path.join(projectRoot, 'lib/form-fields-mapping.json');
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
analyzeAllFields()
  .then((results) => {
    console.log('\n=== ANALYSIS COMPLETE ===');
    results.forEach((cat, idx) => {
      console.log(`\n${idx + 1}. ${cat.categoryTitle}:`);
      cat.expenseTypes.forEach((exp, expIdx) => {
        console.log(`   ${expIdx + 1}. ${exp.expenseTypeTitle}: ${exp.fields.length} fields`);
        exp.fields.forEach((field, fIdx) => {
          console.log(`      ${fIdx + 1}. ${field.label || field.name} (${field.type})${field.required ? ' *' : ''}`);
        });
      });
    });
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  });

