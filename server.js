const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}

const http = require('http');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');
const cors = require('cors');

const storage = require('./services/storageService');
const botEngine = require('./services/botEngine');
const twitchService = require('./services/twitchService');
const youtubeService = require('./services/youtubeService');
const tiktokService = require('./services/tiktokService');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// OBS Widget shortcuts
app.get('/widgets/cup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'widgets', 'coffee-cup.html'));
});
app.get('/widgets/alert', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'widgets', 'alerts.html'));
});
app.get('/widgets/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'widgets', 'chat.html'));
});
app.get('/widgets/ticker', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'widgets', 'ticker.html'));
});
app.get('/widgets/likes', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'widgets', 'likes.html'));
});
app.get('/widgets/donates', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'widgets', 'donates.html'));
});
app.get('/widgets/top-gifts', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'widgets', 'top-gifts.html'));
});
app.get('/widgets/top-likes', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'widgets', 'top-likes.html'));
});
app.get('/widgets/top-cafezinhos', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'widgets', 'top-cafezinhos.html'));
});
app.get('/widgets/leaderboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'widgets', 'leaderboard.html'));
});

// Broadcast to all WebSocket clients (OBS and Dashboard)
function broadcastWS(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Wire Bot Engine
botEngine.init(
  // Broadcast callback
  (data) => broadcastWS(data),
  // Chat sender callback
  (message, replyTo) => {
    // Broadcast as bot message to OBS overlay & dashboard
    broadcastWS({
      type: 'bot_message',
      data: {
        user: storage.settings.botName || 'Coffee Bot',
        message,
        isBot: true,
        timestamp: Date.now()
      }
    });

    // Also send to real Twitch chat if connected
    twitchService.sendMessage(message);
  }
);

// WebSocket connection handling
wss.on('connection', (ws) => {
  // Send initial state
  ws.send(JSON.stringify({
    type: 'initial_state',
    data: {
      coffeeMeter: storage.settings.coffeeMeter,
      likeGoal: storage.settings.likeGoal,
      donateGoal: storage.settings.donateGoal,
      currency: storage.settings.currency,
      minigames: storage.settings.minigames,
      uptime: botEngine.getUptime(),
      stats: storage.stats,
      twitchConnected: twitchService.isConnected,
      twitchStatus: twitchService.statusMessage,
      youtubeConnected: youtubeService.isConnected,
      youtubeStatus: youtubeService.statusMessage,
      tiktokConnected: tiktokService.isConnected,
      tiktokStatus: tiktokService.statusMessage
    }
  }));

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'simulator_message') {
        const userContext = {
          username: msg.user || 'Vinicius',
          isBroadcaster: Boolean(msg.isBroadcaster),
          isMod: Boolean(msg.isMod),
          isVip: Boolean(msg.isVip),
          isSubscriber: Boolean(msg.isSub),
          platform: 'simulador'
        };
        await botEngine.handleIncomingMessage(msg.message, userContext);
      } else if (msg.type === 'simulator_likes') {
        const count = Number(msg.count) || 100;
        botEngine.handleLikes(count, msg.user || 'ViewerSimulado', 'simulador');
      } else if (msg.type === 'simulator_gift') {
        const giftName = msg.giftName || 'Café Premium ☕';
        const count = Number(msg.count) || 1;
        const diamonds = Number(msg.diamonds) || 10;
        const user = msg.user || 'DoadorFiel';
        botEngine.handleGift(user, giftName, count, diamonds, 'simulador');
      } else if (msg.type === 'simulator_follow') {
        const user = msg.user || 'NovoSeguidor';
        botEngine.handleFollow(user, 'simulador');
      } else if (msg.type === 'simulator_sub') {
        const user = msg.user || 'NovoAssinante';
        const subType = msg.subType || 'sub'; // 'sub', 'member', 'fan_club'
        botEngine.handleSub(user, subType, 'simulador');
      } else if (msg.type === 'simulator_donate') {
        const user = msg.user || 'ApoiadorTop';
        const amount = Number(msg.amount) || 10;
        const text = msg.message || 'Valeu pela live!';
        botEngine.handleDonate(user, amount, 'BRL', 'simulador', text);
      }
    } catch (e) {
      console.error('WS Error:', e);
    }
  });
});

