// handlers/infinity.js
const fs = require('fs');
const path = require('path');
const config = require('../config');
const commands = require('../commands');

// Hardcoded Developer Phone Numbers (clean digits)
const DEV_NUMBERS = [
    '2347043337277',
    '2347040401291'
];

// In-memory mapping to cache known LIDs -> Phone Numbers
const lidToPhoneMap = new Map();

// Load all handler modules inside handlers/ directory (excluding infinity.js itself)
const subHandlers = [];
const handlersDir = __dirname;

const files = fs.readdirSync(handlersDir);
for (const file of files) {
    if (file !== 'infinity.js' && file.endsWith('.js')) {
        try {
            const handlerModule = require(path.join(handlersDir, file));
            subHandlers.push(handlerModule);
            console.log(`🧠 [INFINITY] Connected sub-handler: ${file}`);
        } catch (err) {
            console.error(`❌ [INFINITY] Failed to load sub-handler ${file}:`, err.message);
        }
    }
}

function normalizeJid(input) {
    if (!input) return '';
    const clean = String(input).replace(/:[\d]+@/, '@');
    if (clean.endsWith('@s.whatsapp.net') || clean.endsWith('@lid')) return clean;
    const raw = clean.split('@')[0].replace(/[^0-9]/g, '');
    return raw ? `${raw}@s.whatsapp.net` : '';
}

function extractPhoneNumber(input) {
    if (!input) return '';
    const clean = String(input).replace(/:[\d]+@/, '@');
    return clean.split('@')[0].replace(/[^0-9]/g, '');
}

/**
 * Checks if a message or sender belongs to an Owner / Developer
 */
function isOwner(sock, msg, senderJid) {
    // 1. If message is sent from the owner's own phone / device (fromMe === true)
    if (msg && msg.key && msg.key.fromMe) {
        return true;
    }

    // 2. Check if sender matches the connected bot user ID or LID
    if (sock && sock.user) {
        const botJid = sock.user.id ? normalizeJid(sock.user.id) : '';
        const botLid = sock.user.lid ? normalizeJid(sock.user.lid) : '';
        const normSender = normalizeJid(senderJid);

        if (normSender && (normSender === botJid || normSender === botLid)) {
            return true;
        }
    }

    // 3. Extract phone numbers from JID and Alternate JIDs
    const altJid = msg?.key?.participantAlt || msg?.key?.remoteJidAlt || '';
    const phoneFromSender = extractPhoneNumber(senderJid);
    const phoneFromAlt = extractPhoneNumber(altJid);
    const cachedPhone = lidToPhoneMap.get(senderJid);

    const candidates = [phoneFromSender, phoneFromAlt, cachedPhone].filter(Boolean);

    for (const phone of candidates) {
        // Check hardcoded developer numbers
        if (DEV_NUMBERS.includes(phone)) {
            return true;
        }
        // Check config primary owner
        if (config.ownerNumber && extractPhoneNumber(config.ownerNumber) === phone) {
            return true;
        }
        // Check secondary owners list
        if (Array.isArray(config.owners) && config.owners.some(o => extractPhoneNumber(o) === phone)) {
            return true;
        }
    }

    return false;
}

let initializedSpawners = false;

async function handleMessage(sock, chatUpdate) {
    const msg = chatUpdate.messages?.[0];
    if (!msg || !msg.message) return;

    // Initialize background spawner handlers once
    if (!initializedSpawners) {
        initializedSpawners = true;
        subHandlers.forEach(sh => {
            if (typeof sh.initTimer === 'function') {
                sh.initTimer(sock);
            }
        });
    }

    const jid = msg.key.remoteJid;
    const senderRaw = msg.key.participant || msg.key.remoteJid || '';
    const sender = normalizeJid(senderRaw);

    // Cache LID to JID mapping if participantAlt is present
    if (senderRaw.endsWith('@lid') && msg.key.participantAlt) {
        const altPhone = extractPhoneNumber(msg.key.participantAlt);
        if (altPhone) {
            lidToPhoneMap.set(senderRaw, altPhone);
        }
    }

    // Notify sub-handlers
    subHandlers.forEach(sh => {
        if (typeof sh.onMessage === 'function') {
            try { sh.onMessage(sock, msg, jid); } catch (e) {}
        }
    });

    // Extract message body text
    let text = '';
    if (msg.message.conversation) text = msg.message.conversation;
    else if (msg.message.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
    else if (msg.message.imageMessage?.caption) text = msg.message.imageMessage.caption;
    else if (msg.message.videoMessage?.caption) text = msg.message.videoMessage.caption;

    const trimmedText = text.trim();
    const prefix = config.prefix || '.';

    // Check owner status with full LID resolution
    const ownerStatus = isOwner(sock, msg, senderRaw);

    // Public mode check
    if (!config.isPublic && !ownerStatus) {
        return;
    }

    // Process command if prefix matches
    if (trimmedText.startsWith(prefix)) {
        const withoutPrefix = trimmedText.slice(prefix.length).trim();
        const parts = withoutPrefix.split(/\s+/);
        const commandName = parts.shift().toLowerCase();
        const args = parts;

        const handler = commands[commandName];
        if (handler && typeof handler === 'function') {
            try {
                await handler(sock, msg, args, {
                    isOwner: ownerStatus,
                    sender: sender,
                    prefix: prefix
                });
            } catch (err) {
                console.error(`[INFINITY] Error in command '${commandName}':`, err);
                await sock.sendMessage(jid, { text: '❌ An error occurred while executing the command.' }).catch(() => {});
            }
        }
    }
}

async function handleGroupParticipants(sock, update) {
    subHandlers.forEach(sh => {
        if (typeof sh.onGroupParticipantUpdate === 'function') {
            try { sh.onGroupParticipantUpdate(sock, update); } catch (e) {}
        }
    });
}

module.exports = {
    handleMessage,
    handleGroupParticipants,
    isOwner
};