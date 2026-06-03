const KURZ = 24;
let aktualniStore = 'all';
let naseptavaciTimeout = null;

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Filtr chipy
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', function () {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            aktualniStore = this.dataset.store || 'all';

            const query = document.getElementById('game-input').value.trim();
            if (query) {
                hledatHry();
            } else {
                // OPRAVA: Pokud je vyhledávací pole prázdné, aplikujeme filtr na úvodní slevy
                nacistHotDeals();
            }
        });
    });

    // Našeptávání
    const input = document.getElementById('game-input');
    input.addEventListener('input', () => {
        clearTimeout(naseptavaciTimeout);
        const q = input.value.trim();
        if (q.length < 2) {
            skrytNaseptavac();
            return;
        }
        naseptavaciTimeout = setTimeout(() => nacistNaseptavani(q), 300);
    });

    // Zavřít našeptávač při kliknutí mimo
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrap')) skrytNaseptavac();
    });

    // Načíst hot deals při startu
    nacistHotDeals();
});

// ── Hot deals ─────────────────────────────────────────────
async function nacistHotDeals() {
    const vystup = document.getElementById('deals-grid');
    vystup.innerHTML = "<p style='color:#a0a0b0; grid-column:1/-1;'>Načítám ty nejlepší slevy...</p>";

    try {
        // Převod názvů z tvých tlačítek na ID obchodů v CheapShark databázi
        const storeMap = { steam: "1", gog: "7", humble: "11", epic: "25" };

        // Pokud je vybráno "Vše", vezmeme všechny 4 hlavní obchody, jinak jen ten kliknutý
        const storeIds = aktualniStore === 'all' ? "1,7,11,25" : storeMap[aktualniStore.toLowerCase()];

        // Magie! Stahujeme rovnou z API:
        // metacritic=75 -> Ukáže jen hry s vysokým hodnocením (žádné neznámé hovadiny)
        // sortBy=Deal Rating -> Seřadí od nejvýhodnější slevy
        // pageSize=30 -> Načte vždy rovných 30 her pro daný obchod
        const url = `https://www.cheapshark.com/api/1.0/deals?storeID=${storeIds}&sortBy=Deal Rating&metacritic=75&pageSize=30`;

        const response = await fetch(url);
        const rawData = await response.json();

        // Převedeme data tak, aby to pasovalo do tvé připravené funkce renderKarta
        const storeNames = { "1": "Steam", "7": "GOG", "11": "Humble", "25": "Epic" };

        const hry = rawData.map(d => ({
            title: d.title,
            salePrice: parseFloat(d.salePrice),
            normalPrice: parseFloat(d.normalPrice),
            savings: parseFloat(d.savings),
            storeName: storeNames[d.storeID] || "Jiný",
            dealID: d.dealID,
            thumb: d.thumb
        }));

        vystup.innerHTML = "";

        if (!hry.length) {
            vystup.innerHTML = `<p style='color:#a0a0b0; grid-column:1/-1;'>Žádné pořádné slevy pro tento obchod teď nejsou k dispozici.</p>`;
            return;
        }

        // Vykreslení upravených kartiček
        hry.forEach(hra => renderKarta(hra, vystup));

    } catch (err) {
        console.error("Chyba načítání:", err);
        vystup.innerHTML = "<p style='color:#e57373; grid-column:1/-1;'>Nepodařilo se načíst slevy. Zkus to znovu.</p>";
    }
}

// ── Hledání ───────────────────────────────────────────────
async function hledatHry() {
    const query = document.getElementById('game-input').value.trim();
    const vystup = document.getElementById('deals-grid');
    skrytNaseptavac();
    if (!query) return;

    vystup.innerHTML = "<p style='color:#a0a0b0; grid-column:1/-1;'>Hledám slevy...</p>";
    const userId = localStorage.getItem('userId') || 1;

    try {
        const response = await fetch(`/search-games?title=${encodeURIComponent(query)}&store=${aktualniStore}&user_id=${userId}`);
        const hry = await response.json();
        vystup.innerHTML = "";
        if (!hry.length) {
            vystup.innerHTML = "<p style='color:#a0a0b0; grid-column:1/-1;'>Žádné výsledky nenalezeny.</p>";
            return;
        }
        hry.forEach(hra => renderKarta(hra, vystup));
    } catch {
        vystup.innerHTML = "<p style='color:#e57373; grid-column:1/-1;'>Chyba při komunikaci se serverem.</p>";
    }
}

