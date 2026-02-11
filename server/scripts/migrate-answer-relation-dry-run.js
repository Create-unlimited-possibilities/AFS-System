import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/afs_db';

const stats = {
  total: 0,
  selfAnswers: 0,
  assistAnswers: 0,
  selfAnswersNeedingMigration: 0,
  assistAnswersWithRelation: 0,
  assistAnswersWithoutRelation: 0,
  alreadyMigrated: 0
};

const previewData = [];

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

async function analyzeAnswer(answer, AssistRelationModel) {

  const { _id, userId, targetUserId, isSelfAnswer, assistRelationId, specificRelation } = answer;

  if (!isSelfAnswer && assistRelationId) {
    stats.alreadyMigrated++;
    return null;
  }

  if (isSelfAnswer) {
    stats.selfAnswers++;
    if (assistRelationId === null && specificRelation === '') {
      return null;
    }
    stats.selfAnswersNeedingMigration++;
    return {
      answerId: _id.toString(),
      userId: userId?.toString(),
      targetUserId: targetUserId?.toString(),
      type: 'self',
      current: { assistRelationId, specificRelation },
      planned: { assistRelationId: null, specificRelation: '' }
    };
    } else {
      stats.assistAnswers++;
      const relation = await AssistRelationModel.findOne({
        assistantId: userId,
        targetId: targetUserId,
        isActive: true
      });

    if (relation) {
      stats.assistAnswersWithRelation++;
      return {
        answerId: _id.toString(),
        userId: userId?.toString(),
        targetUserId: targetUserId?.toString(),
        type: 'assist',
        relationId: relation._id.toString(),
        current: { assistRelationId, specificRelation },
        planned: { 
          assistRelationId: relation._id.toString(), 
          specificRelation: relation.specificRelation || '' 
        }
      };
    } else {
      stats.assistAnswersWithoutRelation++;
      return {
        answerId: _id.toString(),
        userId: userId?.toString(),
        targetUserId: targetUserId?.toString(),
        type: 'assist',
        relationId: null,
        current: { assistRelationId, specificRelation },
        planned: { assistRelationId: null, specificRelation: '' }
      };
    }
  }
}

async function analyzeAnswers() {
  console.log('========== Analyzing Answers ==========');
  const { AnswerModel, AssistRelationModel } = getModels();

  const answers = await AnswerModel.find({}).lean();
  stats.total = answers.length;

  console.log(`Found ${answers.length} answers\n`);

  for (const answer of answers) {
    try {
      const result = await analyzeAnswer(answer, AssistRelationModel);
      if (result) {
        previewData.push(result);
      }
    } catch (error) {
      console.error(`Error analyzing answer ${answer._id}: ${error.message}`);
    }
  }

  console.log('');
}

function printSummary() {
  console.log('========== Dry Run Summary ==========');
  console.log(`Total answers: ${stats.total}`);
  console.log(`Self answers: ${stats.selfAnswers}`);
  console.log(`  - Need migration: ${stats.selfAnswersNeedingMigration}`);
  console.log(`Assist answers: ${stats.assistAnswers}`);
  console.log(`  - Relations found: ${stats.assistAnswersWithRelation}`);
  console.log(`  - Relations not found (orphans): ${stats.assistAnswersWithoutRelation}`);
  console.log(`Already migrated: ${stats.alreadyMigrated}\n`);

  console.log(`Total answers that will be updated: ${stats.selfAnswersNeedingMigration + stats.assistAnswersWithRelation}`);
  console.log(`Total orphan answers: ${stats.assistAnswersWithoutRelation}\n`);

  console.log('=======================================');
}

function printPreview() {
  console.log('========== Migration Preview ==========');
  console.log(`Showing first 10 answers that will be updated:\n`);

  let count = 0;
  for (const item of previewData) {
    if (count >= 10) break;
    console.log(`[${count + 1}] Answer: ${item.answerId}`);
    console.log(`    Type: ${item.type}`);
    console.log(`    User: ${item.userId} -> Target: ${item.targetUserId}`);
    console.log(`    Current: assistRelationId=${item.current.assistRelationId}, specificRelation="${item.current.specificRelation}"`);
    console.log(`    Planned: assistRelationId=${item.planned.assistRelationId}, specificRelation="${item.planned.specificRelation}"`);
    if (item.type === 'assist' && item.relationId === null) {
      console.log(`    ⚠ ORPHAN - No matching AssistRelation found`);
    }
    console.log('');
    count++;
  }

  if (previewData.length > 10) {
    console.log(`... and ${previewData.length - 10} more\n`);
  }
  console.log('=======================================');
}

async function main() {
  let connectedUri = '';
  try {
    connectedUri = await connectToMongo();

    await analyzeAnswers();
    printSummary();
    printPreview();

  } catch (error) {
    console.error('\n✗ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

main();