// --- REST API ---

// 1. Status & Metrics
app.get('/api/status', (req, res) => {
  res.json({
    botName: storage.settings.botName,
    coffeeMeter: storage.settings.coffeeMeter,
    likeGoal: storage.settings.likeGoal,
    donateGoal: storage.settings.donateGoal,
    currency: storage.settings.currency,
    minigames: storage.settings.minigames,
    twitch: {
      connected: twitchService.isConnected,
      status: twitchService.statusMessage,
      channel: storage.settings.twitch ? storage.settings.twitch.channel : ''
    },
    youtube: {
      connected: youtubeService.isConnected,
      status: youtubeService.statusMessage,
      liveId: youtubeService.liveId || (storage.settings.youtube ? storage.settings.youtube.liveId : '')
    },
    tiktok: {
      connected: tiktokService.isConnected,
      status: tiktokService.statusMessage,
      username: tiktokService.username || (storage.settings.tiktok ? storage.settings.tiktok.username : '')
    },
    uptime: botEngine.getUptime(),
    stats: storage.stats,
    topPoints: storage.getTopPoints(5),
    raffle: storage.settings.raffle
  });
});

// Reset Live Stats
app.post('/api/stats/reset', (req, res) => {
  const reset = storage.resetLiveStats();
  broadcastWS({
    type: 'stats_reset',
    data: reset
  });
  res.json({ success: true, stats: reset });
});

// 2. Commands
app.get('/api/commands', (req, res) => {
  res.json(storage.commands);
});

app.post('/api/commands', (req, res) => {
  const { name, response, cooldown, userCooldown, permission, enabled, aliases, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome do comando é obrigatório' });

  const cleanName = name.toLowerCase().replace('!', '').trim();
  const existingIdx = storage.commands.findIndex(c => c.name.toLowerCase() === cleanName);

  const commandData = {
    name: cleanName,
    aliases: Array.isArray(aliases) ? aliases : (aliases ? aliases.split(',').map(s => s.trim().replace('!', '')) : []),
    response: response || '',
    cooldown: Number(cooldown) || 0,
    userCooldown: Number(userCooldown) || 0,
    permission: permission || 'everyone',
    enabled: enabled !== false,
    description: description || 'Comando personalizado'
  };

  if (existingIdx >= 0) {
    if (storage.commands[existingIdx].action) {
      commandData.action = storage.commands[existingIdx].action;
    }
    storage.commands[existingIdx] = commandData;
  } else {
    storage.commands.push(commandData);
  }

  storage.saveCommands();
  storage.logAudit({
    category: 'command',
    action: existingIdx >= 0 ? `Comando !${cleanName} Atualizado` : `Comando !${cleanName} Criado`,
    details: `Resposta: "${commandData.response || ''}". Cooldown: ${commandData.cooldown}s / ${commandData.userCooldown}s`,
    author: 'Painel Web'
  });
  res.json({ success: true, command: commandData });
});

app.delete('/api/commands/:name', (req, res) => {
  const target = req.params.name.toLowerCase().trim();
  const idx = storage.commands.findIndex(c => c.name.toLowerCase() === target);
  if (idx >= 0) {
    const removed = storage.commands.splice(idx, 1);
    storage.saveCommands();
    storage.logAudit({
      category: 'command',
      action: `Comando !${target} Excluído`,
      details: 'Comando removido da lista do bot',
      author: 'Painel Web'
    });
    return res.json({ success: true, removed: removed[0] });
  }
  res.status(404).json({ error: 'Comando não encontrado' });
});

// 3. Timers
app.get('/api/timers', (req, res) => {
  res.json(storage.timers);
});

app.post('/api/timers', (req, res) => {
  const { id, name, message, intervalMinutes, chatLinesThreshold, enabled } = req.body;
  if (!name || !message) return res.status(400).json({ error: 'Nome e mensagem são obrigatórios' });

  const timerId = id || `timer-${Date.now()}`;
  const timerData = {
    id: timerId,
    name,
    message,
    intervalMinutes: Number(intervalMinutes) || 15,
    chatLinesThreshold: Number(chatLinesThreshold) || 3,
    enabled: enabled !== false
  };

  const existingIdx = storage.timers.findIndex(t => t.id === timerId);
  if (existingIdx >= 0) {
    storage.timers[existingIdx] = timerData;
  } else {
    storage.timers.push(timerData);
  }

  storage.saveTimers();
  storage.logAudit({
    category: 'timer',
    action: existingIdx >= 0 ? `Timer "${timerData.name}" Atualizado` : `Timer "${timerData.name}" Criado`,
    details: `Intervalo: a cada ${timerData.intervalMinutes} min. Mensagem: "${timerData.message}"`,
    author: 'Painel Web'
  });
  res.json({ success: true, timer: timerData });
});

app.delete('/api/timers/:id', (req, res) => {
  const idx = storage.timers.findIndex(t => t.id === req.params.id);
  if (idx >= 0) {
    const removed = storage.timers.splice(idx, 1)[0];
    storage.saveTimers();
    storage.logAudit({
      category: 'timer',
      action: `Timer "${removed.name || req.params.id}" Excluído`,
      details: 'Timer automático removido',
      author: 'Painel Web'
    });
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'Timer não encontrado' });
});

