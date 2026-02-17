
const fs = require('fs');
const path = require('path');

const appDirectory = path.join(__dirname, 'app');

function fixIncorrectReplacements(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Only fix ₱{ that are NOT currency-related template literals
    // Currency-related literals contain numbers or toFixed
    let fixedContent = content.replace(/₱\{(?!.*(?:\d|toFixed)).*?\}/g, (match) => {
      return match.replace('₱', '$');
    });
    
    fs.writeFileSync(filePath, fixedContent, 'utf8');
    console.log(`Fixed: ${filePath}`);
  } catch (error) {
    console.error(`Error fixing ${filePath}:`, error);
  }
}

function traverseDirectory(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      traverseDirectory(fullPath);
    } else if (file.endsWith('.tsx')) {
      fixIncorrectReplacements(fullPath);
    }
  });
}

console.log('Fixing incorrect currency replacements...');
traverseDirectory(appDirectory);
console.log('Fix complete!');
