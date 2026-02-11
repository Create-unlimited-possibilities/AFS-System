import 'dotenv/config';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/afs_db';
const BATCH_SIZE = 100;
const BACKUP_DIR = path.join(__dirname, '..', 'backups', `answer-relation-migration-${Date.now()}`);

const stats = {
  total: 0,
  processed: 0,
  skipped: 0,
  updated: 0,
  orphans: 0,
  errors: 0,
  selfAnswers: 0,
  assistAnswers: 0,
  relationsFound: 0,
  relationsNotFound: 0
};

const orphanRecords = [];

async function connectToMongo() {
  const uris = [
    MONGO_URI,
    'mongodb://127.0.0.1:27018/afs_db',
    'mongodb://localhost:27018/afs_db'
  ];

  for (const uri of uris) {
    try {
      console.log(`Attempting to connect to: ${uri}`);
      await mongoose.connect(uri);
      console.log('✓ Connected to MongoDB\n');
      return uri;
    } catch (error) {
      console.log(`  Failed: ${error.message}`);
      continue;
    }
  }
  throw new Error('Could not connect to any MongoDB instance');
}

function getModels() {
  const AnswerModel = mongoose.models.Answer || mongoose.model('Answer', new mongoose.Schema({}, { strict: false }));
  const AssistRelationModel = mongoose.models.AssistRelation || mongoose.model('AssistRelation', new mongoose.Schema({}, { strict: false }));
  return { AnswerModel, AssistRelationModel };
}

async function backupAnswers() {
  console.log('========== Creating Backup ==========');
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    console.log(`Backup directory: ${BACKUP_DIR}`);

    const { AnswerModel } = getModels();
    const answers = await AnswerModel.find({}).lean();

    const backupFile = path.join(BACKUP_DIR, 'answers-backup.json');
    await fs.writeFile(backupFile, JSON.stringify(answers, null, 2), 'utf-8');
    console.log(`✓ Backed up ${answers.length} answers to ${backupFile}\n`);
    return answers.length;
  } catch (error) {
    console.error(`✗ Backup failed: ${error.message}\n`);
    throw error;
  }
}

async function migrateAnswer(answer, AnswerModel, AssistRelationModel) {
  const { _id, userId, targetUserId, isSelfAnswer, assistRelationId, specificRelation } = answer;

  if (!isSelfAnswer && assistRelationId) {
    stats.skipped++;
    return { status: 'skipped', reason: 'Already migrated' };
  }

  if (isSelfAnswer) {
    stats.selfAnswers++;
    if (assistRelationId === null && specificRelation === '') {
      stats.skipped++;
      return { status: 'skipped', reason: 'Self answer already set correctly' };
    }

    await AnswerModel.updateOne(
      { _id },
      { 
        assistRelationId: null,
        specificRelation: ''
      }
    );
    stats.updated++;
    return { status: 'updated', type: 'self' };
  } else {
    stats.assistAnswers++;
    const relation = await AssistRelationModel.findOne({
      assistantId: userId,
      targetId: targetUserId,
      isActive: true
    });

    if (relation) {
      stats.relationsFound++;
      await AnswerModel.updateOne(
        { _id },
        {
          assistRelationId: relation._id,
          specificRelation: relation.specificRelation || ''
        }
      );
      stats.updated++;
      return { 
        status: 'updated', 
        type: 'assist',
        assistRelationId: relation._id.toString(),
        specificRelation: relation.specificRelation
      };
    } else {
      stats.relationsNotFound++;
      stats.orphans++;
      orphanRecords.push({
        answerId: _id.toString(),
        userId: userId?.toString(),
        targetUserId: targetUserId?.toString(),
        questionId: answer.questionId?.toString(),
        questionLayer: answer.questionLayer,
        createdAt: answer.createdAt
      });
      return { status: 'orphan' };
    }
  }
}

async function migrateAnswers() {
  console.log('========== Migrating Answers ==========');
  const { AnswerModel, AssistRelationModel } = getModels();

  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await AnswerModel.find({})
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`Processing batch ${skip / BATCH_SIZE + 1} (${batch.length} answers)...`);

    for (const answer of batch) {
      stats.total++;
      try {
        const result = await migrateAnswer(answer, AnswerModel, AssistRelationModel);
        stats.processed++;
        if (result.status === 'updated') {
          console.log(`  ✓ Updated answer ${answer._id.toString()}`);
        } else if (result.status === 'orphan') {
          console.log(`  ⚠ Orphan answer: ${answer._id.toString()} (userId: ${answer.userId?.toString()}, target: ${answer.targetUserId?.toString()})`);
        }
      } catch (error) {
        stats.errors++;
        console.error(`  ✗ Error processing answer ${answer._id.toString()}: ${error.message}`);
      }
    }

    skip += BATCH_SIZE;
  }

  console.log('');
}

async function saveOrphanReport() {
  if (orphanRecords.length === 0) {
    console.log('No orphan records to report.\n');
    return;
  }

  console.log('========== Saving Orphan Report ==========');
  try {
    const reportFile = path.join(BACKUP_DIR, 'orphan-records.json');
    await fs.writeFile(reportFile, JSON.stringify(orphanRecords, null, 2), 'utf-8');
    console.log(`✓ Saved ${orphanRecords.length} orphan records to ${reportFile}\n`);
  } catch (error) {
    console.error(`✗ Failed to save orphan report: ${error.message}\n`);
  }
}

function printSummary() {
  console.log('========== Migration Summary ==========');
  console.log(`Total answers scanned: ${stats.total}`);
  console.log(`Processed: ${stats.processed}`);
  console.log(`Skipped (already correct): ${stats.skipped}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Orphans (no relation found): ${stats.orphans}`);
  console.log(`Errors: ${stats.errors}\n`);

  console.log('Breakdown by type:');
  console.log(`  Self answers: ${stats.selfAnswers}`);
  console.log(`  Assist answers: ${stats.assistAnswers}\n`);

  if (stats.assistAnswers > 0) {
    console.log('Assist answers processing:');
    console.log(`  Relations found: ${stats.relationsFound}`);
    console.log(`  Relations not found: ${stats.relationsNotFound}\n`);
  }

  console.log('=======================================');

  if (stats.errors > 0) {
    console.log(`\n⚠️  Migration completed with ${stats.errors} error(s)`);
  } else if (stats.orphans > 0) {
    console.log(`\n⚠️  Migration completed but ${stats.orphans} orphan record(s) need manual review`);
  } else {
    console.log('\n✅ Migration completed successfully');
  }
}

async function main() {
  let connectedUri = '';
  try {
    connectedUri = await connectToMongo();

    await backupAnswers();
    await migrateAnswers();
    await saveOrphanReport();
    printSummary();

    if (stats.errors > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n✗ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

main();
