// plugins/update.js
const { exec } = require('child_process');
const commands = require('../commands');

module.exports = {
    name: 'update',
    execute: async (sock, msg, args, ctx) => {
        const jid = msg.key.remoteJid;

        // Developer / Owner Only Access
        if (!ctx.isOwner) {
            await sock.sendMessage(jid, { text: '❌ Access Denied! Only Developers can use the update command.' }, { quoted: msg });
            return;
        }

        await sock.sendMessage(jid, { text: '🔄 *Checking repository for updates...*' }, { quoted: msg });

        // Execute git pull
        exec('git pull', async (error, stdout, stderr) => {
            if (error) {
                console.error('[UPDATE] Git pull error:', error.message);
                await sock.sendMessage(jid, { text: `❌ *Update Failed:*\n\`\`\`${error.message}\`\`\`` }, { quoted: msg });
                return;
            }

            if (stderr && stderr.includes('error:')) {
                await sock.sendMessage(jid, { text: `❌ *Git Error:*\n\`\`\`${stderr}\`\`\`` }, { quoted: msg });
                return;
            }

            const output = stdout.trim();

            if (output.includes('Already up to date.') || output.includes('Already up-to-date.')) {
                await sock.sendMessage(jid, { text: '✅ *Orion-XMD is already up to date!*' }, { quoted: msg });
                return;
            }

            // Reload command plugins dynamically
            try {
                commands.reload();
                await sock.sendMessage(jid, {
                    text: `✅ *Update Successful!*\n\n📋 *Git Output:*\n\`\`\`${output}\`\`\`\n\n🔄 *Plugins reloaded successfully.*`
                }, { quoted: msg });
            } catch (reloadErr) {
                await sock.sendMessage(jid, {
                    text: `⚠️ *Git Pulled, but Reload Failed:*\n\`\`\`${reloadErr.message}\`\`\``
                }, { quoted: msg });
            }
        });
    }
};