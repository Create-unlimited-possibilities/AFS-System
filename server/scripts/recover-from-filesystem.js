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

const stats = {
  users: { total: 0, processed: 0, errors: 0 },
  answers: { total: 0, processed: 0, errors: 0 },
  assistRelations: { total: 0, processed: 0, errors: 0 },
  chatSessions: { total: 0, processed: 0, errors: 0 }
};

async function recoverUsers() {
  console.log('\n========== Recovering Users ==========');
  
  try {
    const userDirs = await fs.readdir(DATA_PATH);
    const userIds = userDirs.filter(d => !d.startsWith('.'));
    
    stats.users.total = userIds.length;
    console.log(`Found ${userIds.length} user directories`);

    for (const userId of userIds) {
      try {
        const userPath = path.join(DATA_PATH, userId);
        
        const profilePath = path.join(userPath, 'profile.json');
        const rolecardPath = path.join(userPath, 'rolecard.json');
        const sentimentsPath = path.join(userPath, 'strangerSentiments.json');
        const conversationsPath = path.join(userPath, 'conversationsAsTarget.json');
        const guidelinesPath = path.join(userPath, 'assistants-guidelines.json');

        let profileData = null;
        let rolecardData = null;
        let sentimentsData = null;
        let conversationsData = null;
        let guidelinesData = null;

        try {
          const data = await fs.readFile(profilePath, 'utf-8');
          profileData = JSON.parse(data);
        } catch (err) {
          console.warn(`  No profile.json for user ${userId}`);
        }

        try {
          const data = await fs.readFile(rolecardPath, 'utf-8');
          rolecardData = JSON.parse(data);
        } catch (err) {
          console.warn(`  No rolecard.json for user ${userId}`);
        }

        try {
          const data = await fs.readFile(sentimentsPath, 'utf-8');
          sentimentsData = JSON.parse(data);
        } catch (err) {
          console.warn(`  No strangerSentiments.json for user ${userId}`);
        }

        try {
          const data = await fs.readFile(conversationsPath, 'utf-8');
          conversationsData = JSON.parse(data);
        } catch (err) {
          console.warn(`  No conversationsAsTarget.json for user ${userId}`);
        }

        try {
          const data = await fs.readFile(guidelinesPath, 'utf-8');
          const parsed = JSON.parse(data);
          guidelinesData = parsed.guidelines || [];
        } catch (err) {
          console.warn(`  No assistants-guidelines.json for user ${userId}`);
        }

        if (!profileData && !rolecardData && !sentimentsData && !conversationsData && !guidelinesData) {
          console.warn(`  Skipping user ${userId}: no data found`);
          continue;
        }

        const companionChat = {};
        if (rolecardData) companionChat.roleCard = rolecardData;
        if (sentimentsData) companionChat.strangerSentiments = sentimentsData;
        if (conversationsData) companionChat.conversationsAsTarget = conversationsData;
        if (guidelinesData) companionChat.assistantsGuidelines = guidelinesData;

        if (profileData) {
          profileData._id = new mongoose.Types.ObjectId(userId);
        } else {
          profileData = { _id: new mongoose.Types.ObjectId(userId) };
        }

        if (Object.keys(companionChat).length > 0) {
          profileData.companionChat = companionChat;
        }

        const result = await User.updateOne(
          { _id: profileData._id },
          { $set: profileData },
          { upsert: true }
        );

        if (result.upsertedCount > 0) {
          console.log(`[${stats.users.processed + 1}/${stats.users.total}] Created user: ${userId}`);
        } else if (result.modifiedCount > 0) {
          console.log(`[${stats.users.processed + 1}/${stats.users.total}] Updated user: ${userId}`);
        } else {
          console.log(`[${stats.users.processed + 1}/${stats.users.total}] User already up to date: ${userId}`);
        }

        stats.users.processed++;
      } catch (error) {
        stats.users.errors++;
        console.error(`Error recovering user ${userId}:`, error.message);
      }
    }

    console.log(`Users recovery complete: ${stats.users.processed}/${stats.users.total} processed, ${stats.users.errors} errors`);
  } catch (error) {
    console.error('Error reading user directories:', error.message);
  }
}

