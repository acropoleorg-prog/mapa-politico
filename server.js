const express = require('express');
const { google } = require('googleapis');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── CONFIG ──
const SPREADSHEET_ID = '1b8ZU7vD1DQfUF-nweRFxPodIGl5bRrandBTyvBeEhL0';
const APP_PASSWORD = process.env.APP_PASSWORD || 'mapa2024';
const CACHE_TTL_MS = 60 * 1000; // 60 segundos

// Cache simples em memória
let dataCache = { data: null, timestamp: 0 };

// Google credentials from env
function getAuth() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não configurado nas variáveis de ambiente');
  }
  let credentials;
  try {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON está malformado — verifique se é um JSON válido em uma linha');
  }
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

// ── MIDDLEWARE ──
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple token auth
function checkToken(req, res, next) {
  const token = req.headers['x-auth-token'] || req.query.token;
  if (token === APP_PASSWORD) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── BAIRRO COORDS ──
const BAIRRO_COORDS = {
  "Botafogo": [-22.9519, -43.1857],
  "Flamengo": [-22.9327, -43.1762],
  "Laranjeiras": [-22.9360, -43.1870],
  "Copacabana": [-22.9711, -43.1822],
  "Ipanema": [-22.9838, -43.2044],
  "Leblon": [-22.9839, -43.2238],
  "Humaitá": [-22.9540, -43.1978],
  "Urca": [-22.9530, -43.1650],
  "Catete": [-22.9260, -43.1770],
  "Glória": [-22.9220, -43.1760],
  "Gávea": [-22.9780, -43.2290],
  "Lagoa": [-22.9710, -43.2130],
  "Cosme Velho": [-22.9410, -43.1890],
  "Centro": [-22.9068, -43.1729],
  "Tijuca": [-22.9250, -43.2310],
  "Arpoador": [-22.9880, -43.1920],
  "Santa Teresa": [-22.9210, -43.1890],
  "Jacarepaguá": [-22.9470, -43.3530],
  "Campo Grande": [-22.9020, -43.5630],
  "Barra": [-23.0000, -43.3650],
  "Leme": [-22.9640, -43.1720],
  "Jardim Botânico": [-22.9660, -43.2230],
};

const INSTITUTIONS = [
  { nome: "Casa Comadre", tipo: "Espaço Cultural", bairro: "Humaitá", lat: -22.9555, lng: -43.1965, conexao: "Gabriela Davies, Marcella Klimuk, Maíra Marques" },
  { nome: "Casa Amarela", tipo: "Espaço Cultural", bairro: "Centro", lat: -22.9055, lng: -43.1750, conexao: "Ju Dutra" },
  { nome: "Alfa Bar", tipo: "Bar / Ponto de encontro", bairro: "Laranjeiras", lat: -22.9345, lng: -43.1865, conexao: "Evelyn Chaves" },
  { nome: "CEBRI", tipo: "Think Tank", bairro: "Botafogo", lat: -22.9510, lng: -43.1830, conexao: "Susanne Wehrs" },
  { nome: "ABL", tipo: "Instituição Cultural", bairro: "Centro", lat: -22.9100, lng: -43.1710, conexao: "Isabel Werneck" },
  { nome: "SENAI", tipo: "Ensino Profissional", bairro: "Centro", lat: -22.9080, lng: -43.1780, conexao: "Amanda Mendonça" },
  { nome: "Livraria Janela", tipo: "Livraria", bairro: "Humaitá", lat: -22.9530, lng: -43.1930, conexao: "Martha Ribas" },
  { nome: "Colégio Santo Inácio", tipo: "Escola", bairro: "Botafogo", lat: -22.9530, lng: -43.1880, conexao: "André Boudon" },
  { nome: "UFRRJ", tipo: "Universidade", bairro: "Seropédica", lat: -22.7680, lng: -43.6850, conexao: "André Boudon" },
];

// ── HEALTH ROUTE (para Railway) ──
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── DATA ROUTE ──
app.get('/api/data', checkToken, async (req, res) => {
  try {
    // Check cache
    const now = Date.now();
    if (dataCache.data && (now - dataCache.timestamp) < CACHE_TTL_MS) {
      return res.json(dataCache.data);
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch both sheets
    const [possiveis, apoiadores] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'POSSÍVEIS!A:F',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'APOIADORES!A:E',
      }),
    ]);

    const possiveisRows = possiveis.data.values || [];
    const apoiadoresRows = apoiadores.data.values || [];

    // Parse POSSÍVEIS (skip header)
    const possiveisHeader = possiveisRows[0] || [];
    const contacts = possiveisRows.slice(1).map(row => ({
      categoria: row[0] || '',
      indicacao: row[1] || '',
      nome: row[2] || '',
      telefone: row[3] || '',
      endereco: row[4] || '',
      bairro: row[5] || '',
    })).filter(r => r.nome);

    // Parse APOIADORES for nicho/rascunho enrichment
    const nichoMap = {};
    apoiadoresRows.slice(1).forEach(row => {
      const nome = row[2] || '';
      if (nome) {
        nichoMap[nome] = { nicho: row[0] || '', rascunho: row[4] || '' };
      }
    });

    // Group by bairro
    const bairroMap = {};
    contacts.forEach(c => {
      const bairroRaw = c.bairro.trim();
      if (!bairroRaw) return;

      // Handle multi-bairro entries
      bairroRaw.split(',').map(b => b.trim()).forEach(bairro => {
        if (!bairro) return;
        if (!bairroMap[bairro]) bairroMap[bairro] = { apoiadores: [], eleitores: [], neutros: [] };

        const enriched = { ...c, bairro };
        const info = nichoMap[c.nome];
        if (info) { enriched.nicho = info.nicho; enriched.rascunho = info.rascunho; }

        if (c.categoria === 'Apoiador') bairroMap[bairro].apoiadores.push(enriched);
        else if (c.categoria === 'Eleitor') bairroMap[bairro].eleitores.push(enriched);
        else bairroMap[bairro].neutros.push(enriched);
      });
    });

    // Build bairro list with coords
    const bairros = Object.entries(bairroMap)
      .map(([bairro, cats]) => {
        const coords = BAIRRO_COORDS[bairro];
        if (!coords) return null;
        return {
          bairro,
          lat: coords[0],
          lng: coords[1],
          apoiadores: cats.apoiadores,
          eleitores: cats.eleitores,
          neutros: cats.neutros,
          total: cats.apoiadores.length + cats.eleitores.length + cats.neutros.length,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.total - a.total);

    // Network stats
    const networkMap = {};
    contacts.forEach(c => {
      if (c.indicacao) networkMap[c.indicacao] = (networkMap[c.indicacao] || 0) + 1;
    });
    const network = Object.entries(networkMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const unmapped = contacts.filter(c => !c.bairro || !BAIRRO_COORDS[c.bairro.split(',')[0].trim()]).length;

    const result = { bairros, institutions: INSTITUTIONS, network, unmapped, lastUpdated: new Date().toISOString() };
    dataCache = { data: result, timestamp: Date.now() };
    res.json(result);
  } catch (err) {
    console.error('Sheets error:', err.message);
    // Return stale cache if available
    if (dataCache.data) {
      console.warn('Returning stale cache due to error');
      return res.json({ ...dataCache.data, _stale: true });
    }
    res.status(500).json({ error: 'Erro ao buscar dados', detail: err.message });
  }
});

// ── LOGIN CHECK ──
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === APP_PASSWORD) {
    res.json({ token: APP_PASSWORD });
  } else {
    res.status(401).json({ error: 'Senha incorreta' });
  }
});

app.listen(PORT, () => {
  console.log(`Mapa político rodando na porta ${PORT}`);
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.warn('⚠ GOOGLE_SERVICE_ACCOUNT_JSON não configurado — o app não conseguirá ler a planilha');
  }
  if (!process.env.APP_PASSWORD) {
    console.warn('⚠ APP_PASSWORD não configurado — usando senha padrão (não recomendado)');
  }
});
