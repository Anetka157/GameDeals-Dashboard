document.addEventListener('DOMContentLoaded', async () => {
    const seznam = document.getElementById('watchlist-grid');

    const userId = localStorage.getItem('userId');

    if (!userId) {
        seznam.innerHTML = "<p>Musíš se nejdříve přihlásit.</p>";
        return;
    }

    try {
        const response = await fetch(`/get-watchlist?user_id=${userId}`);
        const hry = await response.json();

        if (hry.length === 0) {
            seznam.innerHTML = "<tr><td colspan='6'>Tvůj watchlist je prázdný.</td></tr>";
            return;
        }

        seznam.innerHTML = "";

        hry.forEach(hra => {
            const cenaCZK = Math.round(hra.target_price * 24);

            seznam.innerHTML += `
                <tr>
                    <td>${hra.game_title}</td>
                    <td><span class="badge badge-steam">PC</span></td>
                    <td style="color:#00bcd4;">${cenaCZK} Kč</td>
                    <td>—</td> 
                    <td style="color:#a0a0b0;">Nyní</td>
                    <td>
                        <button class="btn btn-outline" 
                                style="padding:3px 8px; font-size:0.75rem; color:#e57373; border-color:#e57373;"
                                onclick="smazatZWatchlistu(${hra.id})">
                            Odebrat
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Chyba při načítání watchlistu:", err);
        if (seznam) seznam.innerHTML = "<tr><td colspan='6'>Chyba při komunikaci se serverem.</td></tr>";
    }
});


async function smazatZWatchlistu(id) {
    console.log("JS: Posílám žádost o smazání ID:", id);

    if (!confirm("Opravdu chceš tuto hru smazat?")) return;

    try {
        const response = await fetch('/delete-watchlist/' + id, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            alert("Smazáno!");
            location.reload();
        } else {
            console.error("Server odpověděl chybou:", data.error);
            alert("Chyba: " + data.error);
        }
    } catch (err) {
        console.error("Chyba při fetchi:", err);
    }
}