import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import User from '../src/models/User.js';
import Answer from '../src/models/Answer.js';
import AssistRelation from '../src/models/AssistRelation.js';
import ChatSession from '../src/models/ChatSession.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/afs_db';
const DATA_PATH = path.join(process.cwd(), 'server', 'storage', 'userdata');

const results = {
  users: {
    mongoCount: 0,
    fsCount: 0,
    onlyInMongo: [],
    onlyInFs: [],
    consistencyPercent: 0
  },
  answers: {
    mongoCount: 0,
    fsCount: 0,
    onlyInMongo: [],
    onlyInFs: [],
    consistencyPercent: 0
  },
  assistRelations: {
    mongoCount: 0,
    fsCount: 0,
    onlyInMongo: [],
    onlyInFs: [],
    consistencyPercent: 0
  },
  chatSessions: {
    mongoCount: 0,
    fsCount: 0,
    onlyInMongo: [],
    onlyInFs: [],
    consistencyPercent: 0
  }
};

async function checkUsers() {
  console.log('\n========== Checking Users ==========');
  
  const mongoUsers = await User.find({}).lean();
  results.users.mongoCount = mongoUsers.length;
  console.log(`MongoDB users: ${mongoUsers.length}`);

  let fsUserIds = [];
  try {
    const userDirs = await fs.readdir(DATA_PATH);
    fsUserIds = userDirs.filter(d => !d.startsWith('.'));
  } catch (err) {
    console.warn(`Could not read userdata directory: ${err.message}`);
  }
  results.users.fsCount = fsUserIds.length;
  console.log(`File system users: ${fsUserIds.length}`);

  const mongoUserIdSet = new Set(mongoUsers.map(u => u._id.toString()));
  const fsUserIdSet = new Set(fsUserIds);

  for (const userId of mongoUserIdSet) {
    if (!fsUserIdSet.has(userId)) {
      const user = mongoUsers.find(u => u._id.toString() === userId);
      results.users.onlyInMongo.push({
        id: userId,
        email: user?.email,
        uniqueCode: user?.uniqueCode
      });
    }
  }

  for (const userId of fsUserIdSet) {
    if (!mongoUserIdSet.has(userId)) {
      results.users.onlyInFs.push({ id: userId });
    }
  }

  const totalUnique = new Set([...mongoUserIdSet, ...fsUserIdSet]).size;
  const common = mongoUserIdSet.size + fsUserIdSet.size - results.users.onlyInMongo.length - results.users.onlyInFs.length;
  results.users.consistencyPercent = totalUnique > 0 ? Math.round((common / totalUnique) * 100) : 100;

  console.log(`Users consistency: ${results.users.consistencyPercent}%`);
  if (results.users.onlyInMongo.length > 0) {
    console.log(`  Only in MongoDB (${results.users.onlyInMongo.length}):`);
    results.users.onlyInMongo.slice(0, 5).forEach(u => {
      console.log(`    - ${u.id} (${u.email || u.uniqueCode})`);
    });
    if (results.users.onlyInMongo.length > 5) {
      console.log(`    ... and ${results.users.onlyInMongo.length - 5} more`);
    }
  }
  if (results.users.onlyInFs.length > 0) {
    console.log(`  Only in file system (${results.users.onlyInFs.length}):`);
    results.users.onlyInFs.slice(0, 5).forEach(u => {
      console.log(`    - ${u.id}`);
    });
    if (results.users.onlyInFs.length > 5) {
      console.log(`    ... and ${results.users.onlyInFs.length - 5} more`);
    }
  }
}

