import 'dotenv/config';
import mongoose from 'mongoose';
import DualStorage from '../src/services/dualStorage.js';
import User from '../src/models/User.js';
import Answer from '../src/models/Answer.js';
import AssistRelation from '../src/models/AssistRelation.js';
import ChatSession from '../src/models/ChatSession.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/afs_db';

const dualStorage = new DualStorage();
const stats = {
  users: { total: 0, processed: 0, errors: 0 },
  answers: { total: 0, processed: 0, errors: 0 },
  assistRelations: { total: 0, processed: 0, errors: 0 },
  chatSessions: { total: 0, processed: 0, errors: 0 }
};

async function recoverUsers() {
  console.log('\n========== Recovering Users ==========');
  const users = await User.find({}).lean();
  stats.users.total = users.length;
  console.log(`Found ${users.length} users`);

  for (const user of users) {
    try {
      const userId = user._id.toString();
      
      if (user.companionChat?.roleCard) {
        await dualStorage.saveRoleCard(userId, user.companionChat.roleCard);
      }
      
      if (user.companionChat?.strangerSentiments) {
        await dualStorage.saveSentiments(userId, user.companionChat.strangerSentiments);
      }
      
      if (user.companionChat?.conversationsAsTarget) {
        await dualStorage.saveConversations(userId, user.companionChat.conversationsAsTarget);
      }
      
      if (user.companionChat?.assistantsGuidelines) {
        await dualStorage.saveAssistantsGuidelines(userId, user.companionChat.assistantsGuidelines);
      }
      
      const { companionChat, ...profileData } = user;
      await dualStorage.saveUserProfile(userId, profileData);
      
      stats.users.processed++;
      console.log(`[${stats.users.processed}/${stats.users.total}] Recovered user: ${user.email || user.uniqueCode}`);
    } catch (error) {
      stats.users.errors++;
      console.error(`Error recovering user ${user._id}:`, error.message);
    }
  }

  console.log(`Users recovery complete: ${stats.users.processed} processed, ${stats.users.errors} errors`);
}

async function recoverAnswers() {
  console.log('\n========== Recovering Answers ==========');
  const answers = await Answer.find({}).lean();
  stats.answers.total = answers.length;
  console.log(`Found ${answers.length} answers`);

  for (const answer of answers) {
    try {
      const answerId = answer._id.toString();
      await dualStorage.saveAnswer(answerId, answer);
      stats.answers.processed++;
      console.log(`[${stats.answers.processed}/${stats.answers.total}] Recovered answer: ${answerId}`);
    } catch (error) {
      stats.answers.errors++;
      console.error(`Error recovering answer ${answer._id}:`, error.message);
    }
  }

  console.log(`Answers recovery complete: ${stats.answers.processed} processed, ${stats.answers.errors} errors`);
}

async function recoverAssistRelations() {
  console.log('\n========== Recovering AssistRelations ==========');
  const relations = await AssistRelation.find({}).lean();
  stats.assistRelations.total = relations.length;
  console.log(`Found ${relations.length} assist relations`);

  for (const relation of relations) {
    try {
      const userId = relation.targetId.toString();
      await dualStorage.saveAssistRelation(userId, relation);
      stats.assistRelations.processed++;
      console.log(`[${stats.assistRelations.processed}/${stats.assistRelations.total}] Recovered assist relation for user: ${userId}`);
    } catch (error) {
      stats.assistRelations.errors++;
      console.error(`Error recovering assist relation ${relation._id}:`, error.message);
    }
  }

  console.log(`AssistRelations recovery complete: ${stats.assistRelations.processed} processed, ${stats.assistRelations.errors} errors`);
}

async function recoverChatSessions() {
  console.log('\n========== Recovering ChatSessions ==========');
  const sessions = await ChatSession.find({}).lean();
  stats.chatSessions.total = sessions.length;
  console.log(`Found ${sessions.length} chat sessions`);

  for (const session of sessions) {
    try {
      const sessionId = session.sessionId;
      await dualStorage.saveChatSession(sessionId, session);
      stats.chatSessions.processed++;
      console.log(`[${stats.chatSessions.processed}/${stats.chatSessions.total}] Recovered chat session: ${sessionId}`);
    } catch (error) {
      stats.chatSessions.errors++;
      console.error(`Error recovering chat session ${session.sessionId}:`, error.message);
    }
  }

  console.log(`ChatSessions recovery complete: ${stats.chatSessions.processed} processed, ${stats.chatSessions.errors} errors`);
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