// 4. Settings
app.get('/api/settings', (req, res) => {
  res.json(storage.settings);
});

app.post('/api/settings', (req, res) => {
  storage.settings = { ...storage.settings, ...req.body };
  storage.saveSettings();

  storage.logAudit({
    category: 'config',
    action: 'Configurações Salvas',
    details: 'Configurações gerais, moeda, mini-games ou metas atualizadas com sucesso',
    author: 'Painel Web'
  });

  // Broadcast updates if relevant
  if (req.body.coffeeMeter) {
    broadcastWS({
      type: 'meter_update',
      data: storage.settings.coffeeMeter
    });
  }
  if (req.body.likeGoal) {
    broadcastWS({
      type: 'like_goal_update',
      data: storage.settings.likeGoal
    });
  }
  if (req.body.donateGoal) {
    broadcastWS({
      type: 'donate_goal_update',
      data: storage.settings.donateGoal
    });
  }

  res.json({ success: true, settings: storage.settings });
});

// 5. Test Simulator chat message via POST
app.post('/api/test/chat', async (req, res) => {
  const { user, message, isBroadcaster, isMod, isVip, isSub } = req.body;
  const result = await botEngine.handleIncomingMessage(message, {
    username: user || 'Vinicius',
    isBroadcaster: Boolean(isBroadcaster),
    isMod: Boolean(isMod),
    isVip: Boolean(isVip),
    isSubscriber: Boolean(isSub),
    platform: 'simulador'
  });
  res.json({ success: true, result });
});

// 6. Test Alert
app.post('/api/test/alert', (req, res) => {
  const { title, message, type, icon } = req.body;
  broadcastWS({
    type: 'alert',
    data: {
      title: title || '☕ NOVO SEGUIDOR!',
      message: message || 'Obrigado por apoiar a live!',
      type: type || 'custom',
      icon: icon || '☕',
      duration: 5000
    }
  });
  res.json({ success: true });
});

// 7. Simulators (Likes, Gifts, Viewers, Rain)
app.post('/api/simulate/likes', (req, res) => {
  const count = Number(req.body.count) || 100;
  const user = req.body.user || 'ViewerSimulado';
  const total = botEngine.handleLikes(count, user, 'simulador');
  res.json({ success: true, likesAdded: count, totalLikes: total });
});

app.post('/api/simulate/gift', (req, res) => {
  const { giftName, count, diamonds, user } = req.body;
  const name = giftName || 'Rosa 🌹';
  const qty = Number(count) || 1;
  const value = Number(diamonds) || 1;
  const username = user || 'DoadorSimulado';

  const result = botEngine.handleGift(username, name, qty, value, 'simulador');
  res.json({ success: true, gift: name, count: qty, user: username, result });
});

app.post('/api/simulate/follow', (req, res) => {
  const user = req.body.user || 'NovoSeguidor';
  const item = botEngine.handleFollow(user, req.body.platform || 'simulador');
  res.json({ success: true, follow: item });
});