async function checkAnswers() {
  console.log('\n========== Checking Answers ==========');
  
  const mongoAnswers = await Answer.find({}).lean();
  results.answers.mongoCount = mongoAnswers.length;
  console.log(`MongoDB answers: ${mongoAnswers.length}`);

  let fsAnswerIds = [];
  try {
    const answersPath = path.join(DATA_PATH, 'answers');
    await fs.access(answersPath);
    const answerDirs = await fs.readdir(answersPath);
    fsAnswerIds = answerDirs.filter(d => !d.startsWith('.'));
  } catch (err) {
    console.warn(`Could not read answers directory: ${err.message}`);
  }
  results.answers.fsCount = fsAnswerIds.length;
  console.log(`File system answers: ${fsAnswerIds.length}`);

  const mongoAnswerIdSet = new Set(mongoAnswers.map(a => a._id.toString()));
  const fsAnswerIdSet = new Set(fsAnswerIds);

  for (const answerId of mongoAnswerIdSet) {
    if (!fsAnswerIdSet.has(answerId)) {
      const answer = mongoAnswers.find(a => a._id.toString() === answerId);
      results.answers.onlyInMongo.push({
        id: answerId,
        userId: answer?.userId?.toString(),
        targetUserId: answer?.targetUserId?.toString()
      });
    }
  }

  for (const answerId of fsAnswerIdSet) {
    if (!mongoAnswerIdSet.has(answerId)) {
      results.answers.onlyInFs.push({ id: answerId });
    }
  }

  const totalUnique = new Set([...mongoAnswerIdSet, ...fsAnswerIdSet]).size;
  const common = mongoAnswerIdSet.size + fsAnswerIdSet.size - results.answers.onlyInMongo.length - results.answers.onlyInFs.length;
  results.answers.consistencyPercent = totalUnique > 0 ? Math.round((common / totalUnique) * 100) : 100;

  console.log(`Answers consistency: ${results.answers.consistencyPercent}%`);
  if (results.answers.onlyInMongo.length > 0) {
    console.log(`  Only in MongoDB (${results.answers.onlyInMongo.length}):`);
    results.answers.onlyInMongo.slice(0, 5).forEach(a => {
      console.log(`    - ${a.id} (userId: ${a.userId}, target: ${a.targetUserId})`);
    });
    if (results.answers.onlyInMongo.length > 5) {
      console.log(`    ... and ${results.answers.onlyInMongo.length - 5} more`);
    }
  }
  if (results.answers.onlyInFs.length > 0) {
    console.log(`  Only in file system (${results.answers.onlyInFs.length}):`);
    results.answers.onlyInFs.slice(0, 5).forEach(a => {
      console.log(`    - ${a.id}`);
    });
    if (results.answers.onlyInFs.length > 5) {
      console.log(`    ... and ${results.answers.onlyInFs.length - 5} more`);
    }
  }
}

async function checkAssistRelations() {
  console.log('\n========== Checking AssistRelations ==========');
  
  const mongoRelations = await AssistRelation.find({}).lean();
  results.assistRelations.mongoCount = mongoRelations.length;
  console.log(`MongoDB assist relations: ${mongoRelations.length}`);

  let fsRelations = [];
  try {
    const userDirs = await fs.readdir(DATA_PATH);
    for (const userId of userDirs.filter(d => !d.startsWith('.'))) {
      try {
        const relationsPath = path.join(DATA_PATH, userId, 'assist-relations.json');
        await fs.access(relationsPath);
        const data = await fs.readFile(relationsPath, 'utf-8');
        const relations = JSON.parse(data);
        if (Array.isArray(relations)) {
          relations.forEach(r => {
            fsRelations.push({
              relationId: r.relationId?.toString(),
              assistantId: r.assistantId?.toString(),
              targetId: r.targetId?.toString()
            });
          });
        }
      } catch (err) {
        continue;
      }
    }
  } catch (err) {
    console.warn(`Could not read assist relations: ${err.message}`);
  }
  results.assistRelations.fsCount = fsRelations.length;
  console.log(`File system assist relations: ${fsRelations.length}`);

  const mongoRelationSet = new Set(mongoRelations.map(r => r._id.toString()));
  const fsRelationSet = new Set(fsRelations.map(r => r.relationId).filter(Boolean));

  for (const relationId of mongoRelationSet) {
    if (!fsRelationSet.has(relationId)) {
      const relation = mongoRelations.find(r => r._id.toString() === relationId);
      results.assistRelations.onlyInMongo.push({
        id: relationId,
        assistantId: relation?.assistantId?.toString(),
        targetId: relation?.targetId?.toString()
      });
    }
  }

  for (const relationId of fsRelationSet) {
    if (!mongoRelationSet.has(relationId)) {
      const relation = fsRelations.find(r => r.relationId === relationId);
      results.assistRelations.onlyInFs.push({
        id: relationId,
        assistantId: relation?.assistantId,
        targetId: relation?.targetId
      });
    }
  }

  const totalUnique = new Set([...mongoRelationSet, ...fsRelationSet]).size;
  const common = mongoRelationSet.size + fsRelationSet.size - results.assistRelations.onlyInMongo.length - results.assistRelations.onlyInFs.length;
  results.assistRelations.consistencyPercent = totalUnique > 0 ? Math.round((common / totalUnique) * 100) : 100;

  console.log(`AssistRelations consistency: ${results.assistRelations.consistencyPercent}%`);
  if (results.assistRelations.onlyInMongo.length > 0) {
    console.log(`  Only in MongoDB (${results.assistRelations.onlyInMongo.length}):`);
    results.assistRelations.onlyInMongo.slice(0, 5).forEach(r => {
      console.log(`    - ${r.id} (${r.assistantId} -> ${r.targetId})`);
    });
    if (results.assistRelations.onlyInMongo.length > 5) {
      console.log(`    ... and ${results.assistRelations.onlyInMongo.length - 5} more`);
    }
  }
  if (results.assistRelations.onlyInFs.length > 0) {
    console.log(`  Only in file system (${results.assistRelations.onlyInFs.length}):`);
    results.assistRelations.onlyInFs.slice(0, 5).forEach(r => {
      console.log(`    - ${r.id} (${r.assistantId} -> ${r.targetId})`);
    });
    if (results.assistRelations.onlyInFs.length > 5) {
      console.log(`    ... and ${results.assistRelations.onlyInFs.length - 5} more`);
    }
  }
}

