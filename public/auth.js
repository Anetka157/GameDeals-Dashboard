async function odeslatRegistraci() {
    const u = document.getElementById('reg-user').value.trim();
    const e = document.getElementById('reg-email').value.trim();
    const p = document.getElementById('reg-pass').value;
    const p2 = document.getElementById('reg-pass2').value;
    const err = document.getElementById('pass-error');

    // Kontrola shody hesel
    if (p !== p2) {
        err.style.display = 'block';
        return;
    }
    err.style.display = 'none';

    if (p.length < 6) return alert("Heslo musí mít alespoň 6 znaků.");

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, email: e, password: p })
        });
        const data = await response.json();
        if (response.ok) {
            alert("Registrace úspěšná! Teď se můžeš přihlásit.");
            window.location.href = "index.html";
        } else {
            alert("Chyba: " + data.error);
        }
    } catch {
        alert("Server neodpovídá.");
    }
}

async function prihlaseni() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('userId', data.userId);
            localStorage.setItem('userName', data.user);
            window.location.href = "dashboard.html";
        } else {
            alert("Chyba: " + data.error);
        }
    } catch {
        alert("Server neodpovídá.");
    }
}