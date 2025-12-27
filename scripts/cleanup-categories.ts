import * as fs from 'fs';
import * as path from 'path';

interface ExpenseType {
  value: string;
  title: string;
}

interface Category {
  value: string;
  title: string;
  expenseTypes: ExpenseType[];
}

// Read the scraped categories
const projectRoot = process.cwd();
const inputPath = path.join(projectRoot, 'lib/reimbursement-categories.json');
const categories: Category[] = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

// Get all main category values to filter them out from expense types
const mainCategoryValues = new Set(categories.map(cat => cat.value));

// Clean up each category's expense types
const cleanedCategories: Category[] = categories
  .filter(cat => cat.value && cat.value !== '0' && cat.title !== 'Select Expense type')
  .map(cat => {
    // Filter out main categories from expense types (they're not expense types, they're parent categories)
    const actualExpenseTypes = cat.expenseTypes.filter(et => 
      !mainCategoryValues.has(et.value) && et.value && et.value !== ''
    );
    
    return {
      value: cat.value,
      title: cat.title,
      expenseTypes: actualExpenseTypes,
    };
  })
  .filter(cat => cat.expenseTypes.length > 0); // Only keep categories with actual expense types

// Save cleaned data
const outputPath = path.join(projectRoot, 'lib/reimbursement-categories.json');
fs.writeFileSync(outputPath, JSON.stringify(cleanedCategories, null, 2));

console.log(`✓ Cleaned categories saved to: ${outputPath}`);
console.log(`\nSummary:`);
console.log(`  Total categories: ${cleanedCategories.length}`);
cleanedCategories.forEach(cat => {
  console.log(`  - ${cat.title}: ${cat.expenseTypes.length} expense types`);
});

