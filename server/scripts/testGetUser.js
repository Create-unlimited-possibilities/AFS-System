import 'dotenv/config';
import mongoose from 'mongoose';
import '../src/modules/roles/models/role.js';  // Load Role model
import adminService from '../src/modules/admin/service.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/afs_db';

async function test() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const userId = '698abdf152e5e295fe72c0a0'; // dxs@gmail.com

  try {
    const user = await adminService.getUserById(userId);
    console.log('\n=== getUserById Result ===');
    console.log('Name:', user.name);
    console.log('Email:', user.email);
    console.log('\nProfile:');
    console.log('  gender:', user.profile?.gender);
    console.log('  birthDate:', user.profile?.birthDate);
    console.log('  birthHour:', user.profile?.birthHour);
    console.log('\nProfileCompletion:');
    console.log('  isComplete:', user.profileCompletion?.isComplete);
    console.log('  missingFields:', user.profileCompletion?.missingFields);
  } catch (error) {
    console.error('Error:', error);
  }

  await mongoose.disconnect();
}

test();
