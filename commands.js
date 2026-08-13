// commands.js
const fs = require('fs');
const path = require('path');
const config = require('./config');

const commands = module.exports;
const pluginsDir = path.join(__dirname, 'plugins');

// Ensure plugins directory exists
if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
}

function getFilesRecursive(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;

    const list = fs.readdirSync(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFilesRecursive(filePath));
        } else if (file.endsWith('.js')) {
            results.push(filePath);
        }
    }
    return results;
}

function register(cmd) {
    if (!cmd.name || typeof cmd.execute !== 'function') return;
    const key = cmd.name.toLowerCase();
    commands[key] = cmd.execute;
}

function loadCommands() {
    for (const key in commands) {
        delete commands[key];
    }

    const files = getFilesRecursive(pluginsDir);
    for (const filePath of files) {
        try {
            delete require.cache[require.resolve(filePath)];
            const plugin = require(filePath);
            if (Array.isArray(plugin)) {
                plugin.forEach(cmd => register(cmd));
            } else {
                register(plugin);
            }
        } catch (err) {
            console.error(`⚠️ Failed to load plugin [${path.basename(filePath)}]:`, err.message);
        }
    }
    console.log(`✅ [COMMANDS] Loaded ${Object.keys(commands).length} plugin commands.`);
}

loadCommands();

commands.reload = loadCommands;