// ── Renderování karty ─────────────────────────────────────
function renderKarta(hra, kontejner) {
    const cenaCZK = Math.round(hra.salePrice * KURZ);
    const origCZK = Math.round(hra.normalPrice * KURZ);
    const sleva = Math.round(hra.savings);

    const storeClass = { Steam: 'badge-steam', GOG: 'badge-gog', Epic: 'badge-epic', Humble: 'badge-humble' }[hra.storeName] || 'badge-discount';

    const karta = document.createElement('div');
    karta.className = 'card';

    const nazevEsc = hra.title.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    karta.innerHTML = `
        <div style="position:relative; cursor:pointer;" onclick="otevritDetail('${hra.dealID}', '${nazevEsc}', ${hra.salePrice})">
            <img src="${hra.thumb}" class="card__image" alt="${hra.title}">
            ${sleva > 0 ? `<span class="badge badge-discount" style="position:absolute; top:8px; right:8px;">-${sleva}%</span>` : ''}
        </div>
        <div class="card__body">
            <div style="margin-bottom:5px;">
                <span class="badge ${storeClass}">${hra.storeName}</span>
            </div>
            <div class="card__title" title="${hra.title}">${hra.title}</div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                <span>
                    <span class="card__price">${cenaCZK} Kč</span>
                    ${origCZK > cenaCZK ? `<span class="card__price-old">${origCZK} Kč</span>` : ''}
                </span>
                <button class="btn-wl" title="Přidat do watchlistu"
                        data-title="${nazevEsc}" data-price="${hra.salePrice}"
                        onclick="event.stopPropagation(); handleWl(this)">♡</button>
            </div>
        </div>
    `;
    kontejner.appendChild(karta);
}

// ── Watchlist — opravený event kontext ────────────────────
async function handleWl(btn) {
    const nazev = btn.dataset.title;
    const cena = btn.dataset.price;
    const userId = localStorage.getItem('userId');

    if (!userId) return alert("Pro přidání do watchlistu se musíš přihlásit!");

    try {
        const response = await fetch('/watchlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, game_title: nazev, target_price: parseFloat(cena) })
        });
        const data = await response.json();
        if (response.ok) {
            btn.textContent = '♥';
            btn.style.color = '#e57373';
            setTimeout(() => { btn.textContent = '♡'; btn.style.color = ''; }, 2000);
        } else {
            alert("Chyba: " + data.error);
        }
    } catch {
        alert("Chyba při přidávání do watchlistu.");
    }
}

async function pridatDoWatchlistu(nazev, cena) {
    const userId = localStorage.getItem('userId');
    if (!userId) return alert("Pro přidání do watchlistu se musíš přihlásit!");
    try {
        const response = await fetch('/watchlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, game_title: nazev, target_price: parseFloat(cena) || 0 })
        });
        const data = await response.json();
        if (response.ok) {
            zavritModal();
            // Krátká zpráva
            const toast = document.createElement('div');
            toast.textContent = '♥ Přidáno do watchlistu';
            toast.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;background:#1a1d27;border:1px solid #2a2d3a;border-left:3px solid #00bcd4;padding:0.75rem 1rem;border-radius:8px;font-size:0.88rem;z-index:9999;';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2500);
        } else {
            alert("Chyba: " + data.error);
        }
    } catch { alert("Chyba při přidávání."); }
}

// ── Našeptávání ───────────────────────────────────────────
async function nacistNaseptavani(q) {
    try {
        // Ptáme se API přímo na slevy (deals), abychom získali % slevy a ceny
        const response = await fetch(`https://www.cheapshark.com/api/1.0/deals?title=${encodeURIComponent(q)}&pageSize=15`);
        const vsechnyDeals = await response.json();

        // Protože API může vrátit stejnou hru z více obchodů (Steam, Epic...),
        // vyfiltrujeme si jen unikátní názvy. (API je řadí podle nejlepší slevy)
        const unikatniHry = [];
        const videne = new Set();

        for (const deal of vsechnyDeals) {
            const nazevMale = deal.title.toLowerCase();
            if (!videne.has(nazevMale)) {
                videne.add(nazevMale);
                unikatniHry.push(deal);
                if (unikatniHry.length === 6) break; // Omezíme na 6 výsledků
            }
        }

        zobrazitNaseptavac(unikatniHry);
    } catch { skrytNaseptavac(); }
}