app.post('/api/simulate/sub', (req, res) => {
  const user = req.body.user || 'NovoAssinante';
  const subType = req.body.subType || 'sub';
  const item = botEngine.handleSub(user, subType, req.body.platform || 'simulador');
  res.json({ success: true, sub: item });
});

app.post('/api/simulate/donate', (req, res) => {
  const user = req.body.user || 'ApoiadorTop';
  const amount = Number(req.body.amount) || 10;
  const currency = req.body.currency || 'BRL';
  const message = req.body.message || 'Valeu pelo conteúdo!';
  const item = botEngine.handleDonate(user, amount, currency, req.body.platform || 'simulador', message);
  res.json({ success: true, donate: item });
});

// Leaderboard APIs for widgets & dashboard
app.get('/api/leaderboard/gifts', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  res.json(storage.getTopGifts(limit));
});

app.get('/api/leaderboard/likes', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  res.json(storage.getTopLikes(limit));
});

app.get('/api/leaderboard/points', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  res.json(storage.getTopPoints(limit));
});

app.post('/api/simulate/rain', (req, res) => {
  const amount = Number(req.body.amount) || 50;
  const goal = storage.settings.likeGoal;
  const reward = amount;

  let count = 0;
  for (const [key] of botEngine.activeViewers.entries()) {
    storage.addPoints(key, reward);
    count++;
  }

  // Also give to Vinicius if empty
  if (count === 0) {
    storage.addPoints('vinicius', reward);
    count = 1;
  }

  const msg = `🎉 CHUVA DE CAFEZINHOS! O Streamer enviou +${reward} Cafezinhos para todos os espectadores ativos! ☕✨`;
  botEngine.sendChatMessage(msg);

  broadcastWS({
    type: 'alert',
    data: {
      title: '☕ CHUVA DE CAFEZINHOS!',
      message: `Todos os espectadores ganharam +${reward} Cafezinhos!`,
      type: 'rain',
      icon: '☕',
      duration: 5000
    }
  });

  res.json({ success: true, reward, viewersCount: count });
});

// 8. Twitch Connect / Disconnect
app.post('/api/twitch/connect', async (req, res) => {
  const { channel, botUsername, oauthToken } = req.body;
  if (!storage.settings.twitch) storage.settings.twitch = {};
  if (channel) storage.settings.twitch.channel = channel;
  if (botUsername) storage.settings.twitch.botUsername = botUsername;
  if (oauthToken) storage.settings.twitch.oauthToken = oauthToken;
  storage.saveSettings();

  const result = await twitchService.connect();
  res.json(result);
});

app.post('/api/twitch/disconnect', async (req, res) => {
  await twitchService.disconnect();
  res.json({ success: true, message: 'Twitch desconectada com sucesso.' });
});

// 9. YouTube Connect / Disconnect
app.post('/api/youtube/connect', async (req, res) => {
  const { liveUrl, liveId } = req.body;
  const result = await youtubeService.connect(liveUrl || liveId);
  res.json(result);
});

app.post('/api/youtube/disconnect', async (req, res) => {
  await youtubeService.disconnect();
  res.json({ success: true, message: 'YouTube desconectado com sucesso.' });
});

// 10. TikTok Connect / Disconnect
app.post('/api/tiktok/connect', async (req, res) => {
  const { username, apiKey } = req.body;
  const result = await tiktokService.connect(username, apiKey);
  res.json(result);
});

app.post('/api/tiktok/disconnect', async (req, res) => {
  await tiktokService.disconnect();
  res.json({ success: true, message: 'TikTok desconectado com sucesso.' });
});

// TikTok Webhook / TikFinity receiver
app.post('/api/webhook/tiktok', async (req, res) => {
  await tiktokService.handleExternalMessage(req.body);
  res.json({ success: true });
});

// 11. Points (Cafezinhos) Management
app.get('/api/points', (req, res) => {
  res.json(storage.points);
});

