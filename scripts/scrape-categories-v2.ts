import { firefox, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

interface ExpenseType {
  value: string;
  title: string;
}

interface Category {
  value: string;
  title: string;
  expenseTypes: ExpenseType[];
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

async function scrapeCategories(): Promise<Category[]> {
  const browser = await initBrowser();
  const page = browser.pages()[0] || await browser.newPage();
  
  const categories: Category[] = [];

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
      console.log('Waiting for login...');
      await page.waitForSelector('img[src="/images/Icons_latest/attendance.png"]', { timeout: 300000 });
      console.log('✓ Login detected');
    }

    // Click Reimbursements icon
    console.log('Step 3: Clicking Reimbursements icon...');
    await page.click('img[src="/images/Icons_latest/reimbursement.png"]');
    console.log('✓ Reimbursements clicked');
    await page.waitForTimeout(3000);

    // Click CREATE button
    console.log('Step 4: Clicking CREATE button...');
    await page.click('button#createButtonTop');
    console.log('✓ CREATE button clicked');
    await page.waitForTimeout(2000);

    // Click "Request Reimbursement" from dropdown
    console.log('Step 5: Clicking "Request Reimbursement"...');
    await page.click('a.dropdown-item:has-text("Request Reimbursement")');
    console.log('✓ Request Reimbursement clicked');
    await page.waitForTimeout(3000);

    // Fill or use default title, then click CREATE
    console.log('Step 6: Creating expense report...');
    await page.click('button.db-btn.style-primary:has-text("CREATE")');
    console.log('✓ Expense report created');
    await page.waitForTimeout(4000);

    // Click "+ Create Expense" button
    console.log('Step 7: Clicking "+ Create Expense"...');
    await page.click('a.add_expense_button');
    console.log('✓ Create Expense clicked');
    await page.waitForTimeout(3000);

    // Click "Skip & Add Expenses Manually"
    console.log('Step 8: Clicking "Skip & Add Expenses Manually"...');
    await page.click('a.add_expense_manual_ocr');
    console.log('✓ Manual entry selected');
    await page.waitForTimeout(3000);

    // Find all category options
    console.log('\nStep 9: Extracting categories...');
    
    // Wait for form to be ready
    await page.waitForTimeout(2000);
    
    // Find the first search input (category dropdown)
    console.log('  Finding category dropdown...');
    const categoryInput = page.locator('input.search').first();
    
    // Try multiple methods to open the dropdown
    console.log('  Attempting to open category dropdown...');
    
    // Method 1: Focus and click the input
    await categoryInput.focus();
    await categoryInput.click({ force: true });
    await page.waitForTimeout(1000);
    
    // Method 2: Use JavaScript to trigger dropdown
    const dropdownOpened = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input.search');
      if (inputs[0]) {
        const input = inputs[0] as HTMLInputElement;
        
        // Try to find parent dropdown container
        let dropdown: HTMLElement | null = null;
        let element: HTMLElement | null = input;
        
        // Walk up the DOM to find dropdown container
        while (element && !dropdown) {
          if (element.classList.contains('ui') && element.classList.contains('dropdown')) {
            dropdown = element;
            break;
          }
          element = element.parentElement;
        }
        
        if (dropdown) {
          // Click the dropdown container
          dropdown.click();
          return true;
        } else {
          // Fallback: try clicking input and dispatching events
          input.focus();
          input.click();
          input.dispatchEvent(new Event('focus', { bubbles: true }));
          input.dispatchEvent(new Event('click', { bubbles: true }));
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          return false;
        }
      }
      return false;
    });
    
    await page.waitForTimeout(2000);
    
    // Check if menu is visible - don't wait for it, just check
    const menuVisible = await page.evaluate(() => {
      const menus = document.querySelectorAll('div.menu');
      for (const menu of Array.from(menus)) {
        const style = window.getComputedStyle(menu);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          return true;
        }
      }
      return false;
    });
    
    if (!menuVisible) {
      console.log('  ⚠️  Menu not visible, trying alternative method...');
      // Try clicking the input again
      await categoryInput.click({ force: true });
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(2000);
    }
    
    // Get all category items - don't wait for visibility, just get all items
    const categoryItems = await page.locator('div.menu div.item[data-value]').all();
    console.log(`  Found ${categoryItems.length} category items\n`);

    // Iterate through each category
    for (let i = 0; i < categoryItems.length; i++) {
      const categoryItem = categoryItems[i];
      const categoryValue = await categoryItem.getAttribute('data-value');
      const categoryTitle = await categoryItem.getAttribute('title') || await categoryItem.textContent() || '';

      if (!categoryValue || categoryValue === '') {
        continue;
      }

      console.log(`[${i + 1}/${categoryItems.length}] Processing: ${categoryTitle.trim()}`);

      // Click on this category using JavaScript
      await categoryItem.evaluate((el) => {
        (el as HTMLElement).click();
      });
      
      await page.waitForTimeout(2500); // Wait for expense type dropdown to load

      // Now find expense type dropdown
      const expenseTypeInputs = await page.locator('input.search').all();
      console.log(`  → Category selected, found ${expenseTypeInputs.length} dropdowns`);
      
      if (expenseTypeInputs.length > 1) {
        // Click on the second search input (expense type) to open its dropdown
        console.log(`  Opening expense type dropdown...`);
        await expenseTypeInputs[1].focus();
        await expenseTypeInputs[1].click({ force: true });
        
        // Use JavaScript to trigger dropdown
        await page.evaluate(() => {
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
            
            if (dropdown) {
              dropdown.click();
            } else {
              input.focus();
              input.click();
              input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            }
          }
        });
        
        await page.waitForTimeout(2000);
        
        // Try pressing arrow down to open dropdown if not visible
        const expenseMenuVisible = await page.evaluate(() => {
          const menus = document.querySelectorAll('div.menu');
          for (const menu of Array.from(menus)) {
            const style = window.getComputedStyle(menu);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              return true;
            }
          }
          return false;
        });
        
        if (!expenseMenuVisible) {
          await expenseTypeInputs[1].click({ force: true });
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(1500);
        }

        // Get all expense type options - get all items, filter empty ones later
        const expenseTypeItems = await page.locator('div.menu div.item[data-value]').all();
        
        const expenseTypes: ExpenseType[] = [];
        
        for (const expenseTypeItem of expenseTypeItems) {
          const expenseValue = await expenseTypeItem.getAttribute('data-value');
          const expenseTitle = await expenseTypeItem.getAttribute('title') || await expenseTypeItem.textContent() || '';
          
          // Skip placeholder items
          if (expenseValue && expenseValue !== '' && 
              expenseTitle.trim() !== 'Select Expense Category' &&
              !expenseTitle.trim().toLowerCase().includes('select')) {
            expenseTypes.push({
              value: expenseValue,
              title: expenseTitle.trim(),
            });
          }
        }

        console.log(`  ✓ Found ${expenseTypes.length} expense types`);
        
        categories.push({
          value: categoryValue,
          title: categoryTitle.trim(),
          expenseTypes: expenseTypes,
        });

        // Click back on category input to reset for next category
        await page.evaluate(() => {
          const inputs = document.querySelectorAll('input.search');
          if (inputs[0]) {
            const input = inputs[0] as HTMLElement;
            input.click();
          }
        });
        
        await page.waitForTimeout(1500);
      } else {
        console.log(`  ⚠️  Only 1 dropdown found, skipping expense types`);
      }
    }

    console.log('\n✓ Scraping complete!');
    console.log(`\nFound ${categories.length} categories with expense types`);

    // Save to file
    const projectRoot = process.cwd();
    const outputPath = path.join(projectRoot, 'lib/reimbursement-categories.json');
    fs.writeFileSync(outputPath, JSON.stringify(categories, null, 2));
    console.log(`\n✓ Categories saved to: ${outputPath}`);

    return categories;

  } catch (error) {
    console.error('\n❌ Error during scraping:', error);
    console.log('\nCurrent URL:', page.url());
    throw error;
  } finally {
    console.log('\nBrowser will stay open. Press Ctrl+C to close.');
    // Keep browser open - user can close manually
  }
}

// Run the scraper
scrapeCategories()
  .then((categories) => {
    console.log('\n=== SCRAPED CATEGORIES ===');
    categories.forEach((cat, index) => {
      console.log(`\n${index + 1}. ${cat.title} (${cat.value}):`);
      cat.expenseTypes.forEach((et, idx) => {
        console.log(`   ${idx + 1}. ${et.title} (${et.value})`);
      });
    });
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Scraping failed:', error);
    process.exit(1);
  });

