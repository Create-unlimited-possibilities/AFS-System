import mongoose from 'mongoose';
import fs from 'fs';
import Question from '../src/models/Question.js';

await mongoose.connect('mongodb://127.0.0.1:27018/afs_db');

import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const significanceData = JSON.parse(fs.readFileSync(path.join(__dirname, 'significance-data.json'), 'utf8'));

console.log(`Loaded ${significanceData.length} significance entries`);

let updatedCount = 0;
let notFoundCount = 0;

for (const entry of significanceData) {
  const question = await Question.findOne({ 
    role: entry.role, 
    layer: entry.layer, 
    order: entry.order 
  });
  
  if (question) {
    question.significance = entry.significance;
    await question.save();
    updatedCount++;
    console.log(`Updated: ${entry.role}/${entry.layer}/${entry.order}`);
  } else {
    notFoundCount++;
    console.warn(`Not found: ${entry.role}/${entry.layer}/${entry.order}`);
  }
}

console.log(`\n========== Import Summary ==========`);
console.log(`Updated: ${updatedCount}`);
console.log(`Not found: ${notFoundCount}`);
console.log(`======================================`);

await mongoose.disconnect();