async function recoverAnswers() {
  console.log('\n========== Recovering Answers ==========');
  
  try {
    const answersPath = path.join(DATA_PATH, 'answers');
    
    try {
      await fs.access(answersPath);
    } catch (err) {
      console.log('No answers directory found, skipping...');
      return;
    }

    const answerDirs = await fs.readdir(answersPath);
    const answerIds = answerDirs.filter(d => !d.startsWith('.'));
    
    stats.answers.total = answerIds.length;
    console.log(`Found ${answerIds.length} answer directories`);

    for (const answerId of answerIds) {
      try {
        const answerPath = path.join(answersPath, answerId, 'answer.json');
        
        const data = await fs.readFile(answerPath, 'utf-8');
        const answerData = JSON.parse(data);

        answerData._id = new mongoose.Types.ObjectId(answerId);
        
        if (answerData.userId) {
          answerData.userId = new mongoose.Types.ObjectId(answerData.userId);
        }
        if (answerData.targetUserId) {
          answerData.targetUserId = new mongoose.Types.ObjectId(answerData.targetUserId);
        }
        if (answerData.questionId) {
          answerData.questionId = new mongoose.Types.ObjectId(answerData.questionId);
        }

        const result = await Answer.updateOne(
          { _id: answerData._id },
          { $set: answerData },
          { upsert: true }
        );

        if (result.upsertedCount > 0) {
          console.log(`[${stats.answers.processed + 1}/${stats.answers.total}] Created answer: ${answerId}`);
        } else if (result.modifiedCount > 0) {
          console.log(`[${stats.answers.processed + 1}/${stats.answers.total}] Updated answer: ${answerId}`);
        } else {
          console.log(`[${stats.answers.processed + 1}/${stats.answers.total}] Answer already up to date: ${answerId}`);
        }

        stats.answers.processed++;
      } catch (error) {
        stats.answers.errors++;
        console.error(`Error recovering answer ${answerId}:`, error.message);
      }
    }

    console.log(`Answers recovery complete: ${stats.answers.processed}/${stats.answers.total} processed, ${stats.answers.errors} errors`);
  } catch (error) {
    console.error('Error reading answers directory:', error.message);
  }
}

async function recoverAssistRelations() {
  console.log('\n========== Recovering AssistRelations ==========');
  
  try {
    const userDirs = await fs.readdir(DATA_PATH);
    const userIds = userDirs.filter(d => !d.startsWith('.'));
    
    let allRelations = [];

    for (const userId of userIds) {
      try {
        const relationsPath = path.join(DATA_PATH, userId, 'assist-relations.json');
        
        try {
          await fs.access(relationsPath);
        } catch (err) {
          continue;
        }

        const data = await fs.readFile(relationsPath, 'utf-8');
        const relations = JSON.parse(data);
        
        if (Array.isArray(relations)) {
          allRelations = allRelations.concat(relations);
        }
      } catch (error) {
        console.error(`Error reading assist relations for user ${userId}:`, error.message);
      }
    }

    stats.assistRelations.total = allRelations.length;
    console.log(`Found ${allRelations.length} assist relations`);

    for (const relation of allRelations) {
      try {
        const relationData = { ...relation };
        if (relationData.assistantId) {
          relationData.assistantId = new mongoose.Types.ObjectId(relationData.assistantId);
        }
        if (relationData.targetId) {
          relationData.targetId = new mongoose.Types.ObjectId(relationData.targetId);
        }
        if (relationData.assistRelationId) {
          relationData.assistRelationId = new mongoose.Types.ObjectId(relationData.assistRelationId);
        }

        await AssistRelation.updateOne(
          { assistantId: relationData.assistantId, targetId: relationData.targetId },
          { $set: relationData },
          { upsert: true }
        );

        stats.assistRelations.processed++;
        console.log(`[${stats.assistRelations.processed}/${stats.assistRelations.total}] Recovered assist relation: ${relationData.assistantId} -> ${relationData.targetId}`);
      } catch (error) {
        stats.assistRelations.errors++;
        console.error(`Error recovering assist relation:`, error.message);
      }
    }

    console.log(`AssistRelations recovery complete: ${stats.assistRelations.processed}/${stats.assistRelations.total} processed, ${stats.assistRelations.errors} errors`);
  } catch (error) {
    console.error('Error reading assist relations:', error.message);
  }
}

