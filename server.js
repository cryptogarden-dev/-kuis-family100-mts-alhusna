const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');
const db      = require('./src/database');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, _res, next) => { req.io = io; next(); });

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/questions', require('./src/routes/questions'));
app.use('/api/teams',     require('./src/routes/teams'));
app.use('/api/settings',  require('./src/routes/settings'));
app.use('/api/game',      require('./src/routes/game'));

app.get('/',       (_req, res) => res.sendFile(path.join(__dirname, 'public', 'game.html')));
app.get('/admin',  (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ─── Socket.io ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`📡 Client terhubung: ${socket.id}`);
  // Send current state to newly connected client
  socket.emit('game:state', db.getFullState());
  socket.on('disconnect', () => console.log(`❌ Client terputus: ${socket.id}`));
});

// ─── Server-side Timer (tick setiap 1 detik) ─────────────────────────────────
setInterval(() => {
  const gs = db.getGameState();
  if (!gs.timer_running || gs.timer_remaining <= 0) return;

  const newTime = gs.timer_remaining - 1;

  if (newTime <= 0) {
    db.updateGameState({ timer_remaining: 0, timer_running: false, phase: 'timesup' });
    io.emit('game:timesup');
    io.emit('game:state', db.getFullState());
  } else {
    // Only update in memory for timer (avoid disk write every second when not needed)
    db.data.game_state.timer_remaining = newTime;
    io.emit('game:timer', { remaining: newTime });
  }
}, 1000);

// Save timer state to disk every 5 seconds to avoid data loss on crash
setInterval(() => {
  const gs = db.getGameState();
  if (gs.timer_running) db.save();
}, 5000);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
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