function zobrazitNaseptavac(hry) {
    let box = document.getElementById('naseptavac');

    if (!box) {
        box = document.createElement('div');
        box.id = 'naseptavac';
        box.style.cssText = 'position:absolute; top:100%; left:0; right:0; background:#1a1d27; border:1px solid #2a2d3a; border-top:none; border-radius:0 0 8px 8px; z-index:100; overflow:hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.6);';
        document.querySelector('.search-wrap').appendChild(box);

        const style = document.createElement('style');
        style.innerHTML = '.naseptavac-item:hover { background: #2a2d3a; }';
        document.head.appendChild(style);
    }

    if (!hry || !hry.length) { skrytNaseptavac(); return; }

    // Vykreslení položek
    box.innerHTML = hry.map(hra => {
        // Výpočet slevy a ceny
        const sleva = Math.round(parseFloat(hra.savings));
        const cenaCZK = Math.round(parseFloat(hra.salePrice) * KURZ);

        // Vytvoření štítku (červený pro slevu, šedý pokud sleva není)
        const badgeSleva = sleva > 0
            ? `<span style="background:#e57373; color:#1a1d27; font-size:0.75rem; font-weight:bold; padding:2px 6px; border-radius:4px;">-${sleva}%</span>`
            : `<span style="background:#2a2d3a; color:#a0a0b0; font-size:0.75rem; padding:2px 6px; border-radius:4px;">Bez slevy</span>`;

        return `
        <div class="naseptavac-item" onclick="vybratNaseptavani('${hra.title.replace(/'/g, "\\'")}')"
             style="display:flex; align-items:center; justify-content:space-between; padding:0.6rem 1rem; cursor:pointer; border-bottom:1px solid #2a2d3a; transition:background 0.2s;">
            
            <div style="display:flex; align-items:center; gap:12px; overflow:hidden;">
                <img src="${hra.thumb}" alt="thumb" style="width:46px; height:24px; object-fit:cover; border-radius:4px; opacity:0.9;">
                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:500; color:#e0e0e0; font-size:0.95rem;">${hra.title}</span>
            </div>
            
            <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
                ${badgeSleva}
                <span style="color:#00bcd4; font-weight:600; font-size:0.9rem; min-width:55px; text-align:right;">${cenaCZK} Kč</span>
            </div>
        </div>
        `;
    }).join('');

    box.style.display = 'block';
}

function vybratNaseptavani(nazev) {
    document.getElementById('game-input').value = nazev;
    skrytNaseptavac();
    hledatHry();
}

function skrytNaseptavac() {
    const box = document.getElementById('naseptavac');
    if (box) box.style.display = 'none';
}

// ── Detail hry ────────────────────────────────────────────
async function otevritDetail(dealID, title, salePrice) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    modal.style.display = 'flex';
    modalBody.innerHTML = `<p style="color:#a0a0b0; text-align:center; padding:2rem;">Načítám detail...</p>`;

    try {
        const response = await fetch(`/game-detail/${dealID}`);
        const data = await response.json();

        if (data.error || !data.gameInfo) {
            // Záložní zobrazení z dat co už máme
            const cenaCZK = Math.round(parseFloat(salePrice) * KURZ);
            modalBody.innerHTML = `
                <h2 style="font-size:1.1rem; margin-bottom:1rem;">${title}</h2>
                <p style="color:#a0a0b0; font-size:0.85rem; margin-bottom:1rem;">Detail není dostupný pro tuto hru.</p>
                <p style="font-size:0.82rem; color:#a0a0b0; margin-bottom:0.25rem;">Cena</p>
                <p style="font-size:1.4rem; font-weight:600; color:#00bcd4; margin-bottom:1.25rem;">${cenaCZK} Kč</p>
                <button class="btn btn-primary" style="width:100%"
                    onclick="pridatDoWatchlistu('${title.replace(/'/g, "\\'")}', ${salePrice})">
                    ♡ Přidat do watchlistu
                </button>
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
                    <button class="btn btn-primary" style="margin-top:1.25rem; width:100%;"
                        onclick="pridatDoWatchlistu('${title.replace(/'/g, "\\'")}', ${game.salePrice})">
                        ♡ Přidat do watchlistu
                    </button>
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

window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal')) zavritModal();
});