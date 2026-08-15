// pair.js
const readline = require('readline');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// Readline interface for terminal input
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// Single socket instance reference to prevent multi-instance conflict
let currentSock = null;

async function startBot() {
    // Clean up previous socket instance if present
    if (currentSock) {
        try {
            currentSock.ev.removeAllListeners();
            currentSock.end(new Error('Reconnecting socket...'));
        } catch (e) {}
        currentSock = null;
    }

    // Import @itsliaaa/baileys modules
    const {
        default: makeWASocket,
        useMultiFileAuthState,
        delay,
        Browsers,
        DisconnectReason
    } = await import('@itsliaaa/baileys');

    const authFolder = path.join(__dirname, 'storage', 'session');
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    let phoneNumber = null;

    // Prompt for Pairing Code if session is not registered
    if (!state.creds.registered) {
        console.log('\n\x1b[35m✨ ═══ ORION-XMD PAIRING SYSTEM ═══ ✨\x1b[0m\n');
        let numberInput = await question('\x1b[36m👉 Enter your phone number with country code (e.g. 234...): \x1b[0m');
        phoneNumber = numberInput.replace(/[^0-9]/g, '');

        if (!phoneNumber) {
            console.log('\x1b[31m❌ Invalid phone number. Restarting process...\x1b[0m');
            process.exit(1);
        }

        console.log(`\x1b[33m⏳ Requesting Pairing Code for +${phoneNumber}...\x1b[0m\n`);
    }

    // Create WASocket instance with stability parameters
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: require('pino')({ level: 'silent' }),
        browser: Browsers.ubuntu('Chrome'),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: true,
        syncFullHistory: false
    });

    currentSock = sock;

    sock.ev.on('creds.update', saveCreds);

    let pairingCodeRequested = false;

    // Handle Connection Updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        // Request Genuine WhatsApp Pairing Code
        if (phoneNumber && !pairingCodeRequested && !state.creds.registered) {
            pairingCodeRequested = true;
            await delay(4000);
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`\x1b[32m====================================\x1b[0m`);
                console.log(`\x1b[32m🔑 YOUR ORION-XMD PAIRING CODE: \x1b[1m\x1b[37m${code}\x1b[0m`);
                console.log(`\x1b[32m====================================\x1b[0m`);
                console.log(`\x1b[36m👉 Enter this code in WhatsApp > Linked Devices\x1b[0m\n`);
            } catch (error) {
                console.error('\x1b[31m❌ Failed to generate pairing code:', error.message, '\x1b[0m');
                pairingCodeRequested = false;
            }
        }

        // Connection Closed Handler
        if (connection === 'close') {
            const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
            console.error('\x1b[31m⚠️ Connection closed. Status Code:', statusCode, '\x1b[0m');

            if (statusCode === DisconnectReason.loggedOut) {
                console.log('\x1b[31m❌ Session logged out. Please clear storage/session and re-pair.\x1b[0m');
                process.exit(1);
            } else if (statusCode === 428) {
                // Precondition / replaced session: Wait 10 seconds before reconnecting to let old connection release
                console.log('\x1b[33m🔄 Session conflict detected (428). Reconnecting in 10 seconds...\x1b[0m');
                setTimeout(() => startBot(), 10000);
            } else {
                console.log('\x1b[33m🔄 Reconnecting in 5 seconds...\x1b[0m');
                setTimeout(() => startBot(), 5000);
            }
        }

        // Connection Established
        if (connection === 'open') {
            console.log('\x1b[32m✅ Orion-XMD Connected Successfully!\x1b[0m');
        }
    });

    // Message Upsert Event Listener
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const infinity = require('./handlers/infinity');
            if (infinity && typeof infinity.handleMessage === 'function') {
                await infinity.handleMessage(sock, chatUpdate);
            }
        } catch (e) {
            console.error('[PAIR] Error processing message:', e.message);
        }
    });

    // Group Participant Update Listener
    sock.ev.on('group-participants.update', async (update) => {
        try {
            const infinity = require('./handlers/infinity');
            if (infinity && typeof infinity.handleGroupParticipants === 'function') {
                await infinity.handleGroupParticipants(sock, update);
            }
        } catch (e) {
            console.error('[PAIR] Error processing group update:', e.message);
        }
    });
}

module.exports = { startBot };