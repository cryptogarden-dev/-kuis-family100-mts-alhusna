const express = require('express');
const path    = require('path');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/questions', require('./src/routes/questions'));
app.use('/api/teams',     require('./src/routes/teams'));
app.use('/api/settings',  require('./src/routes/settings'));
app.use('/api/game',      require('./src/routes/game'));

app.get('/',      (_req, res) => res.sendFile(path.join(__dirname, 'public', 'game.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ─── Error Handler ────────────────────────────────────────────────────────────
// Ensures a failed DB call (e.g. bad Redis credentials) always returns a
// real JSON error instead of leaving the request hanging.
app.use((err, _req, res, _next) => {
  console.error('❌ API error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start Server (local / self-hosted only) ─────────────────────────────────
// On Vercel, this file is imported as a serverless function handler instead
// (see vercel.json), so `app.listen` must not run there.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   🎓 KUIS FAMILY 100 — MTS AL HUSNA              ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║   🎮 Layar Game  : http://localhost:${PORT}         ║`);
    console.log(`║   ⚙️  Admin Panel : http://localhost:${PORT}/admin   ║`);
    console.log('║   📡 Jaringan    : http://[IP-LAPTOP]:' + PORT + '       ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log('   Tekan Ctrl+C untuk menghentikan server');
    console.log('');
  });
}

module.exports = app;
