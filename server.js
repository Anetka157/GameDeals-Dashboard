const express = require('express');
const sqlite3 = require('sqlite3').verbose();
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
    db.run("CREATE TABLE IF NOT EXISTS watchlist (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, game_title TEXT, target_price REAL, added_date TEXT)");
    console.log("Tabulky byly zinicializovány.");
});

app.get('/', (req, res) => {
    res.send('Backend i databáze jsou připraveny!');
});

app.listen(3000, () => {
    console.log('Server běží na http://localhost:3000');
});



process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Databáze byla bezpečně odpojena.');
        process.exit(0);
    });
});