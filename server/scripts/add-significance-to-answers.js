import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import Question from '../src/models/Question.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/afs_db';
await mongoose.connect(MONGO_URI);

const questions = await Question.find({}, 'role layer order significance');
const questionMap = new Map();

questions.forEach(q => {
  const key = `${q.role}_${q.layer}_${q.order}`;
  questionMap.set(key, q.significance || '');
});

console.log(`Loaded ${questionMap.size} questions from database`);

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
          
          const role = data.questionRole;
          const layer = data.questionLayer;
          const order = data.questionOrder;
          
          if (!role || !layer || order === undefined) {
            console.warn(`Missing question metadata in: ${filePath}`);
            errorCount++;
            continue;
          }
          
          const key = `${role}_${layer}_${order}`;
          const significance = questionMap.get(key);
          
          if (significance) {
            data.significance = significance;
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
            processedCount++;
            console.log(`Processed: ${filePath}`);
          } else {
            console.warn(`No significance found for ${role}/${layer}/${order} in ${filePath}`);
            errorCount++;
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

await mongoose.disconnect();