async function checkChatSessions() {
  console.log('\n========== Checking ChatSessions ==========');
  
  const mongoSessions = await ChatSession.find({}).lean();
  results.chatSessions.mongoCount = mongoSessions.length;
  console.log(`MongoDB chat sessions: ${mongoSessions.length}`);

  let fsSessionIds = [];
  try {
    const sessionsPath = path.join(DATA_PATH, 'chatSessions');
    await fs.access(sessionsPath);
    const sessionDirs = await fs.readdir(sessionsPath);
    fsSessionIds = sessionDirs.filter(d => !d.startsWith('.'));
  } catch (err) {
    console.warn(`Could not read chatSessions directory: ${err.message}`);
  }
  results.chatSessions.fsCount = fsSessionIds.length;
  console.log(`File system chat sessions: ${fsSessionIds.length}`);

  const mongoSessionIdSet = new Set(mongoSessions.map(s => s.sessionId));
  const fsSessionIdSet = new Set(fsSessionIds);

  for (const sessionId of mongoSessionIdSet) {
    if (!fsSessionIdSet.has(sessionId)) {
      const session = mongoSessions.find(s => s.sessionId === sessionId);
      results.chatSessions.onlyInMongo.push({
        id: sessionId,
        targetUserId: session?.targetUserId?.toString(),
        interlocutorUserId: session?.interlocutorUserId?.toString()
      });
    }
  }

  for (const sessionId of fsSessionIdSet) {
    if (!mongoSessionIdSet.has(sessionId)) {
      results.chatSessions.onlyInFs.push({ id: sessionId });
    }
  }

  const totalUnique = new Set([...mongoSessionIdSet, ...fsSessionIdSet]).size;
  const common = mongoSessionIdSet.size + fsSessionIdSet.size - results.chatSessions.onlyInMongo.length - results.chatSessions.onlyInFs.length;
  results.chatSessions.consistencyPercent = totalUnique > 0 ? Math.round((common / totalUnique) * 100) : 100;

  console.log(`ChatSessions consistency: ${results.chatSessions.consistencyPercent}%`);
  if (results.chatSessions.onlyInMongo.length > 0) {
    console.log(`  Only in MongoDB (${results.chatSessions.onlyInMongo.length}):`);
    results.chatSessions.onlyInMongo.slice(0, 5).forEach(s => {
      console.log(`    - ${s.id} (target: ${s.targetUserId}, interlocutor: ${s.interlocutorUserId})`);
    });
    if (results.chatSessions.onlyInMongo.length > 5) {
      console.log(`    ... and ${results.chatSessions.onlyInMongo.length - 5} more`);
    }
  }
  if (results.chatSessions.onlyInFs.length > 0) {
    console.log(`  Only in file system (${results.chatSessions.onlyInFs.length}):`);
    results.chatSessions.onlyInFs.slice(0, 5).forEach(s => {
      console.log(`    - ${s.id}`);
    });
    if (results.chatSessions.onlyInFs.length > 5) {
      console.log(`    ... and ${results.chatSessions.onlyInFs.length - 5} more`);
    }
  }
}

