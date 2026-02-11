import path from 'path';
import fs from 'fs';

const userdataDir = path.join(process.cwd(), 'storage', 'userdata');
let processedCount = 0;
let skippedCount = 0;
let errorCount = 0;

function processDirectory(dir) {
  try {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        processDirectory(filePath);
      } else if (file.endsWith('.json')) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(content);
          
          if ('significance' in data && data.significance) {
            skippedCount++;
            continue;
          }
          
          let significance = '';
          
          if (data.question && data.question.significance) {
            significance = data.question.significance;
          } else {
            console.warn(`No significance found in: ${filePath}`);
            errorCount++;
            continue;
          }
          
          if (significance) {
            data.significance = significance;
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
            processedCount++;
            console.log(`Processed: ${filePath}`);
          }
        } catch (error) {
          console.error(`Error processing ${filePath}:`, error.message);
          errorCount++;
        }
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err.message);
  }
}

processDirectory(userdataDir);

console.log(`\n========== Migration Summary ==========`);
console.log(`Total processed files: ${processedCount}`);
console.log(`Skipped files: ${skippedCount}`);
console.log(`Error files: ${errorCount}`);
console.log(`======================================`);
