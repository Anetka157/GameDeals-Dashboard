async function odeslatRegistraci() {
    const u = document.getElementById('reg-user').value;
    const e = document.getElementById('reg-email').value;
    const p = document.getElementById('reg-pass').value;

    console.log("Pokouším se registrovat:", u, e);

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
    } catch (err) {
        console.error("Chyba sítě:", err);
        alert("Server neodpovídá.");
    }
}

async function prihlaseni() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;

    console.log("Pokouším se přihlásit uživatele:", u);

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });

        const data = await response.json();

        if (response.ok) {
            alert("Vítej, " + data.user + "!");
            window.location.href = "dashboard.html";
        } else {
            alert("Chyba: " + data.error);
        }
    } catch (err) {
        console.error("Chyba při přihlašování:", err);
        alert("Server neodpovídá.");
    }
}