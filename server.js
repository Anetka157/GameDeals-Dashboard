const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./herni_radar.db', (err) => {
    if (err) {
        console.error('Chyba při otevírání databáze:', err.message);
    } else {
        console.log('Připojeno k SQLite databázi.');
    }
});


db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password_hash TEXT, email TEXT, role TEXT)");

    db.run("CREATE TABLE IF NOT EXISTS watchlist (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, game_title TEXT, target_price REAL, added_date DATETIME DEFAULT CURRENT_TIMESTAMP)");

    db.run("CREATE TABLE IF NOT EXISTS search_history (id INTEGER PRIMARY KEY AUTOINCREMENT, query_term TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, user_id INTEGER)");

    db.run("CREATE TABLE IF NOT EXISTS system_log (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT, message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");

    console.log("Tabulky byly zinicializovány podle schématu.");
});


app.get('/search-games', async (req, res) => {
    const title = req.query.title;
    const userId = req.query.user_id || 1;

    db.run("INSERT INTO search_history (query_term, user_id) VALUES (?, ?)", [title, userId]);
    try {
        const response = await axios.get(`https://www.cheapshark.com/api/1.0/games?title=${title}&limit=12`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Chyba při komunikaci s API" });
    }
});

app.get('/get-watchlist', (req, res) => {
    const userId = req.query.user_id;

    console.log(`SERVER: Prohlížím watchlist pro uživatele ID: ${userId}`);

    const sql = `SELECT * FROM watchlist WHERE user_id = ?`;

    db.all(sql, [userId], (err, rows) => {
        if (err) {
            console.error("CHYBA DB:", err.message);
            return res.status(500).json({ error: "Chyba v DB" });
        }
        res.json(rows);
    });
});

app.delete('/delete-watchlist/:id', (req, res) => {
    const id = req.params.id;
    console.log("SERVER: Požadavek na smazání ID:", id);

    const sql = `DELETE FROM watchlist WHERE id = ?`;

    db.run(sql, id, function(err) {
        if (err) {
            console.error("SERVER CHYBA (DB):", err.message);
            return res.status(500).json({ error: "Chyba při mazání z databáze" });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: "Hra s tímto ID nebyla nalezena" });
        }

        console.log("SERVER: Smazáno z DB.");
        res.json({ message: "Hra byla úspěšně smazána!" });
    });
});

app.post('/register', (req, res) => {
    const { username, password, email } = req.body;
    const role = 'user';

    const sql = `INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)`;
    db.run(sql, [username, password, email, role], function(err) {
        if (err) {
            return res.status(400).json({ error: "Uživatelské jméno již existuje." });
        }
        res.json({ message: "Registrace byla úspěšná!", userId: this.lastID });
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get(`SELECT * FROM users WHERE username = ? AND password_hash = ?`, [username, password], (err, row) => {
        if (err || !row) {
            return res.status(401).json({ error: "Nesprávné jméno nebo heslo." });
        }
        res.json({
            message: "Přihlášení proběhlo úspěšně!",
            user: row.username,
            userId: row.id
        });
    });
});

app.post('/watchlist', (req, res) => {
    const { user_id, game_title, target_price } = req.body;

    console.log("UKLÁDÁM DO WL:", game_title);

    const sql = `INSERT INTO watchlist (user_id, game_title, target_price) VALUES (?, ?, ?)`;
    db.run(sql, [user_id, game_title, target_price], function(err) {
        if (err) {
            return res.status(500).json({ error: "Chyba při ukládání." });
        }
        res.json({ message: "Hra přidána do watchlistu!" });
    });
});


app.get('/', (req, res) => {
    res.send('Backend, databáze i API logika jsou připraveny!');
});

app.listen(3000, () => {
    console.log('Server běží na http://localhost:3000');
});

process.on('SIGINT', () => {
    db.close((err) => {
        if (err) console.error(err.message);
        console.log('Databáze byla bezpečně odpojena.');
        process.exit(0);
    });
});