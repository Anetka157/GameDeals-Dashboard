const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./herni_radar.db', (err) => {
    if (err) console.error('Chyba DB:', err.message);
    else console.log('Připojeno k SQLite.');
});

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password_hash TEXT, email TEXT UNIQUE, role TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS watchlist (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, game_title TEXT, target_price REAL, added_date DATETIME DEFAULT CURRENT_TIMESTAMP)");
    db.run("CREATE TABLE IF NOT EXISTS search_history (id INTEGER PRIMARY KEY AUTOINCREMENT, query_term TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, user_id INTEGER)");
    db.run("CREATE TABLE IF NOT EXISTS reset_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, token TEXT, expires_at DATETIME)");
    console.log("Tabulky zinicializovány.");
});

const STORE_IDS = { steam: 1, gog: 7, epic: 25, humble: 11 };
const STORE_NAMES = { 1: 'Steam', 7: 'GOG', 25: 'Epic', 11: 'Humble' };

// ── Hot deals (úvodní stránka) ────────────────────────────
app.get('/hot-deals', async (req, res) => {
    try {
        const response = await axios.get('https://www.cheapshark.com/api/1.0/deals', {
            params: { pageSize: 12, sortBy: 'Deal Rating', onSale: 1, storeID: '1,7,11,25' }
        });
        const deals = response.data.map(deal => ({
            gameID: deal.gameID,
            dealID: deal.dealID,
            title: deal.title,
            thumb: deal.thumb,
            salePrice: parseFloat(deal.salePrice),
            normalPrice: parseFloat(deal.normalPrice),
            savings: parseFloat(deal.savings).toFixed(0),
            storeID: deal.storeID,
            storeName: STORE_NAMES[deal.storeID] || 'Jiný'
        }));
        res.json(deals);
    } catch (err) {
        res.status(500).json({ error: "Chyba při načítání hot deals." });
    }
});

// ── Hledání her ───────────────────────────────────────────
app.get('/search-games', async (req, res) => {
    const { title, store, user_id = 1 } = req.query;
    if (!title) return res.status(400).json({ error: "Chybí název hry." });

    db.run("INSERT INTO search_history (query_term, user_id) VALUES (?, ?)", [title, user_id]);

    try {
        const params = new URLSearchParams({ title, pageSize: 20, sortBy: 'Deal Rating', onSale: 1 });
        if (store && store !== 'all' && STORE_IDS[store]) params.set('storeID', STORE_IDS[store]);

        const response = await axios.get(`https://www.cheapshark.com/api/1.0/deals?${params}`);
        const deals = response.data.map(deal => ({
            gameID: deal.gameID,
            dealID: deal.dealID,
            title: deal.title,
            thumb: deal.thumb,
            salePrice: parseFloat(deal.salePrice),
            normalPrice: parseFloat(deal.normalPrice),
            savings: parseFloat(deal.savings).toFixed(0),
            storeID: deal.storeID,
            storeName: STORE_NAMES[deal.storeID] || 'Jiný'
        }));
        res.json(deals);
    } catch (err) {
        res.status(500).json({ error: "Chyba při komunikaci s API." });
    }
});

// ── Našeptávání ───────────────────────────────────────────
app.get('/suggest', async (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);
    try {
        const response = await axios.get('https://www.cheapshark.com/api/1.0/deals', {
            params: { title: q, pageSize: 8, sortBy: 'Deal Rating', onSale: 1 }
        });
        const seen = new Set();
        const names = [];
        for (const deal of response.data) {
            if (!seen.has(deal.title)) {
                seen.add(deal.title);
                names.push(deal.title);
            }
            if (names.length >= 6) break;
        }
        res.json(names);
    } catch {
        res.json([]);
    }
});

// ── Detail hry ────────────────────────────────────────────
app.get('/game-detail/:dealID', async (req, res) => {
    try {
        const response = await axios.get(`https://www.cheapshark.com/api/1.0/deals?id=${req.params.dealID}`);
        const data = response.data;

        // CheapShark vrací objekt s gameInfo a cheaperStores
        if (!data || !data.gameInfo) {
            return res.status(404).json({ error: "Detail nenalezen." });
        }

        res.json({
            gameInfo: {
                name: data.gameInfo.name || '',
                thumb: data.gameInfo.thumb || data.gameInfo.banner || '',
                salePrice: data.gameInfo.salePrice || '0',
                retailPrice: data.gameInfo.retailPrice || '0',
                metacriticScore: data.gameInfo.metacriticScore || 0,
                steamRatingText: data.gameInfo.steamRatingText || '',
                steamRatingPercent: data.gameInfo.steamRatingPercent || 0,
            },
            cheaperStores: data.cheaperStores || []
        });
    } catch (err) {
        res.status(500).json({ error: "Nepodařilo se načíst detail." });
    }
});

