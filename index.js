// index.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { startBot } = require('./pair');
const config = require('./config');

// Set bot start time for uptime tracking
global.botStartTime = Date.now();

// Silent Git Setup function
function setupGitRepositorySilently() {
    const gitFolder = path.join(__dirname, '.git');
    if (!fs.existsSync(gitFolder)) {
        try {
            console.log('[GIT] Silently initializing Git repository connection...');
            execSync('git init', { stdio: 'ignore' });
            execSync('git remote add origin https://github.com/Botking134/orion-XMD.git', { stdio: 'ignore' });
            execSync('git fetch origin', { stdio: 'ignore' });
            execSync('git branch -M main', { stdio: 'ignore' });
            console.log('[GIT] Repository linked to https://github.com/Botking134/orion-XMD.git');
        } catch (e) {
            console.warn('[GIT] Silent git setup notice:', e.message);
        }
    }
}

// Run silent Git setup
setupGitRepositorySilently();

// Startup Banner
console.clear();
console.log(`
==================================================
              ✨  O R I O N - X M D  ✨
            WhatsApp Multi-Device Bot
==================================================
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