async function printSummary() {
  console.log('\n========== Consistency Check Summary ==========');
  console.log('\nUsers:');
  console.log(`  MongoDB: ${results.users.mongoCount}`);
  console.log(`  File System: ${results.users.fsCount}`);
  console.log(`  Only in MongoDB: ${results.users.onlyInMongo.length}`);
  console.log(`  Only in File System: ${results.users.onlyInFs.length}`);
  console.log(`  Consistency: ${results.users.consistencyPercent}%`);

  console.log('\nAnswers:');
  console.log(`  MongoDB: ${results.answers.mongoCount}`);
  console.log(`  File System: ${results.answers.fsCount}`);
  console.log(`  Only in MongoDB: ${results.answers.onlyInMongo.length}`);
  console.log(`  Only in File System: ${results.answers.onlyInFs.length}`);
  console.log(`  Consistency: ${results.answers.consistencyPercent}%`);

  console.log('\nAssistRelations:');
  console.log(`  MongoDB: ${results.assistRelations.mongoCount}`);
  console.log(`  File System: ${results.assistRelations.fsCount}`);
  console.log(`  Only in MongoDB: ${results.assistRelations.onlyInMongo.length}`);
  console.log(`  Only in File System: ${results.assistRelations.onlyInFs.length}`);
  console.log(`  Consistency: ${results.assistRelations.consistencyPercent}%`);

  console.log('\nChatSessions:');
  console.log(`  MongoDB: ${results.chatSessions.mongoCount}`);
  console.log(`  File System: ${results.chatSessions.fsCount}`);
  console.log(`  Only in MongoDB: ${results.chatSessions.onlyInMongo.length}`);
  console.log(`  Only in File System: ${results.chatSessions.onlyInFs.length}`);
  console.log(`  Consistency: ${results.chatSessions.consistencyPercent}%`);

  const totalMongo = results.users.mongoCount + results.answers.mongoCount + results.assistRelations.mongoCount + results.chatSessions.mongoCount;
  const totalFs = results.users.fsCount + results.answers.fsCount + results.assistRelations.fsCount + results.chatSessions.fsCount;
  const totalOnlyInMongo = results.users.onlyInMongo.length + results.answers.onlyInMongo.length + results.assistRelations.onlyInMongo.length + results.chatSessions.onlyInMongo.length;
  const totalOnlyInFs = results.users.onlyInFs.length + results.answers.onlyInFs.length + results.assistRelations.onlyInFs.length + results.chatSessions.onlyInFs.length;
  const avgConsistency = (results.users.consistencyPercent + results.answers.consistencyPercent + results.assistRelations.consistencyPercent + results.chatSessions.consistencyPercent) / 4;

  console.log('\nOverall:');
  console.log(`  Total MongoDB documents: ${totalMongo}`);
  console.log(`  Total File System files: ${totalFs}`);
  console.log(`  Total inconsistencies: ${totalOnlyInMongo + totalOnlyInFs}`);
  console.log(`  Average consistency: ${Math.round(avgConsistency)}%`);
  console.log('================================================');

  if (totalOnlyInMongo > 0 || totalOnlyInFs > 0) {
    console.log('\n⚠️  INCONSISTENCIES DETECTED');
    console.log('   Run recovery scripts to synchronize data:');
    console.log('   - node server/scripts/recover-from-mongodb.js');
    console.log('   - node server/scripts/recover-from-filesystem.js');
  } else {
    console.log('\n✅ ALL DATA CONSISTENT');
  }
}

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
      console.log('Connected to MongoDB');
      return uri;
    } catch (error) {
      console.log(`  Failed: ${error.message}`);
      continue;
    }
  }
  throw new Error('Could not connect to any MongoDB instance');
}

async function main() {
  let connectedUri = '';
  try {
    connectedUri = await connectToMongo();
    console.log(`Data path: ${DATA_PATH}`);

    await checkUsers();
    await checkAnswers();
    await checkAssistRelations();
    await checkChatSessions();

    await printSummary();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

main();
