// plugins/git.js
const { exec } = require('child_process');
const fs = require('fs');
const commands = require('../commands');

// Helper to run shell commands as promises
function runCommand(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) return reject(error);
            resolve(stdout || stderr);
        });
    });
}

/**
 * 1. UPDATE COMMAND (.update)
 * Checks remote commits and pulls ONLY files that don't match GitHub.
 */
const updateCmd = {
    name: 'update',
    execute: async (sock, msg, args, ctx) => {
        const jid = msg.key.remoteJid;
        if (!ctx.isOwner) {
            await sock.sendMessage(jid, { text: '❌ Access Denied! Developers only.' }, { quoted: msg });
            return;
        }

        await sock.sendMessage(jid, { text: '🔍 *Checking for modified files on GitHub...*' }, { quoted: msg });

        try {
            // Fetch remote state
            await runCommand('git fetch origin');

            // Find files that differ between local HEAD and origin/main
            const diffOut = await runCommand('git diff --name-only HEAD origin/main');
            const changedFiles = diffOut.trim().split('\n').filter(f => f.trim().length > 0);

            if (changedFiles.length === 0) {
                await sock.sendMessage(jid, { text: '✅ *All local files match GitHub! No update needed.*' }, { quoted: msg });
                return;
            }

            await sock.sendMessage(jid, {
                text: `📥 *Found ${changedFiles.length} updated file(s) on GitHub:*\n\`\`\`${changedFiles.join('\n')}\`\`\`\n\n*Pulling changed files...*`
            }, { quoted: msg });

            // Checkout/Pull ONLY the files that differ
            const checkoutCmd = `git checkout origin/main -- ${changedFiles.join(' ')}`;
            await runCommand(checkoutCmd);

            // Reload command plugins dynamically
            commands.reload();

            await sock.sendMessage(jid, {
                text: `✅ *Update Complete!*\n\n📄 *Updated Files:*\n\`\`\`${changedFiles.join('\n')}\`\`\`\n\n🔄 *Plugins reloaded.*`
            }, { quoted: msg });

        } catch (err) {
            await sock.sendMessage(jid, { text: `❌ *Update Error:*\n\`\`\`${err.message}\`\`\`` }, { quoted: msg });
        }
    }
};

/**
 * 2. PULL COMMAND (.pull OR .pull <filepath>)
 * Pulls everything OR pulls a specific file (e.g. .pull plugins/ten.js)
 */
const pullCmd = {
    name: 'pull',
    execute: async (sock, msg, args, ctx) => {
        const jid = msg.key.remoteJid;
        if (!ctx.isOwner) {
            await sock.sendMessage(jid, { text: '❌ Access Denied! Developers only.' }, { quoted: msg });
            return;
        }

        const targetFile = args[0] ? args[0].trim() : null;

        try {
            await runCommand('git fetch origin');

            if (!targetFile) {
                // Pull everything
                await sock.sendMessage(jid, { text: '📥 *Pulling all files from origin/main...*' }, { quoted: msg });
                const output = await runCommand('git pull origin main');
                commands.reload();

                await sock.sendMessage(jid, {
                    text: `✅ *Global Pull Complete!*\n\n📋 *Output:*\n\`\`\`${output.trim()}\`\`\``
                }, { quoted: msg });

            } else {
                // Pull specific single file
                await sock.sendMessage(jid, { text: `📥 *Tracking and pulling single file:* \`${targetFile}\`...` }, { quoted: msg });

                await runCommand(`git checkout origin/main -- ${targetFile}`);
                commands.reload();

                await sock.sendMessage(jid, {
                    text: `✅ *Single File Pull Complete!*\n\n📄 *File Pulled:* \`${targetFile}\`\n🔄 *Plugins reloaded.*`
                }, { quoted: msg });
            }

        } catch (err) {
            await sock.sendMessage(jid, { text: `❌ *Pull Failed:*\n\`\`\`${err.message}\`\`\`` }, { quoted: msg });
        }
    }
};

/**
 * 3. PUSH COMMAND (.push OR .push <filepath> [msg])
 * Pushes all files OR pushes a specific file (e.g. .push index.js "fix start")
 */
const pushCmd = {
    name: 'push',
    execute: async (sock, msg, args, ctx) => {
        const jid = msg.key.remoteJid;
        if (!ctx.isOwner) {
            await sock.sendMessage(jid, { text: '❌ Access Denied! Developers only.' }, { quoted: msg });
            return;
        }

        let targetFile = null;
        let commitMsg = 'Auto update from Orion-XMD Bot';

        // Check if first argument is a file path
        if (args[0] && (fs.existsSync(args[0]) || args[0].includes('.'))) {
            targetFile = args[0].trim();
            commitMsg = args.slice(1).join(' ').trim() || `Update ${targetFile}`;
        } else if (args.length > 0) {
            commitMsg = args.join(' ').trim();
        }

        try {
            if (targetFile) {
                // Stage, commit, and push single file
                await sock.sendMessage(jid, { text: `📤 *Pushing single file:* \`${targetFile}\`...\n💬 *Commit:* "${commitMsg}"` }, { quoted: msg });

                await runCommand(`git add ${targetFile}`);
                await runCommand(`git commit -m "${commitMsg.replace(/"/g, '\\"')}" ${targetFile}`);
                const pushOut = await runCommand('git push origin main');

                await sock.sendMessage(jid, {
                    text: `✅ *Single File Push Complete!*\n\n📄 *File Pushed:* \`${targetFile}\`\n📋 *Output:*\n\`\`\`${pushOut.trim()}\`\`\``
                }, { quoted: msg });

            } else {
                // Stage, commit, and push all files
                await sock.sendMessage(jid, { text: `📤 *Pushing all modified files to GitHub...*\n💬 *Commit:* "${commitMsg}"` }, { quoted: msg });

                await runCommand('git add .');
                await runCommand(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
                const pushOut = await runCommand('git push origin main');

                await sock.sendMessage(jid, {
                    text: `✅ *Global Push Complete!*\n\n📋 *Output:*\n\`\`\`${pushOut.trim()}\`\`\``
                }, { quoted: msg });
            }

        } catch (err) {
            await sock.sendMessage(jid, { text: `❌ *Push Failed:*\n\`\`\`${err.message}\`\`\`` }, { quoted: msg });
        }
    }
};

/**
 * 4. GIT STATUS COMMAND (.gitstatus)
 * Shows current working tree status
 */
const statusCmd = {
    name: 'gitstatus',
    execute: async (sock, msg, args, ctx) => {
        const jid = msg.key.remoteJid;
        if (!ctx.isOwner) {
            await sock.sendMessage(jid, { text: '❌ Access Denied! Developers only.' }, { quoted: msg });
            return;
        }

        try {
            const output = await runCommand('git status');
            await sock.sendMessage(jid, {
                text: `📊 *GIT STATUS:*\n\`\`\`${output.trim()}\`\`\``
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(jid, { text: `❌ *Status Error:*\n\`\`\`${err.message}\`\`\`` }, { quoted: msg });
        }
    }
};

module.exports = [updateCmd, pullCmd, pushCmd, statusCmd];