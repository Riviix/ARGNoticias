// ============================================
//  NOTICIAS MDP — Backend Server
//  Run: node server.js
//  Requires: npm install express rss-parser cors node-fetch
// ============================================

const express    = require('express');
const RSSParser  = require('rss-parser');
const cors       = require('cors');
const path       = require('path');

const app    = express();
const parser = new RSSParser({
    timeout: 10000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NoticiasMDP/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
    }
});

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ── Fuentes de noticias ─────────────────────────────
// Lean: ideología política aproximada basada en tendencia editorial conocida
const SOURCES = [
    // ── Mar del Plata ──
    {
        id:       '0223',
        name:     '0223',
        url:      'https://www.0223.com.ar/feed',
        region:   'mdp',
        lean:     'centro',
        color:    '#2563eb',
        website:  'https://www.0223.com.ar',
    },
    {
        id:       'elmarplatense',
        name:     'El Marplatense',
        url:      'https://www.elmarplatense.com/feed',
        region:   'mdp',
        lean:     'centro',
        color:    '#7c3aed',
        website:  'https://www.elmarplatense.com',
    },
    {
        id:       'ahoramdp',
        name:     'Ahora MdP',
        url:      'https://ahoramardelplata.com.ar/feed',
        region:   'mdp',
        lean:     'centro',
        color:    '#0891b2',
        website:  'https://ahoramardelplata.com.ar',
    },
    {
        id:       'elatlantico',
        name:     'El Atlántico',
        url:      'https://diarioelatlantico.com.ar/feed',
        region:   'mdp',
        lean:     'centro',
        color:    '#0f766e',
        website:  'https://diarioelatlantico.com.ar',
    },

    // ── Argentina — Centro/Derecha ──
    {
        id:       'lanacion',
        name:     'La Nación',
        url:      'https://www.lanacion.com.ar/arc/outbound/rss/',
        region:   'nacional',
        lean:     'derecha',
        color:    '#1d4ed8',
        website:  'https://www.lanacion.com.ar',
    },
    {
        id:       'infobae',
        name:     'Infobae',
        url:      'https://www.infobae.com/feeds/rss/',
        region:   'nacional',
        lean:     'derecha',
        color:    '#dc2626',
        website:  'https://www.infobae.com',
    },
    {
        id:       'clarin',
        name:     'Clarín',
        url:      'https://www.clarin.com/rss/lo-ultimo/',
        region:   'nacional',
        lean:     'centro',
        color:    '#b45309',
        website:  'https://www.clarin.com',
    },

    // ── Argentina — Izquierda/Progresista ──
    {
        id:       'pagina12',
        name:     'Página 12',
        url:      'https://www.pagina12.com.ar/rss/portada',
        region:   'nacional',
        lean:     'izquierda',
        color:    '#16a34a',
        website:  'https://www.pagina12.com.ar',
    },
    {
        id:       'perfil',
        name:     'Perfil',
        url:      'https://www.perfil.com/feed/ultimo-momento',
        region:   'nacional',
        lean:     'centro',
        color:    '#9333ea',
        website:  'https://www.perfil.com',
    },
    {
        id:       'eldia',
        name:     'El Día',
        url:      'https://www.eldia.com/.rss',
        region:   'nacional',
        lean:     'centro',
        color:    '#c2410c',
        website:  'https://www.eldia.com',
    },
];

// ── Cache en memoria ────────────────────────────────
let cache = {
    articles: [],
    lastUpdate: null,
    errors: {},
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

// ── Fetch de un feed ─────────────────────────────────
async function fetchFeed(source) {
    try {
        const feed = await parser.parseURL(source.url);
        return (feed.items || []).slice(0, 20).map(item => ({
            id:          item.guid || item.link || Math.random().toString(36),
            title:       item.title?.trim() || 'Sin título',
            description: stripHtml(item.contentSnippet || item.content || item.summary || ''),
            link:        item.link || source.website,
            pubDate:     item.pubDate || item.isoDate || new Date().toISOString(),
            image:       extractImage(item),
            source: {
                id:      source.id,
                name:    source.name,
                region:  source.region,
                lean:    source.lean,
                color:   source.color,
                website: source.website,
            }
        }));
    } catch (err) {
        cache.errors[source.id] = err.message;
        console.error(`[${source.name}] Error: ${err.message}`);
        return [];
    }
}

function stripHtml(str) {
    return str.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim().slice(0, 280);
}

function extractImage(item) {
    // Intenta extraer imagen del enclosure, media:content, o contenido HTML
    if (item.enclosure?.url) return item.enclosure.url;
    if (item['media:content']?.['$']?.url) return item['media:content']['$'].url;
    if (item.content) {
        const match = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (match) return match[1];
    }
    return null;
}

// ── Actualizar cache ─────────────────────────────────
async function refreshCache() {
    console.log('[Server] Actualizando noticias...');
    cache.errors = {};

    const results = await Promise.allSettled(SOURCES.map(fetchFeed));
    const allArticles = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

    // Ordenar por fecha, más recientes primero
    allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    // Deduplicar por título similar
    const seen = new Set();
    cache.articles = allArticles.filter(article => {
        const key = article.title.toLowerCase().slice(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    cache.lastUpdate = new Date().toISOString();
    console.log(`[Server] ${cache.articles.length} artículos cargados de ${SOURCES.length} fuentes`);
}

// ── API Routes ───────────────────────────────────────

// GET /api/news — todos los artículos con filtros opcionales
app.get('/api/news', async (req, res) => {
    // Refrescar cache si es viejo o vacío
    if (!cache.lastUpdate || Date.now() - new Date(cache.lastUpdate) > CACHE_TTL_MS) {
        await refreshCache();
    }

    let articles = [...cache.articles];

    // Filtros
    const { region, lean, source, q, limit = 60 } = req.query;

    if (region && region !== 'todos') {
        articles = articles.filter(a => a.source.region === region);
    }
    if (lean && lean !== 'todos') {
        articles = articles.filter(a => a.source.lean === lean);
    }
    if (source) {
        articles = articles.filter(a => a.source.id === source);
    }
    if (q) {
        const query = q.toLowerCase();
        articles = articles.filter(a =>
            a.title.toLowerCase().includes(query) ||
            a.description.toLowerCase().includes(query)
        );
    }

    res.json({
        ok:         true,
        total:      articles.length,
        lastUpdate: cache.lastUpdate,
        errors:     cache.errors,
        articles:   articles.slice(0, parseInt(limit)),
    });
});

// GET /api/sources — lista de fuentes
app.get('/api/sources', (req, res) => {
    res.json({ ok: true, sources: SOURCES.map(s => ({
        id:      s.id,
        name:    s.name,
        region:  s.region,
        lean:    s.lean,
        color:   s.color,
        website: s.website,
    }))});
});

// GET /api/refresh — forzar actualización manual
app.get('/api/refresh', async (req, res) => {
    await refreshCache();
    res.json({ ok: true, message: 'Cache actualizado', total: cache.articles.length });
});

// GET /api/status
app.get('/api/status', (req, res) => {
    res.json({
        ok:         true,
        lastUpdate: cache.lastUpdate,
        total:      cache.articles.length,
        sources:    SOURCES.length,
        errors:     cache.errors,
    });
});

// Catch-all → frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Arrancar ─────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`\n🗞  Noticias MdP corriendo en http://localhost:${PORT}\n`);
    await refreshCache();
});

// Auto-refresh cada 5 minutos
setInterval(refreshCache, CACHE_TTL_MS);
