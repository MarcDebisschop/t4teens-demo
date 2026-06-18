/**
 * T4Teens demo — server met tijdslot-poort
 * --------------------------------------------------
 * - Serveert de volledige vonk-keten uit de hoofdmap (flat-structuur)
 * - Een "poort" bepaalt of de demo open of dicht is:
 *     * binnen het ingestelde tijdvenster  -> open voor iedereen
 *     * of handmatig "altijd open" gezet    -> open voor iedereen
 *     * anders                              -> dicht (nette gesloten-pagina)
 * - De beheerder (Marc) komt ALTIJD binnen met zijn sleutel (?key=... of cookie)
 *   en beheert het venster via /beheer.
 * - Instellingen worden in een JSON-bestand bewaard (overleeft herstart als er
 *   een persistente schijf is; anders teruggevallen op de standaardwaarden).
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// Beheerderssleutel: via omgevingsvariabele op Render, met fallback voor lokaal testen.
const ADMIN_KEY = process.env.ADMIN_KEY || 'Tintinenco01';

// Optionele gastcode (leeg = uit). Kan later via Render-variabele GUEST_CODE aangezet worden.
const GUEST_CODE = process.env.GUEST_CODE || '';

// Tijdzone-uitleg: het venster wordt opgeslagen als UTC ISO-tijdstempels.
// De beheerpagina rekent automatisch om naar de lokale tijd van de browser.

// Opslaglocatie. Op Render kan je een Disk koppelen op /var/data; valt anders terug op de projectmap.
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/var/data') ? '/var/data' : __dirname);
const CONFIG_PATH = path.join(DATA_DIR, 't4teens-config.json');

// BELANGRIJK (Render free tier heeft GEEN persistente schijf):
// het config-bestand wordt bij elke cold-start gewist, waardoor een handmatig
// gezette 'open' verdween en de demo terugviel op dicht. Daarom is de
// standaardmodus nu 'open' en kan die hard worden afgedwongen via de
// omgevingsvariabele DEMO_MODE (open | window | closed). Een env-var overleeft
// elke herstart en heeft altijd voorrang op het (vluchtige) bestand.
const ENV_MODE = (process.env.DEMO_MODE || '').trim().toLowerCase();
const MODE_FORCED = ['open', 'window', 'closed'].includes(ENV_MODE);

const DEFAULT_CONFIG = {
  mode: MODE_FORCED ? ENV_MODE : 'open',  // standaard OPEN zodat testers er altijd in kunnen
  startISO: null,      // begin van het venster (UTC ISO) of null
  endISO: null,        // einde van het venster (UTC ISO) of null
  closedMessage: ''    // optionele extra regel op de gesloten-pagina
};

function loadConfig() {
  let cfg = { ...DEFAULT_CONFIG };
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      cfg = { ...DEFAULT_CONFIG, ...raw };
    }
  } catch (e) {
    console.error('Kon config niet lezen, gebruik standaard:', e.message);
  }
  // Een via DEMO_MODE afgedwongen modus heeft ALTIJD voorrang, ook op een
  // bestaand bestand. Zo kan de demo nooit per ongeluk dicht vallen na herstart.
  if (MODE_FORCED) cfg.mode = ENV_MODE;
  return cfg;
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Kon config niet opslaan:', e.message);
    return false;
  }
}

let config = loadConfig();

// Bepaalt of de demo op dit moment publiek open is.
function isOpenNow(cfg) {
  if (cfg.mode === 'open') return true;
  if (cfg.mode === 'closed') return false;
  // 'window'
  const now = Date.now();
  const start = cfg.startISO ? Date.parse(cfg.startISO) : null;
  const end = cfg.endISO ? Date.parse(cfg.endISO) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  // Als geen grenzen gezet zijn in window-mode -> standaard dicht (veilig).
  if (!start && !end) return false;
  return true;
}

// Haalt de sleutel op uit query, header of cookie.
function getKey(req) {
  if (req.query && req.query.key) return String(req.query.key);
  if (req.headers['x-admin-key']) return String(req.headers['x-admin-key']);
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/t4t_key=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  return '';
}

function isAdmin(req) {
  return getKey(req) === ADMIN_KEY;
}

function getGuestCode(req) {
  if (req.query && req.query.gast) return String(req.query.gast);
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/t4t_gast=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  return '';
}

function isGuestAllowed(req) {
  return GUEST_CODE && getGuestCode(req) === GUEST_CODE;
}

// --- Gesloten-pagina (T4Teens-stijl) ---
function closedPage(cfg) {
  const extra = cfg.closedMessage
    ? `<p class="extra">${escapeHtml(cfg.closedMessage)}</p>`
    : '';
  let windowHint = '';
  if (cfg.mode === 'window' && cfg.startISO && Date.now() < Date.parse(cfg.startISO)) {
    windowHint = `<p class="hint">Deze verkenning opent binnenkort.</p>`;
  }
  return `<!doctype html><html lang="nl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>T4Teens — even geduld</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{--teal:#01696F;--teal-d:#014b50;--amber:#f4a24b;--ink:#1f2d2e;--ink-soft:#4a5b5c;--bg:#fbfcfc;--line:#dde8e8}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Inter,system-ui,sans-serif;background:radial-gradient(120% 120% at 50% 0%,#e6f2f2 0%,#fbfcfc 55%);color:var(--ink);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{max-width:520px;width:100%;background:#fff;border:1px solid var(--line);border-radius:22px;padding:44px 36px;text-align:center;box-shadow:0 18px 50px rgba(1,75,80,.10)}
  .badge{display:inline-flex;align-items:center;gap:8px;font-weight:700;color:var(--teal);letter-spacing:.12em;font-size:13px;text-transform:uppercase;margin-bottom:22px}
  .dot{width:10px;height:10px;border-radius:50%;background:var(--amber)}
  h1{font-size:26px;line-height:1.2;margin-bottom:14px;letter-spacing:-.01em}
  p{color:var(--ink-soft);font-size:16px;line-height:1.6}
  .hint{margin-top:14px;font-weight:600;color:var(--teal-d)}
  .extra{margin-top:18px;padding-top:18px;border-top:1px solid var(--line);font-size:15px}
  .foot{margin-top:26px;font-size:13px;color:#9bb0b0}
</style></head>
<body>
  <div class="card">
    <div class="badge"><span class="dot"></span> T4Teens</div>
    <h1>Deze demo is momenteel gesloten</h1>
    <p>De verkenning "Ontdek jouw vonk" staat even niet open. Probeer het later opnieuw, of neem contact op met wie je de link bezorgde.</p>
    ${windowHint}
    ${extra}
    <div class="foot">TaPasCity · T4Teens</div>
  </div>
</body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- API: status & instellen (alleen beheerder) ---
app.get('/api/status', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Geen toegang' });
  res.json({ config, openNow: isOpenNow(config), serverTimeISO: new Date().toISOString(), guestEnabled: !!GUEST_CODE });
});

app.post('/api/config', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Geen toegang' });
  const { mode, startISO, endISO, closedMessage } = req.body || {};
  const next = { ...config };
  if (mode && ['window', 'open', 'closed'].includes(mode)) next.mode = mode;
  if ('startISO' in (req.body || {})) next.startISO = startISO || null;
  if ('endISO' in (req.body || {})) next.endISO = endISO || null;
  if ('closedMessage' in (req.body || {})) next.closedMessage = closedMessage || '';
  config = next;
  const ok = saveConfig(config);
  res.json({ ok, config, openNow: isOpenNow(config), persisted: ok });
});

// --- Beheerpagina ---
app.get('/beheer', (req, res) => {
  if (!isAdmin(req)) {
    res.status(403).type('html').send(closedPage(config));
    return;
  }
  // Zet de sleutel als cookie zodat losse pagina-aanvragen ook lukken.
  res.setHeader('Set-Cookie', `t4t_key=${encodeURIComponent(ADMIN_KEY)}; Path=/; Max-Age=31536000; SameSite=Lax`);
  res.type('html').send(adminPage());
});

// --- Toegangspoort vóór alle statische bestanden ---
app.use((req, res, next) => {
  // Beheerder mag altijd alles + zet cookie.
  if (isAdmin(req)) {
    res.setHeader('Set-Cookie', `t4t_key=${encodeURIComponent(ADMIN_KEY)}; Path=/; Max-Age=31536000; SameSite=Lax`);
    return next();
  }
  // Gastcode (indien aangezet) zet cookie en laat door.
  if (isGuestAllowed(req)) {
    res.setHeader('Set-Cookie', `t4t_gast=${encodeURIComponent(GUEST_CODE)}; Path=/; Max-Age=31536000; SameSite=Lax`);
    return next();
  }
  // Publiek: alleen door als de demo open is.
  if (isOpenNow(config)) return next();
  // Anders gesloten-pagina (status 200 zodat het netjes toont).
  res.status(200).type('html').send(closedPage(config));
});

// Server-eigen bestanden afschermen (niet via de browser opvraagbaar).
const BLOCKED = new Set([
  '/server.js', '/package.json', '/package-lock.json', '/render.yaml',
  '/.gitignore', '/t4teens-config.json', '/draaiboek-render.md'
]);
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  if (BLOCKED.has(p) || p.startsWith('/node_modules') || p.startsWith('/.git')) {
    return res.status(404).type('html').send(closedPage(config));
  }
  next();
});

app.use(express.static(__dirname, { extensions: ['html'] }));

// Fallback naar de landing.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`T4Teens demo draait op poort ${PORT}`);
  console.log(`Config: ${CONFIG_PATH}`);
  console.log(`Beheer: /beheer?key=${ADMIN_KEY}`);
});

// --- Beheerpagina HTML ---
function adminPage() {
  return `<!doctype html><html lang="nl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>T4Teens — Beheer demo</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root{--teal:#01696F;--teal-d:#014b50;--teal-l:#0a8a92;--teal-soft:#e6f2f2;--amber:#f4a24b;--coral:#ff6b5e;--ink:#1f2d2e;--ink-soft:#4a5b5c;--bg:#fbfcfc;--card:#fff;--line:#dde8e8;--radius:16px}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Inter,system-ui,sans-serif;background:radial-gradient(120% 120% at 50% 0%,#e6f2f2 0%,#fbfcfc 55%);color:var(--ink);min-height:100vh;padding:32px 18px}
  .wrap{max-width:680px;margin:0 auto}
  .head{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .dot{width:11px;height:11px;border-radius:50%;background:var(--amber)}
  .brand{font-weight:800;letter-spacing:.10em;text-transform:uppercase;color:var(--teal);font-size:13px}
  h1{font-size:26px;letter-spacing:-.01em;margin:6px 0 4px}
  .sub{color:var(--ink-soft);font-size:15px;margin-bottom:24px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:24px;margin-bottom:18px;box-shadow:0 10px 30px rgba(1,75,80,.06)}
  .statusbar{display:flex;align-items:center;gap:12px;padding:16px 18px;border-radius:14px;font-weight:700;font-size:16px}
  .open{background:#e7f6ec;color:#1c7d44;border:1px solid #bce5cc}
  .closed{background:#fdeceb;color:#c0392b;border:1px solid #f6c9c4}
  .pill{font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;background:var(--teal-soft);color:var(--teal-d)}
  label{display:block;font-weight:600;font-size:14px;margin:16px 0 6px}
  input[type=datetime-local],input[type=text]{width:100%;padding:11px 13px;border:1px solid var(--line);border-radius:11px;font:inherit;color:var(--ink);background:#fff}
  .modes{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}
  .mode-btn{flex:1;min-width:120px;padding:13px;border:1.5px solid var(--line);border-radius:12px;background:#fff;font:inherit;font-weight:600;cursor:pointer;color:var(--ink-soft);transition:.15s}
  .mode-btn.active{border-color:var(--teal);background:var(--teal-soft);color:var(--teal-d)}
  .row{display:flex;gap:12px;flex-wrap:wrap}
  .row>div{flex:1;min-width:200px}
  .actions{display:flex;gap:12px;margin-top:22px;flex-wrap:wrap}
  button.primary{background:var(--teal);color:#fff;border:none;padding:13px 22px;border-radius:12px;font:inherit;font-weight:700;cursor:pointer;transition:.15s}
  button.primary:hover{background:var(--teal-d)}
  button.ghost{background:#fff;border:1.5px solid var(--line);padding:13px 18px;border-radius:12px;font:inherit;font-weight:600;cursor:pointer;color:var(--ink-soft)}
  .quick{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
  .quick button{background:#fff;border:1.5px solid var(--line);padding:9px 14px;border-radius:10px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;color:var(--teal-d)}
  .quick button:hover{border-color:var(--teal)}
  .links{font-size:14px;color:var(--ink-soft);line-height:1.9}
  .links code{background:var(--teal-soft);padding:2px 7px;border-radius:6px;color:var(--teal-d);font-size:13px}
  .toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);background:var(--ink);color:#fff;padding:13px 22px;border-radius:12px;font-weight:600;opacity:0;pointer-events:none;transition:.25s}
  .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  .note{font-size:13px;color:#8aa0a0;margin-top:8px}
  .winrow{margin-top:4px}
</style></head>
<body>
<div class="wrap">
  <div class="head"><span class="dot"></span><span class="brand">T4Teens · Beheer</span></div>
  <h1>Demo open- en sluittijden</h1>
  <p class="sub">Stel hier in wanneer de verkenning "Ontdek jouw vonk" publiek open staat. Jij komt met je sleutel altijd binnen, ook als de demo dicht is.</p>

  <div class="card">
    <div id="statusbar" class="statusbar closed">
      <span id="statustext">Status laden…</span>
    </div>
    <p class="note" id="servertime"></p>
  </div>

  <div class="card">
    <label>Werkingsmodus</label>
    <div class="modes">
      <button class="mode-btn" data-mode="window">Volgens venster</button>
      <button class="mode-btn" data-mode="open">Altijd open</button>
      <button class="mode-btn" data-mode="closed">Altijd dicht</button>
    </div>

    <div id="windowFields" class="winrow">
      <div class="row">
        <div>
          <label>Opent op</label>
          <input type="datetime-local" id="startLocal">
        </div>
        <div>
          <label>Sluit op</label>
          <input type="datetime-local" id="endLocal">
        </div>
      </div>
      <div class="quick">
        <button data-q="now-1u">Nu open · 1 uur</button>
        <button data-q="now-1d">Nu open · 1 dag</button>
        <button data-q="now-1w">Nu open · 1 week</button>
        <button data-q="clear">Tijden wissen</button>
      </div>
    </div>

    <label>Extra regel op gesloten-scherm (optioneel)</label>
    <input type="text" id="closedMessage" placeholder="bv. Vragen? Mail marc@tapascity.com">

    <div class="actions">
      <button class="primary" id="saveBtn">Opslaan</button>
      <button class="ghost" id="reloadBtn">Status verversen</button>
    </div>
    <p class="note">Wijzigingen werken meteen — geen herdeploy nodig.</p>
  </div>

  <div class="card">
    <label style="margin-top:0">Jouw links</label>
    <p class="links">
      Publieke demo (deel deze): <code id="pubLink">—</code><br>
      Jouw altijd-toegang: <code id="adminLink">—</code><br>
      Deze beheerpagina: <code id="beheerLink">—</code>
    </p>
    <p class="note">Deel nooit je sleutel. Genodigden krijgen enkel de publieke link en komen binnen zolang het venster open staat.</p>
  </div>
</div>
<div class="toast" id="toast"></div>

<script>
  const KEY = ${JSON.stringify(ADMIN_KEY)};
  const qs = (s)=>document.querySelector(s);
  let cfg = { mode:'window', startISO:null, endISO:null, closedMessage:'' };

  // ISO (UTC) <-> waarde voor datetime-local (lokale tijd)
  function isoToLocalInput(iso){
    if(!iso) return '';
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off*60000);
    return local.toISOString().slice(0,16);
  }
  function localInputToISO(val){
    if(!val) return null;
    return new Date(val).toISOString();
  }
  function fmt(iso){
    if(!iso) return '—';
    return new Date(iso).toLocaleString('nl-BE',{dateStyle:'medium',timeStyle:'short'});
  }

  function setMode(mode){
    cfg.mode = mode;
    document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active', b.dataset.mode===mode));
    qs('#windowFields').style.display = mode==='window' ? 'block' : 'none';
  }

  function renderStatus(openNow, serverTimeISO){
    const sb = qs('#statusbar'); const st = qs('#statustext');
    if(openNow){ sb.className='statusbar open'; st.textContent='● De demo staat NU open voor iedereen'; }
    else { sb.className='statusbar closed'; st.textContent='● De demo is NU gesloten voor publiek (jij kan er met je sleutel altijd in)'; }
    let extra='';
    if(cfg.mode==='window'){ extra = ' · venster: '+fmt(cfg.startISO)+' → '+fmt(cfg.endISO); }
    else if(cfg.mode==='open'){ extra=' · modus: altijd open'; }
    else { extra=' · modus: altijd dicht'; }
    qs('#servertime').textContent = 'Servertijd: '+fmt(serverTimeISO)+extra;
  }

  function fillLinks(){
    const base = location.origin;
    qs('#pubLink').textContent = base + '/';
    qs('#adminLink').textContent = base + '/?key=' + KEY;
    qs('#beheerLink').textContent = base + '/beheer?key=' + KEY;
  }

  async function load(){
    const r = await fetch('/api/status?key='+encodeURIComponent(KEY));
    if(!r.ok){ toast('Geen toegang — check je sleutel'); return; }
    const data = await r.json();
    cfg = data.config;
    setMode(cfg.mode||'window');
    qs('#startLocal').value = isoToLocalInput(cfg.startISO);
    qs('#endLocal').value = isoToLocalInput(cfg.endISO);
    qs('#closedMessage').value = cfg.closedMessage||'';
    renderStatus(data.openNow, data.serverTimeISO);
    fillLinks();
  }

  async function save(){
    const body = {
      mode: cfg.mode,
      startISO: localInputToISO(qs('#startLocal').value),
      endISO: localInputToISO(qs('#endLocal').value),
      closedMessage: qs('#closedMessage').value.trim()
    };
    const r = await fetch('/api/config?key='+encodeURIComponent(KEY), {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
    });
    const data = await r.json();
    if(data.ok){
      cfg = data.config;
      renderStatus(data.openNow, new Date().toISOString());
      toast(data.persisted ? 'Opgeslagen' : 'Opgeslagen (let op: niet-persistent)');
    } else { toast('Opslaan mislukte'); }
  }

  function quick(q){
    const now = new Date();
    setMode('window');
    document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active', b.dataset.mode==='window'));
    qs('#windowFields').style.display='block';
    if(q==='clear'){ qs('#startLocal').value=''; qs('#endLocal').value=''; return; }
    qs('#startLocal').value = isoToLocalInput(now.toISOString());
    let end = new Date(now);
    if(q==='now-1u') end.setHours(end.getHours()+1);
    if(q==='now-1d') end.setDate(end.getDate()+1);
    if(q==='now-1w') end.setDate(end.getDate()+7);
    qs('#endLocal').value = isoToLocalInput(end.toISOString());
  }

  let toastTimer;
  function toast(msg){
    const t=qs('#toast'); t.textContent=msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),2200);
  }

  document.querySelectorAll('.mode-btn').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  document.querySelectorAll('.quick button').forEach(b=>b.addEventListener('click',()=>quick(b.dataset.q)));
  qs('#saveBtn').addEventListener('click', save);
  qs('#reloadBtn').addEventListener('click', load);
  load();
</script>
</body></html>`;
}
