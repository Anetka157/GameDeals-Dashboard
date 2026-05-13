async function hledatHry() {
    const query = document.getElementById('game-input').value;
    const vystup = document.getElementById('deals-grid');
    const KURZ = 24;

    if (!query) return alert("Napiš název hry!");

    vystup.innerHTML = "<p>Hledám nejlepší slevy...</p>";

    try {
        const response = await fetch(`/search-games?title=${encodeURIComponent(query)}`);
        const hry = await response.json();

        vystup.innerHTML = "";

        hry.forEach(hra => {

            const cenaCZK = Math.round(hra.cheapest * KURZ);

            vystup.innerHTML += `
                <div class="card">
                    <div class="card__image">
                        <img src="${hra.thumb}" style="width:100%; border-radius:8px 8px 0 0;">
                    </div>
                    <div class="card__body">
                        <div class="card__title">${hra.external}</div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                            <span>
                                <span class="card__price">${cenaCZK} Kč</span>
                            </span>
                            <button class="btn btn-outline" 
                                    style="padding:3px 8px; font-size:0.75rem;"
                                    onclick="pridatDoWatchlistu('${hra.external}', ${cenaCZK})">
                                + WL
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
    } catch (err) {
        vystup.innerHTML = "<p>Chyba při komunikaci se serverem.</p>";
    }
}

async function pridatDoWatchlistu(nazev, cena) {
    const response = await fetch('/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: 1,
            game_title: nazev,
            target_price: cena
        })
    });

    const data = await response.json();
    alert(data.message);
}