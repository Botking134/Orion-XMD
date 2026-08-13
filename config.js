// config.js
const path = require('path');

// Helper to normalize phone numbers to JID format
function normalizeJid(input) {
    if (!input) return null;
    const clean = String(input).replace(/:[\d]+@/, '@');
    if (clean.endsWith('@s.whatsapp.net') || clean.endsWith('@lid')) return clean;
    const number = clean.replace(/[^0-9]/g, '');
    return number ? `${number}@s.whatsapp.net` : null;
}

const config = {
    // Bot Branding
    botName: "Orion-XMD",
    ownerName: "Infinity",
    prefix: ".",

    // Owner Settings
    ownerNumber: "2347059092107", // Enter primary owner phone number with country code
    owners: [],                    // Secondary owner numbers/JIDs

    // Sticker Defaults
    packName: "Orion-XMD",
    author: "Infinity",

    // Bot Operational Modes
    isPublic: true,                // true = public mode, false = owner only
    autoReadStatus: false,         // Auto mark WhatsApp status updates as viewed
    autoReact: false               // Auto react to executed commands
};

// Auto-derive primary owner JID
config.ownerJid = normalizeJid(config.ownerNumber);

module.exports = config;