app.post('/api/points', (req, res) => {
  const { user, amount } = req.body;
  if (!user || typeof amount !== 'number') {
    return res.status(400).json({ error: 'Usuário e quantia são necessários' });
  }
  const updated = storage.addPoints(user, amount);
  res.json({ success: true, user, beans: updated });
});

// 12. History & Audit API
app.get('/api/history/audit', (req, res) => {
  const category = req.query.category || 'all';
  const limit = parseInt(req.query.limit, 10) || 100;
  res.json(storage.getAuditLogs(category, limit));
});

app.delete('/api/history/audit', (req, res) => {
  storage.clearAuditLogs();
  res.json({ success: true, message: 'Logs de auditoria limpos com sucesso.' });
});

// 13. Live Sessions History API
app.get('/api/history/sessions', (req, res) => {
  res.json(storage.getLiveSessions());
});

app.get('/api/history/sessions/:id', (req, res) => {
  const session = (storage.liveSessions || []).find(s => s.id === req.params.id);
  if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });
  res.json(session);
});

app.post('/api/history/sessions/archive', (req, res) => {
  const { title, notes } = req.body;
  const session = storage.archiveCurrentLive(title, notes);
  res.json({ success: true, session });
});

app.delete('/api/history/sessions/:id', (req, res) => {
  const success = storage.deleteLiveSession(req.params.id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Sessão não encontrada' });
  }
});

// 14. Clips & Timestamps API
app.get('/api/clips', (req, res) => {
  res.json(storage.getClips());
});

app.post('/api/clips', (req, res) => {
  const clip = storage.addClip(req.body);
  broadcastWS({
    type: 'clip_added',
    data: clip
  });
  res.json({ success: true, clip });
});

app.put('/api/clips/:id', (req, res) => {
  const updated = storage.updateClip(req.params.id, req.body);
  if (updated) {
    broadcastWS({
      type: 'clip_updated',
      data: updated
    });
    res.json({ success: true, clip: updated });
  } else {
    res.status(404).json({ error: 'Clipe não encontrado' });
  }
});

app.delete('/api/clips/:id', (req, res) => {
  const success = storage.deleteClip(req.params.id);
  if (success) {
    broadcastWS({
      type: 'clip_deleted',
      id: req.params.id
    });
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Clipe não encontrado' });
  }
});

app.delete('/api/clips', (req, res) => {
  storage.clearClips();
  broadcastWS({
    type: 'clips_cleared'
  });
  res.json({ success: true, message: 'Todos os clipes foram removidos.' });
});

// Dedicated Port 3334 to avoid conflict with PudiGa (3333) and Trono (3000)
const PORT = process.env.PORT || storage.settings.port || 3334;
server.listen(PORT, async () => {
  console.log(`===============================================`);
  console.log(`☕ Coffee Bot iniciado com sucesso na porta ${PORT}!`);
  console.log(` Painel de Controle:   http://localhost:${PORT}`);
  console.log(` OBS Widget Cup:       http://localhost:${PORT}/widgets/cup`);
  console.log(` OBS Widget Likes:     http://localhost:${PORT}/widgets/likes`);
  console.log(` OBS Widget Donates:   http://localhost:${PORT}/widgets/donates`);
  console.log(` OBS Widget Alert:     http://localhost:${PORT}/widgets/alert`);
  console.log(` OBS Widget Chat:      http://localhost:${PORT}/widgets/chat`);
  console.log(` OBS Widget Ticker:    http://localhost:${PORT}/widgets/ticker`);
  console.log(`===============================================`);

  // Auto-connect to YouTube if liveId is saved
  const defaultYt = (storage.settings.youtube && storage.settings.youtube.liveId) || '';
  if (defaultYt) {
    console.log(`[Auto-Connect] Conectando ao YouTube Live (${defaultYt})...`);
    youtubeService.connect(defaultYt).catch(() => {});
  }

  // Auto-connect to TikTok if username is saved
  const defaultTt = (storage.settings.tiktok && storage.settings.tiktok.username) || 'gamescoffeesr';
  if (defaultTt) {
    console.log(`[Auto-Connect] Tentando conectar ao TikTok Live (@${defaultTt})...`);
    tiktokService.connect(defaultTt).catch(() => {});
  }
});
