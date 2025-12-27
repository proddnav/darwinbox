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

// Selected combinations for v1
const SELECTED_IDS = ['2.1', '2.5', '2.7', '3.1', '3.2', '3.3', '5.1'];

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
  
  await page.waitForTimeout(4000);
  await page.waitForSelector('#addExpenses', { timeout: 10000 });
  const addExpensesContainer = page.locator('#addExpenses');
  await page.waitForTimeout(2000);
  
  const allInputs = await addExpensesContainer.locator('input, textarea, select').all();
  
  for (const input of allInputs) {
    try {
      const tagName = await input.evaluate(el => el.tagName.toLowerCase());
      const type = await input.getAttribute('type') || tagName;
      const name = await input.getAttribute('name') || '';
      const id = await input.getAttribute('id') || '';
      const placeholder = await input.getAttribute('placeholder') || '';
      const readonly = await input.getAttribute('readonly') !== null;

      if (type === 'hidden' && !name.includes('UserExpensesForm')) {
        continue;
      }

      const isVisible = await input.isVisible().catch(() => false);
      if (type !== 'hidden' && !isVisible) {
        continue;
      }

      // Get label
      let label = '';
      try {
        if (id) {
          label = await addExpensesContainer.locator(`label[for="${id}"]`).first().textContent() || '';
        }
        if (!label) {
          const formGroup = await input.locator('xpath=ancestor::div[contains(@class, "form-group")]').first();
          label = await formGroup.locator('label').first().textContent() || '';
        }
      } catch (e) {
        label = placeholder || name || id;
      }

      label = label.replace(/\*/g, '').trim();

      const required = await input.getAttribute('required') !== null || 
                       label.includes('*') ||
                       await input.evaluate((el: HTMLElement) => {
                         const label = el.closest('.form-group')?.querySelector('label');
                         return label?.textContent?.includes('*') || false;
                       }) || false;

      let selector = '';
      if (id) {
        selector = `#${id}`;
      } else if (name) {
        selector = `[name="${name}"]`;
      } else {
        selector = tagName;
      }

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
      });
    } catch (e) {
      continue;
    }
  }

  // Remove duplicates
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
  await page.waitForTimeout(2500);

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
  
  await page.waitForTimeout(4000);
  
  try {
    await page.waitForSelector('#expense_fields', { timeout: 5000 });
  } catch (e) {
    // Continue anyway
  }
  
  await page.waitForTimeout(2000);
}

async function analyzeSelectedCombinations(): Promise<CategoryFields[]> {
  const browser = await initBrowser();
  const page = browser.pages()[0] || await browser.newPage();
  
  // Load all combinations
  const projectRoot = process.cwd();
  const combinationsPath = path.join(projectRoot, 'lib/all-combinations-list.json');
  const allCombinations: any[] = JSON.parse(fs.readFileSync(combinationsPath, 'utf-8'));

  // Filter selected combinations
  const selectedCombinations = allCombinations.filter((combo: any) => 
    SELECTED_IDS.includes(combo.id)
  );

  console.log(`\nAnalyzing ${selectedCombinations.length} selected combinations:\n`);
  selectedCombinations.forEach((combo: any) => {
    console.log(`  - ${combo.id}: ${combo.categoryTitle} → ${combo.expenseTypeTitle}`);
  });

  // Group by category
  const categoryMap = new Map<string, any[]>();
  selectedCombinations.forEach((combo: any) => {
    if (!categoryMap.has(combo.categoryValue)) {
      categoryMap.set(combo.categoryValue, []);
    }
    categoryMap.get(combo.categoryValue)!.push(combo);
  });

  const categoryFields: CategoryFields[] = [];

  try {
    console.log('\nStep 1: Navigating to Darwinbox...');
    await page.goto('https://zepto.darwinbox.in/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForTimeout(3000);

    console.log('Step 2: Checking login status...');
    try {
      await page.waitForSelector('img[src="/images/Icons_latest/attendance.png"]', { timeout: 5000 });
      console.log('✓ Already logged in');
    } catch (e) {
      console.log('⚠️ Please login to Darwinbox in the browser window');
      await page.waitForSelector('img[src="/images/Icons_latest/attendance.png"]', { timeout: 300000 });
      console.log('✓ Login detected');
    }

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

    console.log('\nStep 4: Analyzing form fields...\n');

    // Process each category
    for (const [categoryValue, combos] of categoryMap.entries()) {
      const category = combos[0]; // Get category info from first combo
      console.log(`\nCategory: ${category.categoryTitle}`);

      const expenseTypeFields: ExpenseTypeFields[] = [];

      for (let i = 0; i < combos.length; i++) {
        const combo = combos[i];
        console.log(`  [${i + 1}/${combos.length}] ${combo.expenseTypeTitle}...`);

        try {
          await selectCategoryAndExpenseType(page, combo.categoryValue, combo.expenseTypeValue);
          const fields = await getFieldsFromAddExpenses(page);

          console.log(`    ✓ Found ${fields.length} fields`);

          expenseTypeFields.push({
            expenseTypeValue: combo.expenseTypeValue,
            expenseTypeTitle: combo.expenseTypeTitle,
            fields: fields,
          });

          await page.waitForTimeout(1000);
        } catch (error) {
          console.log(`    ✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      categoryFields.push({
        categoryValue: category.categoryValue,
        categoryTitle: category.categoryTitle,
        expenseTypes: expenseTypeFields,
      });
    }

    // Save results
    const outputPath = path.join(projectRoot, 'lib/v1-selected-combinations-fields.json');
    fs.writeFileSync(outputPath, JSON.stringify(categoryFields, null, 2));
    console.log(`\n✓ Form fields analysis saved to: ${outputPath}`);

    // Also create a summary
    const summaryPath = path.join(projectRoot, 'lib/v1-combinations-summary.json');
    const summary = {
      selectedIds: SELECTED_IDS,
      totalCombinations: selectedCombinations.length,
      categories: categoryFields.map(cat => ({
        title: cat.categoryTitle,
        expenseTypes: cat.expenseTypes.map(et => ({
          title: et.expenseTypeTitle,
          fieldCount: et.fields.length,
          requiredFields: et.fields.filter(f => f.required).map(f => ({
            name: f.name,
            label: f.label,
            type: f.type,
          })),
        })),
      })),
    };
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`✓ Summary saved to: ${summaryPath}`);

    return categoryFields;

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    console.log('\nBrowser will stay open. Press Ctrl+C to close.');
  }
}

// Run the analyzer
analyzeSelectedCombinations()
  .then((results) => {
    console.log('\n=== ANALYSIS COMPLETE ===');
    results.forEach((cat) => {
      console.log(`\n${cat.categoryTitle}:`);
      cat.expenseTypes.forEach((exp) => {
        console.log(`  - ${exp.expenseTypeTitle}: ${exp.fields.length} fields`);
        const required = exp.fields.filter(f => f.required);
        if (required.length > 0) {
          console.log(`    Required: ${required.map(f => f.label || f.name).join(', ')}`);
        }
      });
    });
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  });

