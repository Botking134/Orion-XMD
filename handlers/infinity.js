// handlers/infinity.js
const fs = require('fs');
const path = require('path');
const config = require('../config');
const commands = require('../commands');

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

function isOwner(senderJid) {
    const sender = normalizeJid(senderJid);
    if (!sender) return false;
    if (config.ownerJid && sender === config.ownerJid) return true;
    if (Array.isArray(config.owners) && config.owners.some(o => normalizeJid(o) === sender)) return true;
    return false;
}

// Track if background spawner loops have been initialized
let initializedSpawners = false;

async function handleMessage(sock, chatUpdate) {
    const msg = chatUpdate.messages?.[0];
    if (!msg || !msg.message) return;

    // Initialize background spawner handlers (e.g., ben10 30-min timer) once
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

    // Notify sub-handlers of incoming activity (e.g., tracking active groups for spawns)
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

    // Public mode check
    if (!config.isPublic && !isOwner(sender)) {
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
                    isOwner: isOwner(sender),
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
    handleGroupParticipants
};