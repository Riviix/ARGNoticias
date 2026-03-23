'use strict';

// ── Estado ──────────────────────────────────────────
const state = {
    articles:       [],
    filtered:       [],
    displayed:      0,
    PAGE_SIZE:      30,
    sources:        [],
    filters: {
        region:  'todos',
        lean:    'todos',
        source:  null,
        query:   '',
    },
    viewMode:       'grid',  // 'grid' | 'list'
    loading:        false,
};

// ── DOM ──────────────────────────────────────────────
const $ = id => document.getElementById(id);

const DOM = {
    clock:          $('clock'),
    lastUpdate:     $('lastUpdate'),
    statusDot:      $('statusDot'),
    refreshBtn:     $('refreshBtn'),
    searchInput:    $('searchInput'),
    searchClear:    $('searchClear'),
    regionFilter:   $('regionFilter'),
    leanFilter:     $('leanFilter'),
    sourceList:     $('sourceList'),
    statsTotal:     $('statTotal'),
    statsSources:   $('statSources'),
    statsMdp:       $('statMdp'),
    statsNac:       $('statNac'),
    resultsCount:   $('resultsCount'),
    viewGrid:       $('viewGrid'),
    viewList:       $('viewList'),
    loadingState:   $('loadingState'),
    errorState:     $('errorState'),
    emptyState:     $('emptyState'),
    articlesGrid:   $('articlesGrid'),
    loadMoreWrap:   $('loadMoreWrap'),
    loadMoreBtn:    $('loadMoreBtn'),
    recentList:     $('recentList'),
    sourceChart:    $('sourceChart'),
    articleModal:   $('articleModal'),
    modalBackdrop:  $('modalBackdrop'),
    modalClose:     $('modalClose'),
    modalContent:   $('modalContent'),
    toast:          $('toast'),
    retryBtn:       $('retryBtn'),
};

