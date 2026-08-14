// plugins/ten.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const INVENTORY_PATH = path.join(__dirname, '..', 'storage', 'ben10_inventory.json');
const activeSpawns = new Map();

// Download image buffer with full browser headers to bypass Wikia CDN blocks
async function getImageBuffer(url) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://ben10.fandom.com/'
            }
        });
        return Buffer.from(response.data);
    } catch (e) {
        console.error('[TEN] Image download fallback triggered:', e.message);
        return null;
    }
}

// Reliable direct Ben 10 Alien Database
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

function loadInventory() {
    try {
        if (fs.existsSync(INVENTORY_PATH)) {
            return JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf-8'));
        }
    } catch (e) {}
    return {};
}

function saveInventory(data) {
    try {
        const dir = path.dirname(INVENTORY_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(INVENTORY_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {}
}

function generateCaptcha(length = 5) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let res = '';
    for (let i = 0; i < length; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return res;
}

const alienCmd = {
    name: 'alien',
    execute: async (sock, msg, args, ctx) => {
        const jid = msg.key.remoteJid;

        try {
            await sock.sendMessage(jid, { react: { text: '⌚', key: msg.key } }).catch(() => {});

            const alien = BEN10_ALIENS[Math.floor(Math.random() * BEN10_ALIENS.length)];
            const captcha = generateCaptcha(5);
            const dnaValue = Math.floor(alien.power / 2) + Math.floor(Math.random() * 400);

            activeSpawns.set(jid, {
                captcha: captcha,
                alien: { ...alien, dnaValue },
                expiresAt: Date.now() + (3 * 60 * 1000)
            });

            const caption = 
`⌚ *OMNITRIX SIGNAL DETECTED!*
🛸 *Alien Transformation Appeared!*

⭐ *Alien:* ${alien.name}
👽 *Species:* ${alien.species}
🪐 *Homeworld:* ${alien.homeworld}
⚡ *Power:* ${alien.power.toLocaleString()}
🔥 *Abilities:* ${alien.abilities}

💰 *DNA Value:* ${dnaValue.toLocaleString()} Gold
🔐 *Omnitrix Code:* ${captcha}

Use *${ctx.prefix}claimalien ${captcha}* to claim this DNA!`;

            // Download image buffer with full browser headers
            const imgBuffer = await getImageBuffer(alien.image);

            if (imgBuffer) {
                await sock.sendMessage(jid, { image: imgBuffer, caption: caption });
            } else {
                await sock.sendMessage(jid, { text: caption });
            }

        } catch (err) {
            console.error('[TEN] Alien spawn error:', err.message);
            await sock.sendMessage(jid, { text: '❌ Omnitrix signal failed.' }, { quoted: msg });
        }
    }
};

const claimCmd = {
    name: 'claimalien',
    execute: async (sock, msg, args, ctx) => {
        const jid = msg.key.remoteJid;
        const sender = ctx.sender;
        const spawn = activeSpawns.get(jid);

        if (!spawn) {
            await sock.sendMessage(jid, { text: '❌ No active Omnitrix signal! Type *.alien* to scan for aliens.' }, { quoted: msg });
            return;
        }

        const inputCode = (args[0] || '').trim().toUpperCase();
        if (inputCode !== spawn.captcha) {
            await sock.sendMessage(jid, { text: '❌ Invalid Omnitrix code!' }, { quoted: msg });
            return;
        }

        const alien = spawn.alien;
        activeSpawns.delete(jid);

        const inventory = loadInventory();
        if (!inventory[sender]) inventory[sender] = { dnaGold: 0, aliens: [] };

        inventory[sender].aliens.push({ name: alien.name, species: alien.species, power: alien.power });
        inventory[sender].dnaGold += alien.dnaValue;
        saveInventory(inventory);

        const senderPhone = sender.split('@')[0];
        await sock.sendMessage(jid, {
            text: `🎉 *@${senderPhone}* claimed *${alien.name}* (${alien.species})!\n💰 +${alien.dnaValue.toLocaleString()} DNA Gold added!`,
            mentions: [sender]
        }, { quoted: msg });
    }
};

const omnitrixCmd = {
    name: 'myomnitrix',
    execute: async (sock, msg, args, ctx) => {
        const jid = msg.key.remoteJid;
        const sender = ctx.sender;

        const inventory = loadInventory();
        const data = inventory[sender];

        if (!data || data.aliens.length === 0) {
            await sock.sendMessage(jid, { text: '⌚ Your Omnitrix has no saved DNA! Use *.alien* to find aliens.' }, { quoted: msg });
            return;
        }

        const senderPhone = sender.split('@')[0];
        let text = `⌚ *OMNITRIX PLAYLIST FOR @${senderPhone}*\n`;
        text += `💰 *DNA Gold:* ${data.dnaGold.toLocaleString()}\n`;
        text += `🛸 *Unlocked Aliens:* ${data.aliens.length}\n\n`;

        data.aliens.slice(-10).reverse().forEach((a, i) => {
            text += `${i + 1}. *${a.name}* (${a.species}) — ⚡ ${a.power}\n`;
        });

        await sock.sendMessage(jid, { text: text, mentions: [sender] }, { quoted: msg });
    }
};

module.exports = [alienCmd, claimCmd, omnitrixCmd];