# 🗞 Noticias MDP

Agregador de noticias de **Mar del Plata y Argentina** con filtros por región y tendencia política.

**No usa APIs de pago.** Se conecta a feeds RSS públicos — sin límites, sin API keys, gratis.

---

## 🚀 Deploy en Railway

### Paso 1 — Subir a GitHub

```bash
git init
git add .
git commit -m "primer commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

### Paso 2 — Deploy

1. Entrá a [railway.app](https://railway.app) → New Project
2. **Deploy from GitHub repo** → seleccioná tu repo
3. Railway detecta el package.json y despliega solo (~2 min)

### Paso 3 — URL pública

Settings → Networking → **Generate Domain**
→ `tu-app.up.railway.app`

### Paso 4 (opcional) — Dominio propio

1. Comprá el dominio en porkbun.com o namecheap.com
2. Railway → Settings → Networking → Custom Domain
3. Agregás el CNAME que Railway te da en el panel de tu registrar

---

## 💻 Correr localmente

```bash
npm install
node server.js
# http://localhost:3000
```

---

## 📁 Estructura

```
noticias-mdp/
├── server.js
├── package.json
├── railway.toml
├── nixpacks.toml
├── .gitignore
├── README.md
└── public/
    ├── index.html
    ├── css/styles.css
    └── js/app.js
```

---

## 📰 Fuentes

### Mar del Plata
- 0223, El Marplatense, Ahora MdP, El Atlántico

### Nacional
- La Nación (derecha), Infobae (derecha), Clarín (centro), Página 12 (izquierda), Perfil (centro), El Día (centro)

---

## ➕ Agregar fuentes

En `server.js`, array `SOURCES`:

```js
{
    id:      'nombre-unico',
    name:    'Nombre del medio',
    url:     'https://sitio.com/feed',
    region:  'mdp',        // 'mdp' | 'nacional'
    lean:    'centro',     // 'izquierda' | 'centro' | 'derecha'
    color:   '#3b82f6',
    website: 'https://sitio.com',
}
```

URLs RSS comunes a probar: `/feed`, `/rss`, `/rss.xml`, `/feed/rss`

---

## 🔌 API

```
GET /api/news?region=mdp&lean=izquierda&q=economia&limit=20
GET /api/sources
GET /api/refresh
GET /api/status
```

---

## 💰 Costos

| | Costo |
|--|--|
| RSS feeds | Gratis siempre |
| Railway hosting | Gratis (~$5 crédito/mes) |
| Dominio .com.ar | ~$5 USD/año (opcional) |
