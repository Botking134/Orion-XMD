// handlers/ben10.js
const fs = require('fs');
const path = require('path');

// Track active group chats
const activeGroups = new Set();
let timerStarted = false;

// ─── ALIEN DATABASE FOR AUTOMATIC SPAWNS ───────────────────────────
const BEN10_ALIENS = [
    { name: "Heatblast", species: "Pyronite", homeworld: "Pyros", power: 8500, abilities: "Pyrokinesis, Flight", image: "https://static.wikia.nocookie.net/ben10/images/d/d5/Heatblast_OS_Official.png" },
    { name: "XLR8", species: "Kineceleran", homeworld: "Kinet", power: 8200, abilities: "Super Speed, Sharp Claws", image: "https://static.wikia.nocookie.net/ben10/images/7/73/XLR8_OS_Official.png" },
    { name: "Four Arms", species: "Tetramand", homeworld: "Khoros", power: 9000, abilities: "Enhanced Strength, Sonic Clap", image: "https://static.wikia.nocookie.net/ben10/images/c/cb/Four_Arms_OS_Official.png" },
    { name: "Diamondhead", species: "Petrosapien", homeworld: "Petropia", power: 8800, abilities: "Crystallokinesis, Shielding", image: "https://static.wikia.nocookie.net/ben10/images/d/d4/Diamondhead_OS_Official.png" },
    { name: "Cannonbolt", species: "Arburian Pelarota", homeworld: "Arburia", power: 8600, abilities: "Sphere Shell, Ricochet", image: "https://static.wikia.nocookie.net/ben10/images/1/1a/Cannonbolt_OS_Official.png" },
    { name: "Swampfire", species: "Methanosian", homeworld: "Methanos", power: 9200, abilities: "Chlorokinesis, Fire Blast", image: "https://static.wikia.nocookie.net/ben10/images/e/e4/Swampfire_AF_Official.png" },
    { name: "Humungousaur", species: "Vaxasaurian", homeworld: "Terradino", power: 9500, abilities: "Size Growth, Super Strength", image: "https://static.wikia.nocookie.net/ben10/images/3/36/Humungousaur_AF_Official.png" },
    { name: "Big Chill", species: "Necrofriggian", homeworld: "Kylmyys", power: 9100, abilities: "Freeze Breath, Intangibility", image: "https://static.wikia.nocookie.net/ben10/images/2/23/Big_Chill_AF_Official.png" },
    { name: "Alien X", species: "Celestialsapien", homeworld: "Forge of Creation", power: 100000, abilities: "Omnipotence, Reality Warping", image: "https://static.wikia.nocookie.net/ben10/images/d/d6/Alien_X_AF_Official.png" },
    { name: "Feedback", species: "Conductoid", homeworld: "Teslavorr", power: 9400, abilities: "Energy Absorption", image: "https://static.wikia.nocookie.net/ben10/images/7/77/Feedback_OV_Official.png" }
];

function generateCaptcha(length = 5) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let res = '';
    for (let i = 0; i < length; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return res;
}

/**
 * Automatically spawns an alien in active groups every 30 minutes
 */
async function spawnAlienInGroup(sock, jid) {
    try {
        const tenPlugin = require('../plugins/ten');
        // Retrieve activeSpawns map from plugin if exported or handle locally
        const alien = BEN10_ALIENS[Math.floor(Math.random() * BEN10_ALIENS.length)];
        const captcha = generateCaptcha(5);
        const dnaValue = Math.floor(alien.power / 2) + Math.floor(Math.random() * 400);

        const caption = 
`⌚ *AUTOMATIC OMNITRIX SIGNAL DETECTED!*
🛸 *A Wild Alien Transformation Appeared!*

⭐ *Alien:* ${alien.name}
👽 *Species:* ${alien.species}
🪐 *Homeworld:* ${alien.homeworld}
⚡ *Power:* ${alien.power.toLocaleString()}

💰 *DNA Value:* ${dnaValue.toLocaleString()} Gold
🔐 *Omnitrix Code:* ${captcha}

Use *.claimalien ${captcha}* to claim this DNA!`;

        await sock.sendMessage(jid, {
            image: { url: alien.image },
            caption: caption
        });

    } catch (err) {
        console.error(`[BEN10 HANDLER] Failed automatic spawn in ${jid}:`, err.message);
    }
}

module.exports = {
    // Record group activity when messages arrive
    onMessage: (sock, msg, jid) => {
        if (jid && jid.endsWith('@g.us')) {
            activeGroups.add(jid);
        }
    },

    // 30-minute interval timer for automatic spawns
    initTimer: (sock) => {
        if (timerStarted) return;
        timerStarted = true;

        const THIRTY_MINUTES = 30 * 60 * 1000;
        console.log('🛸 [BEN10 HANDLER] Started 30-minute automatic alien spawner timer.');

        setInterval(async () => {
            if (activeGroups.size === 0) return;

            console.log(`🛸 [BEN10 HANDLER] Triggering 30-min spawn across ${activeGroups.size} active group(s)...`);
            for (const groupJid of activeGroups) {
                await spawnAlienInGroup(sock, groupJid);
            }
        }, THIRTY_MINUTES);
    }
};