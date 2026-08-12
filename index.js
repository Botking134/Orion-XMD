// index.js
const { startBot } = require('./pair');
const config = require('./config');

// Set bot start time for uptime tracking
global.botStartTime = Date.now();

// Startup Banner
console.clear();
console.log(`
=======================================
      ✨  O R I O N - X M D  ✨
      WhatsApp Multi-Device Bot
======================================
`);

console.log(`[SYSTEM] Initializing Orion-XMD...`);
console.log(`[SYSTEM] Bot Name: ${config.botName}`);
console.log(`[SYSTEM] Prefix  : ${config.prefix}`);
console.log(`[SYSTEM] Status  : Awaiting Socket Connection...\n`);

// Start Connection Socket
startBot().catch((error) => {
    console.error('[FATAL ERROR] Failed to start Orion-XMD:', error);
    process.exit(1);
});

// Global Error Catchers
process.on('unhandledRejection', (reason, promise) => {
    console.error('[SYSTEM WARNING] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[SYSTEM CRITICAL] Uncaught Exception thrown:', err);
});