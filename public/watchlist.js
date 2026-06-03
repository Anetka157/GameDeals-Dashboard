const KURZ = 24;

document.addEventListener('DOMContentLoaded', async () => {
    const seznam = document.getElementById('watchlist-grid');
    const userId = localStorage.getItem('userId');

    if (!userId) {
        seznam.innerHTML = "<tr><td colspan='6' style='color:#a0a0b0; text-align:center; padding:1.5rem;'>Musíš se nejdříve <a href='index.html'>přihlásit</a>.</td></tr>";
        return;
    }

    try {
        const response = await fetch(`/get-watchlist?user_id=${userId}`);
        const hry = await response.json();

        if (hry.length === 0) {
            seznam.innerHTML = "<tr><td colspan='6' style='color:#a0a0b0; text-align:center; padding:1.5rem;'>Tvůj watchlist je prázdný.</td></tr>";
            return;
        }

        // Nejdřív vykresli řádky se základními daty
        seznam.innerHTML = "";
        hry.forEach(hra => {
            const cenaPridani = hra.target_price ? Math.round(hra.target_price * KURZ) + ' Kč' : '—';

            // Predpokladáme, že backend ti posiela aktuálnu cenu (hra.current_price alebo podobne)
            // a normálnu cenu (hra.normal_price). Prispôsob názvy premenných podľa vášho backendu.
            const uzNeniVeSleve = hra.current_price >= hra.normal_price;

            // Vytvoríme CSS štýl pre preškrtnutie a zmenu farby na nevýraznú sivú
            const stylPreSkrtnuti = uzNeniVeSleve ? 'style="text-decoration: line-through; color: #7a7a8a;"' : '';

            // Voliteľné: Môžeš pridať aj malý červený text "Akcia skončila"
            const statusBadge = uzNeniVeSleve ? '<span style="color: #e57373; font-size: 0.75rem; margin-left: 8px; font-weight: normal; text-decoration: none !important; display: inline-block;">[Akcia skončila]</span>' : '';

            let riadek = `
      <tr>
        <td ${stylPreSkrtnuti}>
            <strong>${hra.game_title}</strong> ${statusBadge}
        </td>
        <td>${hra.store_name || 'Obchod'}</td>
        <td>${cenaPridani}</td>
        <td ${stylPreSkrtnuti}>${Math.round(hra.current_price * KURZ)} Kč</td>
        <td>${datum}</td>
        <td>
          <button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem; border-color:#e57373; color:#e57373;" 
                  onclick="smazatZWatchlistu(${hra.id})">✕</button>
        </td>
      </tr>
    `;
            seznam.innerHTML += riadek;
        });

        // Pak asynchronně dotáhni aktuální ceny
        hry.forEach(hra => nacistAktualniCenu(hra.id, hra.game_title));

    } catch (err) {
        seznam.innerHTML = "<tr><td colspan='6' style='color:#e57373; text-align:center;'>Chyba při komunikaci se serverem.</td></tr>";
    }
});

// Načte aktuální cenu z CheapShark pro danou hru
async function nacistAktualniCenu(id, nazev) {
    const bunka = document.getElementById(`cena-${id}`);
    if (!bunka) return;

    try {
        const response = await fetch(`/search-games?title=${encodeURIComponent(nazev)}&store=all`);
        const hry = await response.json();

        if (!hry.length) {
            bunka.textContent = '—';
            return;
        }

        // Najdi nejlevnější shodu
        const shoda = hry.find(h => h.title.toLowerCase() === nazev.toLowerCase()) || hry[0];
        const cenaCZK = Math.round(shoda.salePrice * KURZ);
        bunka.textContent = cenaCZK + ' Kč';
        bunka.style.color = '#e0e0e0';

    } catch {
        bunka.textContent = '—';
    }
}

// Kliknutí na název — najde hru a otevře modal
async function hledatAOtevrit(nazev) {
    const modalBody = document.getElementById('modal-body');
    const modal = document.getElementById('modal');
    modal.style.display = 'flex';
    modalBody.innerHTML = `<p style="color:#a0a0b0; text-align:center; padding:2rem;">Hledám ${nazev}...</p>`;

    try {
        const response = await fetch(`/search-games?title=${encodeURIComponent(nazev)}&store=all`);
        const hry = await response.json();

        if (!hry.length) {
            modalBody.innerHTML = `<p style="color:#a0a0b0; text-align:center; padding:2rem;">Hra nebyla nalezena v aktuálních slevách.</p>`;
            return;
        }

        const hra = hry.find(h => h.title.toLowerCase() === nazev.toLowerCase()) || hry[0];
        otevritDetail(hra.dealID, hra.title, hra.salePrice);

    } catch {
        modalBody.innerHTML = `<p style="color:#e57373; text-align:center; padding:2rem;">Chyba při hledání hry.</p>`;
    }
}

