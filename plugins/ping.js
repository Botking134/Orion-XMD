// plugins/ping.js
const config = require('../config');

module.exports = {
    name: 'ping',
    execute: async (sock, msg, args, ctx) => {
        const start = Date.now();
        const jid = msg.key.remoteJid;

        const sentMsg = await sock.sendMessage(jid, { text: '🏓 *Pinging...*' }, { quoted: msg });
        const latency = Date.now() - start;

        await sock.sendMessage(jid, {
            text: `⚡ *Pong!* \n⏱️ *Latency:* \`${latency}ms\`\n🤖 *Bot:* ${config.botName}`,
            edit: sentMsg.key
        });
    }
};