// handlers.js
const config = require('./config');
const commands = require('./commands');

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

async function handleMessage(sock, chatUpdate) {
    const msg = chatUpdate.messages?.[0];
    if (!msg || !msg.message) return;

    const jid = msg.key.remoteJid;
    const senderRaw = msg.key.participant || msg.key.remoteJid || '';
    const sender = normalizeJid(senderRaw);

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

    // Check if message is a command
    if (!trimmedText.startsWith(prefix)) return;

    const withoutPrefix = trimmedText.slice(prefix.length).trim();
    const parts = withoutPrefix.split(/\s+/);
    const commandName = parts.shift().toLowerCase();
    const args = parts;

    // Dispatch command
    const handler = commands[commandName];
    if (handler && typeof handler === 'function') {
        try {
            await handler(sock, msg, args, {
                isOwner: isOwner(sender),
                sender: sender,
                prefix: prefix
            });
        } catch (err) {
            console.error(`[HANDLERS] Error in command '${commandName}':`, err);
            await sock.sendMessage(jid, { text: '❌ An error occurred while running the command.' }).catch(() => {});
        }
    }
}

async function handleGroupParticipants(sock, update) {
    // Group event handler placeholder
}

module.exports = {
    handleMessage,
    handleGroupParticipants
};