// ── Clock ─────────────────────────────────────────────
function updateClock() {
    const now = new Date();
    DOM.clock.textContent = now.toLocaleTimeString('es-AR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}
setInterval(updateClock, 1000);
updateClock();

// ── API ───────────────────────────────────────────────
const API = '/api';

async function fetchNews(forceRefresh = false) {
    if (forceRefresh) {
        await fetch(`${API}/refresh`).catch(() => {});
    }

    const params = new URLSearchParams({ limit: 200 });
    const res    = await fetch(`${API}/news?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function fetchSources() {
    const res = await fetch(`${API}/sources`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ── Carga inicial ─────────────────────────────────────
async function loadData(forceRefresh = false) {
    state.loading = true;
    showLoading();

    try {
        const [newsData, sourcesData] = await Promise.all([
            fetchNews(forceRefresh),
            fetchSources(),
        ]);

        state.articles  = newsData.articles || [];
        state.sources   = sourcesData.sources || [];

        DOM.statusDot.className = 'status-dot online';
        DOM.lastUpdate.textContent = newsData.lastUpdate
            ? `Actualizado ${timeAgo(newsData.lastUpdate)}`
            : 'Actualizado ahora';

        renderSourceList();
        updateStats();
        applyFilters();
        renderRecentList();
        renderSourceChart();

    } catch (err) {
        console.error('Error cargando noticias:', err);
        DOM.statusDot.className = 'status-dot offline';
        showError();
    } finally {
        state.loading = false;
    }
}

// ── Filtros ────────────────────────────────────────────
function applyFilters() {
    const { region, lean, source, query } = state.filters;

    state.filtered = state.articles.filter(a => {
        if (region !== 'todos' && a.source.region !== region)   return false;
        if (lean   !== 'todos' && a.source.lean   !== lean)     return false;
        if (source && a.source.id !== source)                   return false;
        if (query) {
            const q = query.toLowerCase();
            if (!a.title.toLowerCase().includes(q) &&
                !a.description.toLowerCase().includes(q) &&
                !a.source.name.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    state.displayed = 0;
    DOM.articlesGrid.innerHTML = '';
    renderPage();
}

function renderPage() {
    const total    = state.filtered.length;
    const toShow   = Math.min(state.displayed + state.PAGE_SIZE, total);
    const batch    = state.filtered.slice(state.displayed, toShow);

    if (total === 0) {
        hideAll();
        DOM.emptyState.style.display = 'block';
        DOM.resultsCount.textContent = 'Sin resultados';
        return;
    }

    hideAll();
    DOM.articlesGrid.style.display = 'grid';

    batch.forEach((article, i) => {
        const card = createCard(article);
        card.style.animationDelay = `${Math.min(i, 15) * 30}ms`;
        DOM.articlesGrid.appendChild(card);
    });

    state.displayed = toShow;

    DOM.resultsCount.textContent = `${total.toLocaleString('es-AR')} artículo${total !== 1 ? 's' : ''}`;
    DOM.loadMoreWrap.style.display = state.displayed < total ? 'block' : 'none';
}

// ── Cards ─────────────────────────────────────────────
function createCard(article) {
    const card = document.createElement('div');
    card.className = 'article-card';

    const hasImage = !!article.image;
    const emoji    = getSourceEmoji(article.source.region);

    card.innerHTML = `
        ${hasImage
            ? `<img class="card-image" src="${esc(article.image)}" alt="" loading="lazy" onerror="this.replaceWith(makePlaceholder('${emoji}'))">`
            : `<div class="card-image-placeholder">${emoji}</div>`
        }
        <div class="card-body">
            <div class="card-meta">
                <div class="card-source">
                    <span class="source-badge" style="background:${esc(article.source.color)}">${esc(article.source.name)}</span>
                    <span class="lean-badge ${esc(article.source.lean)}">${leanLabel(article.source.lean)}</span>
                </div>
                <span class="card-date">${formatDate(article.pubDate)}</span>
            </div>
            <h3 class="card-title">${esc(article.title)}</h3>
            ${article.description ? `<p class="card-description">${esc(article.description)}</p>` : ''}
            <div class="card-footer">
                <span class="card-region">${regionLabel(article.source.region)}</span>
                <a class="card-link" href="${esc(article.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
                    Leer →
                </a>
            </div>
        </div>
    `;

    card.addEventListener('click', () => openModal(article));
    return card;
}

// ── Modal ─────────────────────────────────────────────
function openModal(article) {
    DOM.modalContent.innerHTML = `
        <div class="modal-source-badge">
            <span class="source-badge" style="background:${esc(article.source.color)}">${esc(article.source.name)}</span>
            <span class="lean-badge ${esc(article.source.lean)}">${leanLabel(article.source.lean)}</span>
            <span style="font-size:0.72rem;color:var(--text-3)">${regionLabel(article.source.region)}</span>
        </div>
        ${article.image ? `<img class="modal-image" src="${esc(article.image)}" alt="" onerror="this.style.display='none'">` : ''}
        <h2 class="modal-title">${esc(article.title)}</h2>
        ${article.description ? `<p class="modal-desc">${esc(article.description)}</p>` : ''}
        <div class="modal-footer">
            <span class="modal-date">${formatDateFull(article.pubDate)}</span>
            <a class="modal-open-btn" href="${esc(article.link)}" target="_blank" rel="noopener">
                Leer nota completa ↗
            </a>
        </div>
    `;
    DOM.articleModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    DOM.articleModal.style.display = 'none';
    document.body.style.overflow = '';
}

// ── Source list sidebar ───────────────────────────────
function renderSourceList() {
    DOM.sourceList.innerHTML = '';

    // "Todos" option
    const allItem = createSourceItem(null, 'Todas las fuentes', 'var(--accent)', '');
    if (!state.filters.source) allItem.classList.add('active');
    DOM.sourceList.appendChild(allItem);

    state.sources.forEach(src => {
        const item = createSourceItem(src.id, src.name, src.color, src.region);
        if (state.filters.source === src.id) item.classList.add('active');
        DOM.sourceList.appendChild(item);
    });
}

function createSourceItem(id, name, color, region) {
    const el = document.createElement('div');
    el.className = 'source-item';
    el.innerHTML = `
        <div class="source-item-left">
            <span class="source-dot" style="background:${esc(color)}"></span>
            <span class="source-name">${esc(name)}</span>
        </div>
        ${region ? `<span class="source-region">${regionLabel(region)}</span>` : ''}
    `;
    el.addEventListener('click', () => {
        state.filters.source = state.filters.source === id ? null : id;
        renderSourceList();
        applyFilters();
    });
    return el;
}

// ── Stats ─────────────────────────────────────────────
function updateStats() {
    const mdp = state.articles.filter(a => a.source.region === 'mdp').length;
    const nac = state.articles.filter(a => a.source.region === 'nacional').length;
    DOM.statsTotal.textContent   = state.articles.length;
    DOM.statsSources.textContent = state.sources.length;
    DOM.statsMdp.textContent     = mdp;
    DOM.statsNac.textContent     = nac;
}

// ── Recent list ───────────────────────────────────────
function renderRecentList() {
    const recent = state.articles.slice(0, 10);
    DOM.recentList.innerHTML = recent.map(a => `
        <div class="recent-item" onclick="openModalById('${esc(a.id)}')">
            <div class="recent-title">${esc(a.title)}</div>
            <div class="recent-meta">
                <span class="recent-source-name" style="color:${esc(a.source.color)}">${esc(a.source.name)}</span>
                <span>·</span>
                <span>${formatDate(a.pubDate)}</span>
            </div>
        </div>
    `).join('');
}

// ── Source chart ──────────────────────────────────────
function renderSourceChart() {
    const counts = {};
    state.articles.forEach(a => {
        counts[a.source.id] = (counts[a.source.id] || 0) + 1;
    });

    const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const max = sorted[0]?.[1] || 1;

    DOM.sourceChart.innerHTML = sorted.map(([id, count]) => {
        const src = state.sources.find(s => s.id === id);
        if (!src) return '';
        const pct = Math.round((count / max) * 100);
        return `
            <div class="chart-row">
                <div class="chart-label">
                    <span>${esc(src.name)}</span>
                    <span>${count}</span>
                </div>
                <div class="chart-bar-track">
                    <div class="chart-bar-fill" style="width:${pct}%;background:${esc(src.color)}"></div>
                </div>
            </div>
        `;
    }).join('');
}

// ── UI states ─────────────────────────────────────────
function showLoading() {
    DOM.loadingState.style.display  = 'block';
    DOM.errorState.style.display    = 'none';
    DOM.emptyState.style.display    = 'none';
    DOM.articlesGrid.style.display  = 'none';
    DOM.loadMoreWrap.style.display  = 'none';
}

function showError() {
    DOM.loadingState.style.display  = 'none';
    DOM.errorState.style.display    = 'block';
    DOM.emptyState.style.display    = 'none';
    DOM.articlesGrid.style.display  = 'none';
    DOM.loadMoreWrap.style.display  = 'none';
}

function hideAll() {
    DOM.loadingState.style.display  = 'none';
    DOM.errorState.style.display    = 'none';
    DOM.emptyState.style.display    = 'none';
}

// ── Helpers ───────────────────────────────────────────
function esc(str) {
    if (typeof str !== 'string') return str || '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function leanLabel(lean) {
    return { izquierda: 'Izq.', centro: 'Centro', derecha: 'Der.' }[lean] || lean;
}

function regionLabel(region) {
    return { mdp: 'Mar del Plata', nacional: 'Nacional' }[region] || region;
}

function getSourceEmoji(region) {
    return region === 'mdp' ? '🌊' : '🇦🇷';
}

function formatDate(dateStr) {
    try {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now - d;
        if (diff < 60000)        return 'Hace un momento';
        if (diff < 3600000)      return `Hace ${Math.floor(diff/60000)}m`;
        if (diff < 86400000)     return `Hace ${Math.floor(diff/3600000)}h`;
        return d.toLocaleDateString('es-AR', { day:'numeric', month:'short' });
    } catch { return ''; }
}

function formatDateFull(dateStr) {
    try {
        return new Date(dateStr).toLocaleString('es-AR', {
            weekday:'long', year:'numeric', month:'long', day:'numeric',
            hour:'2-digit', minute:'2-digit'
        });
    } catch { return dateStr; }
}

function timeAgo(dateStr) {
    try {
        const diff = Date.now() - new Date(dateStr);
        if (diff < 60000)   return 'justo ahora';
        if (diff < 3600000) return `hace ${Math.floor(diff/60000)} min`;
        return `hace ${Math.floor(diff/3600000)}h`;
    } catch { return ''; }
}

// Llamado desde HTML generado dinámicamente
window.openModalById = function(id) {
    const article = state.articles.find(a => a.id === id);
    if (article) openModal(article);
};

// Llamado desde onerror de img en cards
window.makePlaceholder = function(emoji) {
    const div = document.createElement('div');
    div.className = 'card-image-placeholder';
    div.textContent = emoji;
    return div;
};

// ── Toast ──────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
    DOM.toast.textContent = msg;
    DOM.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => DOM.toast.classList.remove('show'), 2500);
}

// ── Event listeners ───────────────────────────────────
DOM.refreshBtn.addEventListener('click', async () => {
    DOM.refreshBtn.classList.add('spinning');
    showToast('Actualizando noticias...');
    await loadData(true);
    DOM.refreshBtn.classList.remove('spinning');
    showToast('✓ Noticias actualizadas');
});

DOM.retryBtn?.addEventListener('click', () => loadData());

DOM.searchInput.addEventListener('input', () => {
    state.filters.query = DOM.searchInput.value.trim();
    DOM.searchClear.classList.toggle('visible', state.filters.query.length > 0);
    applyFilters();
});

DOM.searchClear.addEventListener('click', () => {
    DOM.searchInput.value = '';
    state.filters.query = '';
    DOM.searchClear.classList.remove('visible');
    applyFilters();
});

// Region filter pills
DOM.regionFilter.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
        DOM.regionFilter.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.filters.region = pill.dataset.value;
        applyFilters();
    });
});

// Lean filter pills
DOM.leanFilter.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
        DOM.leanFilter.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.filters.lean = pill.dataset.value;
        applyFilters();
    });
});

// View toggle
DOM.viewGrid.addEventListener('click', () => {
    state.viewMode = 'grid';
    DOM.articlesGrid.classList.remove('list-view');
    DOM.viewGrid.classList.add('active');
    DOM.viewList.classList.remove('active');
});

DOM.viewList.addEventListener('click', () => {
    state.viewMode = 'list';
    DOM.articlesGrid.classList.add('list-view');
    DOM.viewList.classList.add('active');
    DOM.viewGrid.classList.remove('active');
});

// Load more
DOM.loadMoreBtn.addEventListener('click', () => {
    renderPage();
});

// Modal
DOM.modalClose.addEventListener('click', closeModal);
DOM.modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
});

// Auto-refresh cada 5 minutos
setInterval(() => loadData(), 5 * 60 * 1000);

// ── Arranque ───────────────────────────────────────────
loadData();
