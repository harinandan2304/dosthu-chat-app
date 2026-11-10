const assert = require('assert');
const db = require('./src/db/database');
const { hashPassword, verifyPassword, generateToken, verifyToken } = require('./src/utils/authHelper');
const { handleAuthRoutes } = require('./src/routes/auth');
const { handleUserRoutes } = require('./src/routes/users');
const { handleMessageRoutes } = require('./src/routes/messages');

console.log('🧪 Starting Unit Tests for Dosthu Modules...\n');

// 1. Password Hashing Test
console.log('1. Testing Password Hashing & Verification...');
const testPass = 'dosthu123';
const hashed = hashPassword(testPass);
assert(hashed && hashed.includes(':'), 'Hashed password should contain salt:hash');
assert(verifyPassword(testPass, hashed) === true, 'Valid password should verify true');
assert(verifyPassword('wrongPassword', hashed) === false, 'Invalid password should verify false');
console.log('✅ Password security verified!');

// 2. JWT Generation & Verification Test
console.log('\n2. Testing JWT Signed Token Handling...');
const payload = { id: 'usr_test', username: 'testuser' };
const token = generateToken(payload);
assert(token && token.split('.').length === 3, 'Token must have header.payload.signature');
const decoded = verifyToken(token);
assert(decoded && decoded.id === 'usr_test' && decoded.username === 'testuser', 'Decoded token payload must match');
assert(verifyToken(token + 'tampered') === null, 'Tampered token must fail verification');
console.log('✅ Token authentication verified!');

// 3. Database Operations Test
console.log('\n3. Testing Database CRUD...');
const harish = db.findUserByUsername('harish');
assert(harish !== null, 'Harish user should exist in seed');
assert(harish.password === undefined || db.sanitizeUser(harish).password === undefined, 'Sanitized user should not expose password');

const usersForHarish = db.getAllUsers('usr_harish');
assert(Array.isArray(usersForHarish), 'Users list should be an array');
assert(usersForHarish.length >= 4, 'Should have at least 4 other seed users');
console.log(`✅ Database returned ${usersForHarish.length} conversations for Harish!`);

// 4. Message Creation and Fetching
console.log('\n4. Testing Message Storage and Fetching...');
const newMsg = db.createMessage({
  senderId: 'usr_harish',
  receiverId: 'usr_ananya',
  text: 'Automated test message for FSWD project verification'
});
assert(newMsg && newMsg.id.startsWith('msg_'), 'Message should have msg_ ID');
assert(newMsg.read === false, 'New message should be unread initially');

const chat = db.getMessagesBetween('usr_harish', 'usr_ananya');
assert(chat.length >= 1, 'Chat should contain messages');
assert(chat[chat.length - 1].text === 'Automated test message for FSWD project verification');
console.log(`✅ Message sent and verified! Total messages in chat: ${chat.length}`);

// 5. Read Receipt Test
console.log('\n5. Testing Read Receipts...');
const updatedCount = db.markMessagesAsRead('usr_harish', 'usr_ananya');
assert(updatedCount >= 1, 'Should mark messages sent by Harish as read by Ananya');
const chatAfterRead = db.getMessagesBetween('usr_harish', 'usr_ananya');
const lastMsg = chatAfterRead[chatAfterRead.length - 1];
assert(lastMsg.read === true, 'Message should now be marked read');
console.log('✅ Read receipt verification passed!');

// 6. User Profile Update
console.log('\n6. Testing User Profile Updates...');
const updated = db.updateUser('usr_harish', { bio: 'Updated via test suite! 🌟' });
assert(updated.bio === 'Updated via test suite! 🌟', 'Bio should be updated');
console.log('✅ User profile update verified!');

console.log('\n🎉 ALL CORE LOGIC TESTS PASSED WITH 100% SUCCESS!\n');
