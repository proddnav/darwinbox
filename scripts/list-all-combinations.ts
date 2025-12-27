import * as fs from 'fs';
import * as path from 'path';

// Read categories
const projectRoot = process.cwd();
const categoriesPath = path.join(projectRoot, 'lib/reimbursement-categories.json');
const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'));

console.log('=== ALL CATEGORY × EXPENSE TYPE COMBINATIONS ===\n');
console.log('Total Categories: ', categories.length);
console.log('Total Combinations: ', categories.reduce((sum: number, cat: any) => sum + cat.expenseTypes.length, 0));
console.log('\n' + '='.repeat(80) + '\n');

let totalCount = 0;

categories.forEach((category: any, catIdx: number) => {
  console.log(`\n${catIdx + 1}. CATEGORY: ${category.title} (${category.value})`);
  console.log(`   Expense Types: ${category.expenseTypes.length}`);
  console.log('   ' + '-'.repeat(70));
  
  category.expenseTypes.forEach((expType: any, expIdx: number) => {
    totalCount++;
    console.log(`   ${catIdx + 1}.${expIdx + 1}. ${expType.title}`);
    console.log(`      Value: ${expType.value}`);
  });
});

console.log(`\n${'='.repeat(80)}`);
console.log(`\nTOTAL COMBINATIONS: ${totalCount}`);
console.log('\nPlease select which combinations you want to automate for v1.\n');

// Also create a JSON file with numbered combinations for easy reference
const combinations = [];
categories.forEach((category: any, catIdx: number) => {
  category.expenseTypes.forEach((expType: any, expIdx: number) => {
    combinations.push({
      id: `${catIdx + 1}.${expIdx + 1}`,
      categoryTitle: category.title,
      categoryValue: category.value,
      expenseTypeTitle: expType.title,
      expenseTypeValue: expType.value,
    });
  });
});

const outputPath = path.join(projectRoot, 'lib/all-combinations-list.json');
fs.writeFileSync(outputPath, JSON.stringify(combinations, null, 2));
console.log(`\n✓ Combinations list saved to: ${outputPath}`);
console.log('   You can use this file to reference combinations by ID.\n');

