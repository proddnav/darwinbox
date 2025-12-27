import { Page } from 'playwright';
import { logger } from './logger';

export interface ExpenseFormData {
  date: string; // Format: DD-MM-YYYY or YYYY-MM-DD
  amount: number;
  merchant: string;
  invoiceNumber: string;
  description: string;
  categoryValue: string;
  expenseTypeValue: string;
  filePath?: string; // Optional path to invoice file for upload
}

/**
 * Fill expense form fields in Darwinbox
 * Note: Currency defaults to INR, no need to set it
 * File upload happens automatically if filePath is provided
 */
export async function fillExpenseForm(
  page: Page,
  data: ExpenseFormData
): Promise<{ success: boolean; message: string }> {
  try {
    // Convert date to DD-MM-YYYY if needed
    const formatDate = (dateStr: string): string => {
      // If format is YYYY-MM-DD, convert to DD-MM-YYYY
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const parts = dateStr.split('-');
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dateStr;
    };

    const formattedDate = formatDate(data.date);

    // Fill text fields FIRST, then date LAST (as requested)

    // 1. Fill Amount
    logger.info('Filling Amount...');
    try {
      // Wait for amount field
      await page.waitForTimeout(300);
      
      // Try visible amount input first
      const amountInput = page.locator('input.amount').first();
      const amountExists = await amountInput.count() > 0;
      
      if (amountExists) {
        await amountInput.scrollIntoViewIfNeeded();
        await amountInput.click({ force: true });
        await page.waitForTimeout(100);
        await amountInput.fill('');
        await amountInput.type(data.amount.toString(), { delay: 30 });
        
        // Trigger events
        await amountInput.evaluate((el) => {
          (el as HTMLInputElement).dispatchEvent(new Event('input', { bubbles: true }));
          (el as HTMLInputElement).dispatchEvent(new Event('change', { bubbles: true }));
        });
        await page.waitForTimeout(200);
      }
      
      // Also fill hidden amount field (only if visible input worked)
      try {
        const hiddenAmount = page.locator('input[name="UserExpensesForm[amount]"][type="hidden"]').first();
        if (await hiddenAmount.count() > 0) {
          // Use evaluate to set value directly on hidden field
          await hiddenAmount.evaluate((el, value) => {
            (el as HTMLInputElement).value = value;
            (el as HTMLInputElement).dispatchEvent(new Event('change', { bubbles: true }));
          }, data.amount.toString());
        }
      } catch (e) {
        // Hidden field fill failed, but visible input should have worked
      }
      logger.info('✓ Amount filled');
    } catch (e) {
      logger.info(`✗ Error filling Amount: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    // 3. Fill Merchant
    logger.info('Filling Merchant...');
    try {
      // Wait for merchant field to be available
      await page.waitForSelector('#UserExpensesForm_merchant, input[name="UserExpensesForm[merchant]"]', { timeout: 5000 });
      
      const merchantInput = page.locator('#UserExpensesForm_merchant, input[name="UserExpensesForm[merchant]"]').first();
      await merchantInput.scrollIntoViewIfNeeded();
      await merchantInput.click({ force: true });
      await page.waitForTimeout(100);
      
      // Clear existing value if any
      await merchantInput.fill('');
      await page.waitForTimeout(100);
      
      // Type the value
      await merchantInput.type(data.merchant, { delay: 30 });
      await page.waitForTimeout(150);
      logger.info('✓ Merchant filled');
    } catch (e) {
      logger.info(`✗ Error filling Merchant: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    // 4. Fill Invoice Number
    logger.info('Filling Invoice Number...');
    try {
      // Wait for invoice field to be available
      await page.waitForSelector('#UserExpensesForm_invoice_number, input[name="UserExpensesForm[invoice_number]"]', { timeout: 5000 });
      
      const invoiceInput = page.locator('#UserExpensesForm_invoice_number, input[name="UserExpensesForm[invoice_number]"]').first();
      await invoiceInput.scrollIntoViewIfNeeded();
      await invoiceInput.click({ force: true });
      await page.waitForTimeout(100);
      
      // Clear existing value if any
      await invoiceInput.fill('');
      await page.waitForTimeout(100);
      
      // Type the value
      await invoiceInput.type(data.invoiceNumber, { delay: 30 });
      await page.waitForTimeout(150);
      logger.info('✓ Invoice Number filled');
    } catch (e) {
      logger.info(`✗ Error filling Invoice Number: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    // 5. Fill Description
    logger.info('Filling Description...');
    try {
      // Wait for description field to be available
      await page.waitForSelector('#UserExpensesForm_itemName, textarea[name="UserExpensesForm[itemName]"]', { timeout: 5000 });
      
      const descriptionInput = page.locator('#UserExpensesForm_itemName, textarea[name="UserExpensesForm[itemName]"]').first();
      await descriptionInput.scrollIntoViewIfNeeded();
      await descriptionInput.click({ force: true });
      await page.waitForTimeout(100);
      
      // Clear existing value if any
      await descriptionInput.fill('');
      await page.waitForTimeout(100);
      
      // Type the value
      await descriptionInput.type(data.description, { delay: 30 });
      await page.waitForTimeout(150);
      logger.info('✓ Description filled');
    } catch (e) {
      logger.info(`✗ Error filling Description: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    // 6. Fill Expense Date LAST (as requested)
    logger.info('\nFilling Expense Date (last step)...');
    try {
      const dateInput = page.locator('input.expense_date.hasDatepicker, input[name="UserExpensesForm[date]"]').first();
      await dateInput.scrollIntoViewIfNeeded();
      await dateInput.click({ force: true });
      await page.waitForTimeout(800); // Wait for calendar to open (reduced)

      // Wait for calendar to be visible
      await page.waitForSelector('.ui-datepicker, select.ui-datepicker-month', { timeout: 5000 });

      // Parse the date
      const dateParts = formattedDate.split('-');
      const day = parseInt(dateParts[0]); // DD
      const month = parseInt(dateParts[1]) - 1; // MM (0-indexed: 0=Jan, 11=Dec)
      const year = parseInt(dateParts[2]); // YYYY

      logger.info(`  Target date: ${day}-${month + 1}-${year} (picker month index: ${month})`);

      // Select year using JavaScript
      logger.info(`  Selecting year: ${year}`);
      await page.evaluate((year) => {
        const yearSelect = document.querySelector('select.ui-datepicker-year') as HTMLSelectElement;
        if (yearSelect) {
          yearSelect.value = year.toString();
          yearSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, year);
      await page.waitForTimeout(500);

      // Select month using JavaScript
      logger.info(`  Selecting month: ${month + 1} (value: ${month})`);
      await page.evaluate((month) => {
        const monthSelect = document.querySelector('select.ui-datepicker-month') as HTMLSelectElement;
        if (monthSelect) {
          monthSelect.value = month.toString();
          monthSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, month);
      await page.waitForTimeout(800); // Wait for calendar to update (reduced)

      // Wait for date cells
      await page.waitForSelector('td[data-handler="selectDay"]', { timeout: 3000 });
      await page.waitForTimeout(200);

      // Click on the date using JavaScript (wrap args in object)
      logger.info(`  Clicking day: ${day}`);
      const dateClicked = await page.evaluate(({ day, month, year }) => {
        const cells = document.querySelectorAll('td[data-handler="selectDay"]');
        
        for (const cell of Array.from(cells)) {
          const td = cell as HTMLElement;
          const cellMonth = td.getAttribute('data-month');
          const cellYear = td.getAttribute('data-year');
          const link = td.querySelector('a.ui-state-default') as HTMLElement;
          
          if (link && 
              cellMonth === month.toString() && 
              cellYear === year.toString() && 
              link.getAttribute('data-date') === day.toString()) {
            link.click();
            return true;
          }
        }
        return false;
      }, { day, month, year });
      
      await page.waitForTimeout(400);
      
      if (dateClicked) {
        logger.info('✓ Expense Date selected successfully');
      } else {
        logger.info('⚠️  Could not click date via JavaScript. Trying Playwright locator...');
        // Fallback
        try {
          const dateLink = page.locator(
            `td[data-handler="selectDay"][data-month="${month}"][data-year="${year}"] a.ui-state-default[data-date="${day}"]`
          ).first();
          
          if (await dateLink.count() > 0) {
            await dateLink.click();
            await page.waitForTimeout(500);
            logger.info('✓ Expense Date selected (Playwright fallback)');
          } else {
            logger.info('⚠️  Date selection failed. Please select manually in browser.');
          }
        } catch (e) {
          logger.info('⚠️  Date selection failed. Please select manually in browser.');
        }
      }
    } catch (e) {
      logger.info(`✗ Error filling Expense Date: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    // 7. Upload invoice file if provided (AFTER all fields are filled - LAST STEP)
    if (data.filePath) {
      logger.info('\nUploading invoice file (last step after all fields filled)...');
      try {
        await page.waitForTimeout(500); // Wait a bit after date selection
        
        // Wait for file input to be available
        const fileInput = page.locator('#uploadBtn, input[type="file"][name="upload[]"]').first();
        
        // Check if file input exists
        const fileInputCount = await fileInput.count();
        if (fileInputCount > 0) {
          // Upload the file
          await fileInput.setInputFiles(data.filePath);
          logger.info('✓ File uploaded successfully');
          
          // Wait for upload to complete (Darwinbox may show upload progress)
          await page.waitForTimeout(1000);
          
          // Check if upload was successful (look for file name or success indicator)
          try {
            await page.waitForSelector('.file-name, .upload-success, [class*="upload"]', { timeout: 3000 });
            logger.info('✓ Upload confirmed');
          } catch (e) {
            // Upload indicator not found, but file may still be uploaded
            logger.info('⚠️  Upload indicator not found, but file was set');
          }
        } else {
          logger.info('⚠️  File input not found, skipping upload');
        }
      } catch (e) {
        logger.info(`✗ Error uploading file: ${e instanceof Error ? e.message : 'Unknown error'}`);
        // Don't fail the entire operation if file upload fails
      }
    }

  return {
    success: true,
    message: 'All form fields filled successfully',
  };

  } catch (error) {
    return {
      success: false,
      message: `Error filling form: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Submit the expense form by clicking the Save button
 */
export async function submitExpenseForm(
  page: Page
): Promise<{ success: boolean; message: string }> {
  try {
    logger.info('Clicking Save button...');
    await page.waitForTimeout(500);
    
    // Try multiple selectors for the Save button
    const selectors = [
      '#add_exp',
      'button#add_exp',
      'button.btn-primary#add_exp',
      'button.db-btn#add_exp',
      'button.amplify-submit-button#add_exp',
      'button.btn.btn-primary.db-btn.ripple.amplify-submit-button#add_exp',
    ];
    
    let buttonClicked = false;
    for (const selector of selectors) {
      try {
        const saveButton = page.locator(selector).first();
        const buttonCount = await saveButton.count();
        
        if (buttonCount > 0) {
          // Check if button is visible and enabled
          const isVisible = await saveButton.isVisible().catch(() => false);
          if (isVisible) {
            await saveButton.scrollIntoViewIfNeeded();
            await page.waitForTimeout(200);
            await saveButton.click();
            logger.info(`✓ Save button clicked successfully using selector: ${selector}`);
            buttonClicked = true;
            
            // Wait for form submission to process
            await page.waitForTimeout(1500);
            break;
          }
        }
      } catch (e) {
        // Continue to next selector
        continue;
      }
    }
    
    if (!buttonClicked) {
      return {
        success: false,
        message: 'Could not find or click Save button. Please click manually.',
      };
    }
    
    return {
      success: true,
      message: 'Expense form submitted successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: `Error submitting form: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Select category and expense type in the expense form
 */
export async function selectCategoryAndExpenseType(
  page: Page,
  categoryValue: string,
  expenseTypeValue: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Select category
    logger.info('Selecting Category...');
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
    
    await page.waitForTimeout(800);
    
    const categoryOption = page.locator(`#addExpenses div.menu div.item[data-value="${categoryValue}"]`).first();
    await categoryOption.evaluate((el) => (el as HTMLElement).click());
    await page.waitForTimeout(1500); // Reduced wait time
    logger.info('✓ Category selected');

    // Select expense type
    logger.info('Selecting Expense Type...');
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
    
    await page.waitForTimeout(800);
    
    const expenseTypeOption = page.locator(`#addExpenses div.menu div.item[data-value="${expenseTypeValue}"]`).first();
    await expenseTypeOption.evaluate((el) => (el as HTMLElement).click());
    
    await page.waitForTimeout(2000); // Wait for form fields to load (reduced from 4000)
    logger.info('✓ Expense Type selected');

    return {
      success: true,
      message: 'Category and expense type selected successfully',
    };

  } catch (error) {
    return {
      success: false,
      message: `Error selecting category/expense type: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

