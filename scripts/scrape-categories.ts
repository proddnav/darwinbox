import { firefox, BrowserContext, Page } from 'playwright';
import path from 'path';
import os from 'os';
import fs from 'fs';

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
      
      // Wait for login
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
    
    await page.waitForTimeout(1500);

    // Click "Request Reimbursement" from dropdown
    console.log('Step 5: Clicking "Request Reimbursement"...');
    await page.click('a.dropdown-item:has-text("Request Reimbursement")');
    console.log('✓ Request Reimbursement clicked');
    
    await page.waitForTimeout(2000);

    // Fill or use default title, then click CREATE
    console.log('Step 6: Creating expense report...');
    const titleInput = page.locator('input[placeholder="Enter Title"]');
    if (await titleInput.isVisible({ timeout: 2000 })) {
      // Title is auto-filled, just click CREATE
      await page.click('button.db-btn.style-primary:has-text("CREATE")');
    } else {
      // Try finding CREATE button directly
      await page.click('button.db-btn.style-primary');
    }
    console.log('✓ Expense report created');
    
    await page.waitForTimeout(3000);

    // Click "+ Create Expense" button
    console.log('Step 7: Clicking "+ Create Expense"...');
    await page.click('a.add_expense_button');
    console.log('✓ Create Expense clicked');
    
    await page.waitForTimeout(2000);

    // Click "Skip & Add Expenses Manually"
    console.log('Step 8: Clicking "Skip & Add Expenses Manually"...');
    await page.click('a.add_expense_manual_ocr');
    console.log('✓ Manual entry selected');
    
    await page.waitForTimeout(2000);

    // Find all category options
    console.log('Step 9: Extracting categories...');
    
    // Wait for the form to be ready
    await page.waitForTimeout(2000);
    
    // Find all search inputs - first one is category, second is expense type
    const allSearchInputs = await page.locator('input.search').all();
    console.log(`Found ${allSearchInputs.length} search inputs`);
    
    // Click on the expense category dropdown - try clicking the parent dropdown container
    // First, try to find and click the dropdown trigger
    try {
      // Try clicking on the dropdown container that contains the input
      await page.locator('input.search').first().evaluate((el) => {
        // Find parent dropdown container and click it
        const dropdown = (el as HTMLElement).closest('.ui.dropdown, .dropdown, [class*="dropdown"]');
        if (dropdown) {
          (dropdown as HTMLElement).click();
        } else {
          el.click();
        }
      });
    } catch (e) {
      // Fallback: force click using JavaScript
      await page.evaluate(() => {
        const inputs = document.querySelectorAll('input.search');
        if (inputs[0]) {
          (inputs[0] as HTMLElement).click();
        }
      });
    }
    
    await page.waitForTimeout(1500);

    // Get all category items from the dropdown menu
    const categoryItems = await page.locator('div.menu.transition.visible div.item[data-value], div.menu div.item[data-value]').all();
    console.log(`Found ${categoryItems.length} category items`);

    // Iterate through each category
    for (let i = 0; i < categoryItems.length; i++) {
      const categoryItem = categoryItems[i];
      const categoryValue = await categoryItem.getAttribute('data-value');
      const categoryTitle = await categoryItem.getAttribute('title');

      if (!categoryValue || categoryValue === '' || !categoryTitle) {
        continue; // Skip "Select Expense Category" placeholder
      }

      console.log(`\nProcessing category ${i + 1}/${categoryItems.length}: ${categoryTitle}`);

      // Click on this category
      try {
        await categoryItem.click();
      } catch (e) {
        // Try JavaScript click
        await categoryItem.evaluate((el) => (el as HTMLElement).click());
      }
      await page.waitForTimeout(2000);

      // Now find expense type dropdown - wait for it to appear
      const expenseTypeInputs = await page.locator('input.search').all();
      console.log(`  Category selected. Found ${expenseTypeInputs.length} search inputs`);
      
      if (expenseTypeInputs.length > 1) {
        // Click on the second search input (expense type) using JavaScript
        try {
          await expenseTypeInputs[1].evaluate((el) => {
            const dropdown = (el as HTMLElement).closest('.ui.dropdown, .dropdown, [class*="dropdown"]');
            if (dropdown) {
              (dropdown as HTMLElement).click();
            } else {
              el.click();
            }
          });
        } catch (e) {
          await page.evaluate(() => {
            const inputs = document.querySelectorAll('input.search');
            if (inputs[1]) {
              (inputs[1] as HTMLElement).click();
            }
          });
        }
        await page.waitForTimeout(1500);

        // Get all expense type options from the dropdown
        const expenseTypeItems = await page.locator('div.menu.transition.visible div.item[data-value], div.menu div.item[data-value]').all();
        
        const expenseTypes: ExpenseType[] = [];
        
        for (const expenseTypeItem of expenseTypeItems) {
          const expenseValue = await expenseTypeItem.getAttribute('data-value');
          const expenseTitle = await expenseTypeItem.getAttribute('title');
          
          if (expenseValue && expenseValue !== '' && expenseTitle && expenseTitle !== 'Select Expense Category') {
            expenseTypes.push({
              value: expenseValue,
              title: expenseTitle,
            });
          }
        }

        console.log(`  Found ${expenseTypes.length} expense types`);
        
        categories.push({
          value: categoryValue,
          title: categoryTitle,
          expenseTypes: expenseTypes,
        });

        // Click back on category input to reset for next category
        try {
          await page.locator('input.search').first().evaluate((el) => {
            const dropdown = (el as HTMLElement).closest('.ui.dropdown, .dropdown, [class*="dropdown"]');
            if (dropdown) {
              (dropdown as HTMLElement).click();
            } else {
              el.click();
            }
          });
        } catch (e) {
          await page.evaluate(() => {
            const inputs = document.querySelectorAll('input.search');
            if (inputs[0]) {
              (inputs[0] as HTMLElement).click();
            }
          });
        }
        await page.waitForTimeout(1000);
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
    console.error('Error during scraping:', error);
    throw error;
  } finally {
    // Keep browser open so user can see results
    console.log('\nBrowser will stay open. Close it manually when done.');
    // Uncomment to auto-close:
    // await browser.close();
  }
}

// Run the scraper
scrapeCategories()
  .then((categories) => {
    console.log('\n=== SCRAPED CATEGORIES ===');
    categories.forEach((cat) => {
      console.log(`\n${cat.title} (${cat.value}):`);
      cat.expenseTypes.forEach((et) => {
        console.log(`  - ${et.title} (${et.value})`);
      });
    });
  })
  .catch((error) => {
    console.error('Scraping failed:', error);
    process.exit(1);
  });