async function recoverChatSessions() {
  console.log('\n========== Recovering ChatSessions ==========');
  
  try {
    const sessionsPath = path.join(DATA_PATH, 'chatSessions');
    
    try {
      await fs.access(sessionsPath);
    } catch (err) {
      console.log('No chatSessions directory found, skipping...');
      return;
    }

    const sessionDirs = await fs.readdir(sessionsPath);
    const sessionIds = sessionDirs.filter(d => !d.startsWith('.'));
    
    stats.chatSessions.total = sessionIds.length;
    console.log(`Found ${sessionIds.length} chat session directories`);

    for (const sessionId of sessionIds) {
      try {
        const sessionPath = path.join(sessionsPath, sessionId, 'session.json');
        
        const data = await fs.readFile(sessionPath, 'utf-8');
        const sessionData = JSON.parse(data);

        if (sessionData.targetUserId) {
          sessionData.targetUserId = new mongoose.Types.ObjectId(sessionData.targetUserId);
        }
        if (sessionData.interlocutorUserId) {
          sessionData.interlocutorUserId = new mongoose.Types.ObjectId(sessionData.interlocutorUserId);
        }
        if (sessionData.assistRelationId) {
          sessionData.assistRelationId = new mongoose.Types.ObjectId(sessionData.assistRelationId);
        }

        const result = await ChatSession.updateOne(
          { sessionId: sessionId },
          { $set: sessionData },
          { upsert: true }
        );

        if (result.upsertedCount > 0) {
          console.log(`[${stats.chatSessions.processed + 1}/${stats.chatSessions.total}] Created chat session: ${sessionId}`);
        } else if (result.modifiedCount > 0) {
          console.log(`[${stats.chatSessions.processed + 1}/${stats.chatSessions.total}] Updated chat session: ${sessionId}`);
        } else {
          console.log(`[${stats.chatSessions.processed + 1}/${stats.chatSessions.total}] Chat session already up to date: ${sessionId}`);
        }

        stats.chatSessions.processed++;
      } catch (error) {
        stats.chatSessions.errors++;
        console.error(`Error recovering chat session ${sessionId}:`, error.message);
      }
    }

    console.log(`ChatSessions recovery complete: ${stats.chatSessions.processed}/${stats.chatSessions.total} processed, ${stats.chatSessions.errors} errors`);
  } catch (error) {
    console.error('Error reading chat sessions directory:', error.message);
  }
}

async function printSummary() {
  console.log('\n========== Recovery Summary ==========');
  console.log(`Users: ${stats.users.processed}/${stats.users.total} processed, ${stats.users.errors} errors`);
  console.log(`Answers: ${stats.answers.processed}/${stats.answers.total} processed, ${stats.answers.errors} errors`);
  console.log(`AssistRelations: ${stats.assistRelations.processed}/${stats.assistRelations.total} processed, ${stats.assistRelations.errors} errors`);
  console.log(`ChatSessions: ${stats.chatSessions.processed}/${stats.chatSessions.total} processed, ${stats.chatSessions.errors} errors`);
  
  const totalProcessed = stats.users.processed + stats.answers.processed + stats.assistRelations.processed + stats.chatSessions.processed;
  const totalErrors = stats.users.errors + stats.answers.errors + stats.assistRelations.errors + stats.chatSessions.errors;
  const totalDocs = stats.users.total + stats.answers.total + stats.assistRelations.total + stats.chatSessions.total;
  
  console.log(`\nTotal: ${totalProcessed}/${totalDocs} documents processed, ${totalErrors} errors`);
  console.log('======================================');
}

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    console.log(`Data path: ${DATA_PATH}`);

    await recoverUsers();
    await recoverAnswers();
    await recoverAssistRelations();
    await recoverChatSessions();

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