// ── Registrace ────────────────────────────────────────────
app.post('/register', async (req, res) => {
    const { username, password, email } = req.body;
    if (!username || !password || !email) return res.status(400).json({ error: "Vyplň všechna pole." });
    try {
        const hash = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, 'user')`,
            [username, hash, email], function(err) {
                if (err) return res.status(400).json({ error: "Uživatelské jméno nebo email již existuje." });
                res.json({ message: "Registrace úspěšná!", userId: this.lastID });
            });
    } catch { res.status(500).json({ error: "Chyba serveru." }); }
});

// ── Přihlášení ────────────────────────────────────────────
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Vyplň jméno i heslo." });
    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, row) => {
        if (err || !row) return res.status(401).json({ error: "Nesprávné jméno nebo heslo." });
        const shoda = await bcrypt.compare(password, row.password_hash);
        if (!shoda) return res.status(401).json({ error: "Nesprávné jméno nebo heslo." });
        res.json({ message: "Přihlášení úspěšné!", user: row.username, userId: row.id });
    });
});

// ── Zapomenuté heslo ──────────────────────────────────────
app.post('/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Zadej email." });
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, row) => {
        if (!row) return res.json({ message: "Pokud email existuje, přijde ti odkaz." });
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        db.run(`DELETE FROM reset_tokens WHERE user_id = ?`, [row.id]);
        db.run(`INSERT INTO reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`, [row.id, token, expires]);
        const link = `http://localhost:3000/reset-password.html?token=${token}`;
        const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS } });
        try {
            await transporter.sendMail({ from: `"Herní Radar" <${process.env.GMAIL_USER}>`, to: email, subject: "Reset hesla — Herní Radar", html: `<p>Klikni na odkaz (platí 1 hodinu):</p><a href="${link}">${link}</a>` });
        } catch (e) { console.error("Email chyba:", e.message); }
        res.json({ message: "Pokud email existuje, přijde ti odkaz." });
    });
});

// ── Reset hesla ───────────────────────────────────────────
app.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Chybí token nebo heslo." });
    db.get(`SELECT * FROM reset_tokens WHERE token = ?`, [token], async (err, row) => {
        if (!row) return res.status(400).json({ error: "Neplatný nebo expirovaný odkaz." });
        if (new Date(row.expires_at) < new Date()) {
            db.run(`DELETE FROM reset_tokens WHERE token = ?`, [token]);
            return res.status(400).json({ error: "Odkaz vypršel." });
        }
        const hash = await bcrypt.hash(password, 10);
        db.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [hash, row.user_id]);
        db.run(`DELETE FROM reset_tokens WHERE token = ?`, [token]);
        res.json({ message: "Heslo bylo změněno!" });
    });
});

// ── Watchlist ─────────────────────────────────────────────
app.get('/get-watchlist', (req, res) => {
    db.all(`SELECT * FROM watchlist WHERE user_id = ?`, [req.query.user_id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Chyba DB" });
        res.json(rows);
    });
});

app.post('/watchlist', (req, res) => {
    const { user_id, game_title, target_price } = req.body;
    if (!user_id || !game_title) return res.status(400).json({ error: "Chybí data." });
    db.run(`INSERT INTO watchlist (user_id, game_title, target_price) VALUES (?, ?, ?)`,
        [user_id, game_title, target_price || 0], function(err) {
            if (err) return res.status(500).json({ error: "Chyba při ukládání." });
            res.json({ message: "Hra přidána do watchlistu!" });
        });
});

app.delete('/delete-watchlist/:id', (req, res) => {
    db.run(`DELETE FROM watchlist WHERE id = ?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ error: "Chyba při mazání." });
        if (this.changes === 0) return res.status(404).json({ error: "Záznam nenalezen." });
        res.json({ message: "Smazáno!" });
    });
});

app.listen(3000, () => console.log('Server běží na http://localhost:3000'));
process.on('SIGINT', () => { db.close(() => { console.log('DB odpojena.'); process.exit(0); }); });