// Modal detail — stejná funkce jako v games.js
async function otevritDetail(dealID, title, salePrice) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    modal.style.display = 'flex';
    modalBody.innerHTML = `<p style="color:#a0a0b0; text-align:center; padding:2rem;">Načítám detail...</p>`;

    try {
        const response = await fetch(`/game-detail/${dealID}`);
        const data = await response.json();

        if (data.error || !data.gameInfo) {
            const cenaCZK = Math.round(parseFloat(salePrice) * KURZ);
            modalBody.innerHTML = `
                <h2 style="font-size:1.1rem; margin-bottom:1rem;">${title}</h2>
                <p style="color:#a0a0b0; font-size:0.85rem; margin-bottom:1rem;">Detail není dostupný.</p>
                <p style="font-size:1.4rem; font-weight:600; color:#00bcd4; margin-bottom:1.25rem;">${cenaCZK} Kč</p>
            `;
            return;
        }

        const game = data.gameInfo;
        const cenaCZK = Math.round(parseFloat(game.salePrice) * KURZ);
        const origCZK = Math.round(parseFloat(game.retailPrice) * KURZ);
        const deals = data.cheaperStores || [];

        modalBody.innerHTML = `
            <div style="display:flex; gap:1.25rem; flex-wrap:wrap;">
                ${game.thumb ? `<img src="${game.thumb}" style="width:190px; border-radius:8px; object-fit:cover; flex-shrink:0; align-self:flex-start;">` : ''}
                <div style="flex:1; min-width:180px;">
                    <h2 style="font-size:1.05rem; margin-bottom:0.6rem;">${title}</h2>
                    <div style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-bottom:0.75rem;">
                        ${game.metacriticScore > 0 ? `<span style="font-size:0.8rem; background:#4caf5020; color:#4caf50; padding:2px 8px; border-radius:4px;">Metacritic ${game.metacriticScore}</span>` : ''}
                        ${game.steamRatingText ? `<span style="font-size:0.8rem; background:#66c0f420; color:#66c0f4; padding:2px 8px; border-radius:4px;">${game.steamRatingText} (${game.steamRatingPercent}%)</span>` : ''}
                    </div>
                    <p style="font-size:0.78rem; color:#a0a0b0; margin-bottom:0.25rem;">Aktuální cena</p>
                    <p style="margin-bottom:1rem;">
                        <span style="font-size:1.4rem; font-weight:600; color:#00bcd4;">${cenaCZK} Kč</span>
                        ${origCZK > cenaCZK ? `<span style="font-size:0.85rem; color:#555; text-decoration:line-through; margin-left:8px;">${origCZK} Kč</span>` : ''}
                    </p>
                    ${deals.length > 0 ? `
                        <p style="font-size:0.75rem; color:#a0a0b0; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.4rem;">Také v jiných obchodech</p>
                        ${deals.map(d => `
                            <div style="display:flex; justify-content:space-between; font-size:0.82rem; padding:5px 0; border-bottom:1px solid #2a2d3a;">
                                <span style="color:#a0a0b0;">${d.storeName || 'Jiný'}</span>
                                <span style="color:#00bcd4;">${Math.round(parseFloat(d.salePrice) * KURZ)} Kč</span>
                            </div>
                        `).join('')}
                    ` : ''}
                </div>
            </div>
        `;
    } catch {
        modalBody.innerHTML = `<p style="color:#e57373; text-align:center; padding:2rem;">Nepodařilo se načíst detail.</p>`;
    }
}

function zavritModal() {
    document.getElementById('modal').style.display = 'none';
}

async function smazatZWatchlistu(id) {
    if (!confirm("Opravdu chceš tuto hru smazat?")) return;
    try {
        const response = await fetch('/delete-watchlist/' + id, { method: 'DELETE' });
        const data = await response.json();
        if (response.ok) location.reload();
        else alert("Chyba: " + data.error);
    } catch { alert("Chyba při mazání."); }
}