// Coffee Bot Dashboard Controller - Live Health & Stream Assist
let ws = null;
let currentTab = 'analytics';
let timelineData = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupConfigSubTabs();
  connectWebSocket();
  loadStatus();
  loadCommands();
  loadTimers();
  loadSettings();
  setupChatSimulator();
  setupQuickActions();
  initTimelineCanvas();
  loadMiniRankings();
  setupClipsAndHotkeys();
  loadClips();
  loadLiveSessions();
  setInterval(loadMiniRankings, 12000);
});

// Main Tabs
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tabs-nav .tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      const target = btn.dataset.tab;
      const targetPane = document.getElementById(`tab-${target}`);
      if (targetPane) targetPane.classList.add('active');
      currentTab = target;

      if (target === 'analytics') {
        renderTimelineChart();
      } else if (target === 'clipes') {
        loadClips();
      } else if (target === 'historico') {
        loadLiveSessions();
        loadAuditLogs();
        loadRewardLogs();
        loadSnapshotConfig();
      }
    });
  });
}

// Config Sub-Navigation
function setupConfigSubTabs() {
  const subBtns = document.querySelectorAll('.config-subnav-btn');
  subBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      subBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.config-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const subTarget = btn.dataset.sub;
      const pane = document.getElementById(subTarget);
      if (pane) pane.classList.add('active');
    });
  });
}

// WebSocket Connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[WS] Conectado ao servidor Coffee Bot');
  };

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      handleWsEvent(payload);
    } catch (e) {
      console.error(e);
    }
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, 3000);
  };
}

function handleWsEvent(event) {
  const { type, data } = event;

  if (type === 'initial_state') {
    applyInitialState(data);
  } else if (type === 'chat_message' || type === 'bot_message') {
    appendSimulatorMessage(data);
    appendLiveChatMessage(data);
    addActivityFeedItem({
      icon: data.isBot ? '🤖' : (data.platform === 'tiktok' ? '🎵' : (data.platform === 'youtube' ? '▶️' : '💬')),
      title: data.isBot ? 'Resposta do Bot' : `Mensagem de @${data.user}`,
      desc: data.message,
      time: 'Agora'
    });
  } else if (type === 'like_event') {
    updateLikesStats(data.totalLikes, data.target);
    addActivityFeedItem({
      icon: '❤️',
      title: `+${data.likesAdded} Likes no TikTok`,
      desc: `Recebidos de @${data.user || 'Espectador'} (Total: ${data.totalLikes.toLocaleString('pt-BR')})`,
      time: 'Agora'
    });
    loadMiniRankings();
  } else if (type === 'gift_event') {
    updateGiftStats(data.totalGifts, data.totalGiftValue);
    addActivityFeedItem({
      icon: '🎁',
      title: `Presente: ${data.giftName} x${data.count}`,
      desc: `Enviado por @${data.user} (${data.diamonds} diamantes)`,
      time: 'Agora'
    });
    loadStatus();
    loadMiniRankings();
  } else if (type === 'follow_event') {
    addActivityFeedItem({
      icon: '🌟',
      title: `Novo Seguidor: @${data.user}`,
      desc: `Plataforma: ${data.platform || 'TikTok'}`,
      time: 'Agora'
    });
    loadStatus();
  } else if (type === 'sub_event') {
    addActivityFeedItem({
      icon: '⭐',
      title: `Novo Apoio: @${data.user}`,
      desc: `${data.type || 'Sub'} no ${data.platform || 'Live'}`,
      time: 'Agora'
    });
    loadStatus();
  } else if (type === 'donate_event') {
    addActivityFeedItem({
      icon: '💰',
      title: `Donate de @${data.user}`,
      desc: `${data.currency || 'R$'} ${data.amount} - ${data.message || ''}`,
      time: 'Agora'
    });
    loadStatus();
  } else if (type === 'viewers_update') {
    updateViewersStats(data.viewers, data.total, data.peak);
  } else if (type === 'coffee_poured') {
    updateCoffeeStats(data.current, data.target);
    addActivityFeedItem({
      icon: '☕',
      title: `Café Preparado por @${data.user}`,
      desc: `Meta da live: ${data.current}/${data.target} (+${data.beansEarned} Cafezinhos)`,
      time: 'Agora'
    });
    showToast(`☕ @${data.user} tomou um café! (+${data.beansEarned} Cafezinhos)`);
    loadMiniRankings();
  } else if (type === 'alert') {
    showToast(`${data.icon || '☕'} [ALERTA OBS] ${data.title}: ${data.message}`);
  } else if (type === 'farming_awarded') {
    addActivityFeedItem({
      icon: '⏱️',
      title: 'Farm de Cafezinhos Concedido',
      desc: `+${data.amount} Cafezinhos para ${data.viewersCount} espectadores ativos por assistir a live`,
      time: 'Agora'
    });
  } else if (type === 'meter_update') {
    updateCoffeeStats(data.current, data.target);
  } else if (type === 'like_goal_update') {
    updateLikesStats(data.current, data.target);
  } else if (type === 'donate_goal_update') {
    updateGiftStats(data.current);
  } else if (type === 'twitch_status') {
    updateTwitchIndicator(data.connected, data.status);
  } else if (type === 'youtube_status') {
    updateYouTubeIndicator(data.connected, data.status, data.liveId);
  } else if (type === 'tiktok_status') {
    updateTikTokIndicator(data.connected, data.status, data.username);
  } else if (type === 'stats_reset') {
    loadStatus();
    loadMiniRankings();
    showToast('Estatísticas da live zeradas!');
  } else if (type === 'clip_added') {
    if (Array.isArray(allClips) && !allClips.find(c => c.id === data.id)) {
      allClips.unshift(data);
      renderClips(allClips);
    }
  } else if (type === 'clip_updated' || type === 'clip_deleted' || type === 'clips_cleared') {
    loadClips();
  }
}

function applyInitialState(data) {
  if (data.coffeeMeter) updateCoffeeStats(data.coffeeMeter.current, data.coffeeMeter.target);
  if (data.likeGoal) updateLikesStats(data.likeGoal.current, data.likeGoal.target);
  if (data.donateGoal) updateGiftStats(data.donateGoal.current);
  if (data.stats) renderStats(data.stats);
  updateTwitchIndicator(data.twitchConnected, data.twitchStatus);
  updateYouTubeIndicator(data.youtubeConnected, data.youtubeStatus);
  updateTikTokIndicator(data.tiktokConnected, data.tiktokStatus);
}

// Status & Stats Loader
function loadStatus() {
  fetch('/api/status')
    .then(r => r.json())
    .then(data => {
      document.getElementById('statUptime').textContent = data.uptime || '0s';
      
      if (data.stats) {
        renderStats(data.stats);
      }

      if (data.coffeeMeter) {
        updateCoffeeStats(data.coffeeMeter.current, data.coffeeMeter.target);
        document.getElementById('meterTargetInput').value = data.coffeeMeter.target;
        document.getElementById('meterCurrentInput').value = data.coffeeMeter.current;
        document.getElementById('meterTitleInput').value = data.coffeeMeter.title || 'Cafés do Dia ☕';
      }

      if (data.likeGoal) {
        updateLikesStats(data.likeGoal.current, data.likeGoal.target);
      }

      if (data.donateGoal) {
        updateGiftStats(data.donateGoal.current);
      }

      if (data.currency) {
        document.getElementById('statHeaderCurrency').textContent = data.currency.name || 'Cafezinho';
      }

      updateTwitchIndicator(data.twitch.connected, data.twitch.status);
      if (data.youtube) updateYouTubeIndicator(data.youtube.connected, data.youtube.status, data.youtube.liveId);
      if (data.tiktok) updateTikTokIndicator(data.tiktok.connected, data.tiktok.status, data.tiktok.username);
      
      renderLeaderboard(data.topPoints || []);
      
      if (data.stats && data.stats.historyTimeline) {
        timelineData = data.stats.historyTimeline;
        renderTimelineChart();
      }

      if (data.stats && data.stats.recentEvents && data.stats.recentEvents.length > 0) {
        renderActivityFeed(data.stats.recentEvents);
      }

      updateSimUserBalance();
    })
    .catch(console.error);

  // Poll every 10 seconds for metrics refresh
  setInterval(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(data => {
        document.getElementById('statUptime').textContent = data.uptime || '0s';
        if (data.stats) renderStats(data.stats);
        if (data.stats && data.stats.historyTimeline) {
          timelineData = data.stats.historyTimeline;
          renderTimelineChart();
        }
      })
      .catch(()=>{});
  }, 10000);
}

function renderStats(stats) {
  // Header pills
  const totalLikes = stats.totalLikes || 0;
  const currentViewers = stats.currentViewers ? (stats.currentViewers.total || 0) : 0;
  
  const hLikes = document.getElementById('statHeaderLikes');
  if (hLikes) hLikes.textContent = totalLikes.toLocaleString('pt-BR');
  const hViewers = document.getElementById('statHeaderViewers');
  if (hViewers) hViewers.textContent = currentViewers;

  // KPIs
  const elViewers = document.getElementById('kpiTotalViewers');
  if (elViewers) elViewers.textContent = currentViewers;
  const elPeak = document.getElementById('kpiPeakViewers');
  if (elPeak) elPeak.textContent = stats.peakViewers || 0;
  
  const v = stats.currentViewers || { tiktok: 0, youtube: 0, twitch: 0 };
  const elBreak = document.getElementById('kpiViewersBreakdown');
  if (elBreak) elBreak.textContent = `TT: ${v.tiktok || 0} | YT: ${v.youtube || 0} | TW: ${v.twitch || 0}`;

  const elLikes = document.getElementById('kpiTotalLikes');
  if (elLikes) elLikes.textContent = totalLikes.toLocaleString('pt-BR');

  const elGifts = document.getElementById('kpiTotalGifts');
  if (elGifts) elGifts.textContent = stats.totalGifts || 0;
  const elGiftVal = document.getElementById('kpiGiftValue');
  if (elGiftVal) elGiftVal.textContent = `${stats.totalGiftValue || 0} 💎`;

  const elFollows = document.getElementById('kpiTotalFollows');
  if (elFollows) elFollows.textContent = (stats.followList ? stats.followList.length : 0);

  const elSubs = document.getElementById('kpiTotalSubs');
  if (elSubs) elSubs.textContent = (stats.subList ? stats.subList.length : 0);

  const elDonates = document.getElementById('kpiTotalDonates');
  if (elDonates) elDonates.textContent = (stats.donateList ? stats.donateList.length : 0);

  const elMsgs = document.getElementById('kpiTotalMessages');
  if (elMsgs) elMsgs.textContent = (stats.totalMessages || 0).toLocaleString('pt-BR');

  const elCmds = document.getElementById('kpiTotalCommands');
  if (elCmds) elCmds.textContent = (stats.totalCommands || 0).toLocaleString('pt-BR');

  const elUnique = document.getElementById('kpiUniqueChatters');
  if (elUnique) elUnique.textContent = (stats.uniqueChatters ? stats.uniqueChatters.length : 0);

  const elCoffees = document.getElementById('kpiCoffeesPoured');
  if (elCoffees) elCoffees.textContent = stats.coffeesPoured || 0;

  renderKpiDrawers(stats);
}

function updateCoffeeStats(current, target) {
  document.getElementById('kpiCoffeeMeter').textContent = `${current} / ${target}`;
  const cupNumber = document.getElementById('dashCupNumber');
  if (cupNumber) cupNumber.textContent = `${current} / ${target}`;
  const bar = document.getElementById('dashCupProgress');
  if (bar) {
    const pct = Math.min(100, Math.round((current / (target || 1)) * 100));
    bar.style.width = pct + '%';
  }
}

function updateLikesStats(total, target) {
  const current = Number(total || 0);
  const tgt = Number(target || 10000);

  document.getElementById('statHeaderLikes').textContent = current.toLocaleString('pt-BR');
  document.getElementById('kpiTotalLikes').textContent = current.toLocaleString('pt-BR');
  document.getElementById('kpiLikeGoalTarget').textContent = tgt.toLocaleString('pt-BR');
  
  const pct = Math.min(100, Math.round((current / (tgt || 1)) * 100));
  document.getElementById('kpiLikeProgressPct').textContent = `${pct}% da meta`;
}

function updateGiftStats(totalGifts, giftValue = null) {
  document.getElementById('kpiTotalGifts').textContent = totalGifts || 0;
  if (giftValue !== null) {
    document.getElementById('kpiGiftValue').textContent = `${giftValue} 💎`;
  }
}

function updateViewersStats(platformViewers, total, peak) {
  document.getElementById('statHeaderViewers').textContent = total;
  document.getElementById('kpiTotalViewers').textContent = total;
  if (peak) document.getElementById('kpiPeakViewers').textContent = peak;
}

// Activity Feed
function addActivityFeedItem(item) {
  const box = document.getElementById('activityFeedBox');
  if (!box) return;

  const div = document.createElement('div');
  div.className = 'feed-item';
  div.innerHTML = `
    <div class="feed-icon">${item.icon || '☕'}</div>
    <div class="feed-body">
      <div class="feed-title">${escapeHtml(item.title)}</div>
      <div class="feed-desc">${escapeHtml(item.desc)}</div>
    </div>
    <div class="feed-time">${item.time || 'Agora'}</div>
  `;
  box.insertBefore(div, box.firstChild);

  if (box.children.length > 40) {
    box.removeChild(box.lastChild);
  }
}

function renderActivityFeed(events) {
  const box = document.getElementById('activityFeedBox');
  if (!box || !events) return;
  box.innerHTML = '';

  events.slice(0, 30).forEach(evt => {
    let icon = '⚡';
    if (evt.type === 'gift') icon = '🎁';
    else if (evt.type === 'like_milestone') icon = '🔥';
    else if (evt.type === 'minigame') icon = '🎰';
    else if (evt.type === 'coffee') icon = '☕';
    else if (evt.type === 'duel') icon = '⚔️';
    else if (evt.type === 'transfer') icon = '💸';

    const div = document.createElement('div');
    div.className = 'feed-item';
    const timeAgo = formatTimeAgo(evt.timestamp);

    div.innerHTML = `
      <div class="feed-icon">${icon}</div>
      <div class="feed-body">
        <div class="feed-title">${escapeHtml(evt.title)}</div>
        <div class="feed-desc">${escapeHtml(evt.description || '')}</div>
      </div>
      <div class="feed-time">${timeAgo}</div>
    `;
    box.appendChild(div);
  });
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Agora';
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  const min = Math.floor(diff / 60);
  if (min < 60) return `${min}m atrás`;
  return `${Math.floor(min / 60)}h atrás`;
}

// Canvas Timeline Chart
function initTimelineCanvas() {
  window.addEventListener('resize', () => {
    if (currentTab === 'analytics') renderTimelineChart();
  });
  renderTimelineChart();
}

function renderTimelineChart() {
  const canvas = document.getElementById('liveTimelineCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Adjust canvas resolution for sharp rendering
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * (window.devicePixelRatio || 1);
  canvas.height = rect.height * (window.devicePixelRatio || 1);
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  // If no data points yet, draw a placeholder baseline
  if (!timelineData || timelineData.length === 0) {
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Aguardando histórico da transmissão... O gráfico atualizará a cada 2 minutos.', w / 2, h / 2);
    return;
  }

  const padding = { top: 20, right: 25, bottom: 30, left: 45 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;

  // Calculate max values
  const maxViewers = Math.max(10, ...timelineData.map(d => d.viewers || 0));
  const maxLikes = Math.max(100, ...timelineData.map(d => d.likes || 0));

  // Draw Grid lines
  ctx.strokeStyle = 'rgba(56, 46, 39, 0.4)';
  ctx.lineWidth = 1;
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const y = padding.top + (plotH / gridSteps) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();

    // Viewer labels on left axis
    const vVal = Math.round(maxViewers * (1 - i / gridSteps));
    ctx.fillStyle = '#60a5fa';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(vVal, padding.left - 8, y + 3);
  }

  // Draw Likes line (Red)
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  timelineData.forEach((pt, idx) => {
    const x = padding.left + (plotW / Math.max(1, timelineData.length - 1)) * idx;
    const y = padding.top + plotH - ((pt.likes || 0) / maxLikes) * plotH;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Draw Viewers line (Blue)
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  timelineData.forEach((pt, idx) => {
    const x = padding.left + (plotW / Math.max(1, timelineData.length - 1)) * idx;
    const y = padding.top + plotH - ((pt.viewers || 0) / maxViewers) * plotH;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Draw time labels at the bottom
  ctx.fillStyle = '#9ca3af';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  const labelStep = Math.max(1, Math.floor(timelineData.length / 5));
  timelineData.forEach((pt, idx) => {
    if (idx % labelStep === 0 || idx === timelineData.length - 1) {
      const x = padding.left + (plotW / Math.max(1, timelineData.length - 1)) * idx;
      ctx.fillText(pt.time || '', x, h - 10);
    }
  });
}

// Indicators
function updateTwitchIndicator(connected, status) {
  const ind = document.getElementById('twitchIndicator');
  const text = document.getElementById('twitchStatusText');
  if (!ind || !text) return;
  if (connected) {
    ind.className = 'status-indicator';
    text.textContent = '👾 Twitch: Ao Vivo';
    text.style.color = '#a855f7';
  } else {
    ind.className = 'status-indicator offline';
    text.textContent = '👾 Twitch: Standby';
    text.style.color = '#9ca3af';
  }
}

function updateYouTubeIndicator(connected, status, liveId) {
  const ind = document.getElementById('youtubeIndicator');
  const text = document.getElementById('youtubeStatusText');
  if (!ind || !text) return;
  if (connected) {
    ind.className = 'status-indicator';
    text.textContent = `▶️ YouTube: Ao Vivo`;
    text.style.color = '#ef4444';
  } else {
    ind.className = 'status-indicator offline';
    text.textContent = '▶️ YouTube: Standby';
    text.style.color = '#9ca3af';
  }
}

function updateTikTokIndicator(connected, status, username) {
  const ind = document.getElementById('tiktokIndicator');
  const text = document.getElementById('tiktokStatusText');
  if (!ind || !text) return;
  if (connected) {
    ind.className = 'status-indicator';
    text.textContent = `🎵 TikTok: Conectado`;
    text.style.color = '#22d3ee';
  } else {
    ind.className = 'status-indicator offline';
    text.textContent = '🎵 TikTok: Desconectado';
    text.style.color = '#9ca3af';
  }
}

// Live Simulations
function simulateLikes(count) {
  showToast(`❤️ Enviando +${count} likes simulados...`);
  fetch('/api/simulate/likes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count, user: 'ViewerFiel' })
  }).catch(console.error);
}

function simulateGift(giftName, count, diamonds) {
  showToast(`🎁 Enviando ${giftName} x${count}...`);
  fetch('/api/simulate/gift', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ giftName, count, diamonds, user: 'DoadorMaster' })
  }).catch(console.error);
}

function triggerCoffeeRain(amount) {
  showToast(`🎉 Disparando Chuva de Cafezinhos (+${amount})...`);
  fetch('/api/simulate/rain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount })
  }).catch(console.error);
}

function resetLiveStats() {
  if (!confirm('Deseja zerar as estatísticas da sessão atual? (Curtidas, mensagens e presentes acumulados serão resetados)')) return;
  fetch('/api/stats/reset', { method: 'POST' })
    .then(r => r.json())
    .then(() => {
      showToast('Sessão resetada com sucesso!');
      loadStatus();
    });
}

// Chat Simulator Setup
function setupChatSimulator() {
  const form = document.getElementById('chatForm');
  const input = document.getElementById('simMessageInput');
  const userSelect = document.getElementById('simUsername');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;

    const username = userSelect.value.trim() || 'Vinicius';
    const role = document.querySelector('input[name="simRole"]:checked').value;

    const payload = {
      user: username,
      message,
      isBroadcaster: role === 'broadcaster',
      isMod: role === 'mod',
      isVip: role === 'vip',
      isSub: role === 'sub'
    };

    fetch('/api/test/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(() => {
      setTimeout(updateSimUserBalance, 400);
    })
    .catch(console.error);

    input.value = '';
  });

  userSelect.addEventListener('change', updateSimUserBalance);
}

function updateSimUserBalance() {
  const username = (document.getElementById('simUsername').value || 'Vinicius').trim().toLowerCase();
  fetch('/api/points')
    .then(r => r.json())
    .then(pts => {
      const bal = pts[username] || 0;
      const el = document.getElementById('simUserBalance');
      if (el) el.textContent = bal;
    })
    .catch(()=>{});
}

function setupQuickActions() {
  document.querySelectorAll('.quick-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      document.getElementById('simMessageInput').value = cmd;
      document.getElementById('chatForm').dispatchEvent(new Event('submit'));
    });
  });
}

function appendSimulatorMessage(data) {
  const box = document.getElementById('chatMessagesBox');
  if (!box) return;

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.flexDirection = 'column';
  row.style.background = data.isBot ? 'rgba(217, 119, 6, 0.12)' : 'rgba(255,255,255,0.03)';
  row.style.border = data.isBot ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #2d2621';
  row.style.borderRadius = '8px';
  row.style.padding = '8px 12px';
  row.style.margin = '4px 0';
  row.style.animation = 'fadeIn 0.2s ease-out';

  let platformBadge = '';
  if (data.platform === 'tiktok') platformBadge = '<span class="badge-tag" style="background:#111827; color:#22d3ee; border:1px solid #f43f5e;">🎵 TIKTOK</span> ';
  else if (data.platform === 'youtube') platformBadge = '<span class="badge-tag" style="background:#ef4444; color:#fff;">▶️ YOUTUBE</span> ';
  else if (data.platform === 'twitch') platformBadge = '<span class="badge-tag" style="background:#9333ea; color:#fff;">👾 TWITCH</span> ';
  else if (!data.isBot) platformBadge = '<span class="badge-tag" style="background:#374151; color:#9ca3af;">🖥️ SIM</span> ';

  let roleBadge = '';
  if (data.isBot) roleBadge = '<span class="badge-tag badge-tag-amber">☕ BOT</span> ';
  else if (data.isBroadcaster) roleBadge = '<span class="badge-tag" style="background:#dc2626; color:#fff;">👑 STREAMER</span> ';
  else if (data.isMod) roleBadge = '<span class="badge-tag badge-tag-green">⚔️ MOD</span> ';
  else if (data.isVip) roleBadge = '<span class="badge-tag badge-tag-purple">💎 VIP</span> ';
  else if (data.isSub) roleBadge = '<span class="badge-tag" style="background:#8b5cf6; color:#fff;">⭐ SUB</span> ';

  const time = new Date(data.timestamp || Date.now()).toLocaleTimeString();

  row.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:12px;">
      <div>
        ${platformBadge}
        ${roleBadge}
        <strong style="color:${data.isBot ? '#fbbf24' : '#fef3c7'}">${escapeHtml(data.user)}</strong>
      </div>
      <span style="color:#6b7280; font-size:11px;">${time}</span>
    </div>
    <div style="font-size:13px; color:#f3f4f6; word-break:break-word;">
      ${escapeHtml(data.message)}
    </div>
  `;

  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}

// Commands Management
function loadCommands() {
  fetch('/api/commands')
    .then(r => r.json())
    .then(renderCommandsTable)
    .catch(console.error);
}

function renderCommandsTable(commands) {
  const tbody = document.getElementById('commandsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const tag = document.getElementById('totalCommandsCountTag');
  if (tag) tag.textContent = `${commands.length} Comandos Ativos`;

  commands.forEach(cmd => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color:#fbbf24; font-size:14px;">!${escapeHtml(cmd.name)}</strong></td>
      <td><span class="badge-tag badge-tag-amber">${cmd.permission}</span></td>
      <td class="col-response-text">
        ${escapeHtml(cmd.response || (cmd.action ? `[Ação Especial: ${cmd.action}]` : ''))}
      </td>
      <td style="white-space:nowrap; font-weight:600;">${cmd.cooldown}s / ${cmd.userCooldown}s</td>
      <td>
        <span class="badge-tag ${cmd.enabled ? 'badge-tag-green' : 'badge-tag-amber'}">
          ${cmd.enabled ? 'Ativo' : 'Pausado'}
        </span>
      </td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" onclick="editCommand('${cmd.name}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCommand('${cmd.name}')">Excluir</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function saveCommand(e) {
  e.preventDefault();
  const name = document.getElementById('cmdName').value.trim();
  const response = document.getElementById('cmdResponse').value.trim();
  const aliases = document.getElementById('cmdAliases').value.trim();
  const permission = document.getElementById('cmdPermission').value;
  const cooldown = parseInt(document.getElementById('cmdCooldown').value) || 0;
  const userCooldown = parseInt(document.getElementById('cmdUserCooldown').value) || 0;
  const enabled = document.getElementById('cmdEnabled').checked;

  fetch('/api/commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, response, aliases, permission, cooldown, userCooldown, enabled })
  })
  .then(r => r.json())
  .then(res => {
    if (res.success) {
      showToast(`Comando !${name} salvo!`);
      loadCommands();
      resetCommandForm();
    }
  });
}

function editCommand(name) {
  fetch('/api/commands')
    .then(r => r.json())
    .then(commands => {
      const cmd = commands.find(c => c.name === name);
      if (!cmd) return;
      document.getElementById('cmdName').value = cmd.name;
      document.getElementById('cmdResponse').value = cmd.response || '';
      document.getElementById('cmdAliases').value = (cmd.aliases || []).join(', ');
      document.getElementById('cmdPermission').value = cmd.permission || 'everyone';
      document.getElementById('cmdCooldown').value = cmd.cooldown || 0;
      document.getElementById('cmdUserCooldown').value = cmd.userCooldown || 0;
      document.getElementById('cmdEnabled').checked = cmd.enabled !== false;
      document.getElementById('cmdFormCard').scrollIntoView({ behavior: 'smooth' });
    });
}

function deleteCommand(name) {
  if (!confirm(`Excluir comando !${name}?`)) return;
  fetch(`/api/commands/${name}`, { method: 'DELETE' })
    .then(r => r.json())
    .then(() => {
      showToast(`Comando !${name} excluído!`);
      loadCommands();
    });
}

function resetCommandForm() {
  document.getElementById('commandForm').reset();
  document.getElementById('cmdEnabled').checked = true;
}

function insertVariable(v) {
  const textarea = document.getElementById('cmdResponse');
  const pos = textarea.selectionStart;
  const before = textarea.value.substring(0, pos);
  const after = textarea.value.substring(pos);
  textarea.value = before + v + after;
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = pos + v.length;
}

// Timers Management
function loadTimers() {
  fetch('/api/timers')
    .then(r => r.json())
    .then(renderTimersTable)
    .catch(console.error);
}

function renderTimersTable(timers) {
  const tbody = document.getElementById('timersTableBody');
  tbody.innerHTML = '';

  timers.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(t.name)}</strong></td>
      <td style="max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
        ${escapeHtml(t.message)}
      </td>
      <td>Cada <strong>${t.intervalMinutes} min</strong></td>
      <td>Mínimo <strong>${t.chatLinesThreshold} msgs</strong></td>
      <td>
        <span class="badge-tag ${t.enabled ? 'badge-tag-green' : 'badge-tag-amber'}">
          ${t.enabled ? 'Ativo' : 'Pausado'}
        </span>
      </td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteTimer('${t.id}')">Excluir</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function saveTimer(e) {
  e.preventDefault();
  const name = document.getElementById('timerName').value.trim();
  const message = document.getElementById('timerMessage').value.trim();
  const intervalMinutes = parseInt(document.getElementById('timerInterval').value) || 15;
  const chatLinesThreshold = parseInt(document.getElementById('timerLines').value) || 3;
  const enabled = document.getElementById('timerEnabled').checked;

  fetch('/api/timers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, message, intervalMinutes, chatLinesThreshold, enabled })
  })
  .then(r => r.json())
  .then(res => {
    if (res.success) {
      showToast(`Timer "${name}" salvo!`);
      loadTimers();
      document.getElementById('timerForm').reset();
      document.getElementById('timerEnabled').checked = true;
    }
  });
}

function deleteTimer(id) {
  if (!confirm('Deseja excluir este timer?')) return;
  fetch(`/api/timers/${id}`, { method: 'DELETE' })
    .then(r => r.json())
    .then(() => {
      showToast('Timer excluído!');
      loadTimers();
    });
}

// Goals & Cafezinhos Management
function saveMeterSettings() {
  const target = parseInt(document.getElementById('meterTargetInput').value) || 50;
  const current = parseInt(document.getElementById('meterCurrentInput').value) || 0;
  const title = document.getElementById('meterTitleInput').value.trim() || 'Cafés do Dia ☕';

  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      coffeeMeter: { target, current, title }
    })
  })
  .then(r => r.json())
  .then(() => {
    showToast('Meta de café atualizada!');
    updateCoffeeStats(current, target);
  });
}

function addCoffeeDirect(qty) {
  const current = (parseInt(document.getElementById('meterCurrentInput').value) || 0) + qty;
  const target = parseInt(document.getElementById('meterTargetInput').value) || 50;
  document.getElementById('meterCurrentInput').value = current;
  saveMeterSettings();
}

function resetCoffeeMeter() {
  document.getElementById('meterCurrentInput').value = 0;
  saveMeterSettings();
}

function renderLeaderboard(list) {
  const tbody = document.getElementById('leaderboardBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  list.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${index + 1}</td>
      <td><strong>@${escapeHtml(item.user)}</strong></td>
      <td><span style="color:#fbbf24; font-weight:700;">☕ ${item.beans}</span> Cafezinhos</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="adjustBeans('${item.user}', 50)">+50</button>
        <button class="btn btn-secondary btn-sm" onclick="adjustBeans('${item.user}', -50)">-50</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function adjustBeans(user, amount) {
  fetch('/api/points', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, amount })
  })
  .then(r => r.json())
  .then(res => {
    showToast(`Cafezinhos de @${user} ajustados! Novo saldo: ${res.beans}`);
    loadStatus();
  });
}

function giveManualPoints() {
  const user = document.getElementById('manualBonusUser').value.trim();
  const amount = parseInt(document.getElementById('manualBonusAmount').value) || 100;
  if (!user) return alert('Digite o nome do usuário!');
  adjustBeans(user, amount);
  document.getElementById('manualBonusUser').value = '';
}

// Raffle Management
function toggleRaffle() {
  fetch('/api/status')
    .then(r => r.json())
    .then(data => {
      const active = data.raffle ? !data.raffle.active : true;
      const prize = document.getElementById('rafflePrizeInput').value.trim();

      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raffle: {
            active,
            prize,
            entries: active ? (data.raffle ? data.raffle.entries : []) : []
          }
        })
      }).then(() => {
        showToast(active ? 'Sorteio iniciado!' : 'Sorteio encerrado!');
        loadStatus();
      });
    });
}

function drawRaffleWinner() {
  fetch('/api/status')
    .then(r => r.json())
    .then(data => {
      const entries = (data.raffle && data.raffle.entries) || [];
      if (entries.length === 0) return alert('Nenhum participante inscrito no sorteio!');

      const winner = entries[Math.floor(Math.random() * entries.length)];
      showToast(`🎉 VENCEDOR DO SORTEIO: @${winner}!`);

      fetch('/api/test/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '🎉 VENCEDOR DO SORTEIO!',
          message: `@${winner} ganhou: ${data.raffle.prize}!`,
          icon: '🎁'
        })
      });
    });
}

function clearRaffle() {
  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      raffle: { active: false, prize: 'VIP + 500 Cafezinhos', entries: [] }
    })
  }).then(() => {
    showToast('Lista de participantes limpa!');
    loadStatus();
  });
}

// Load & Save All Settings (General, Currency, Mini-Games, Goals, Automod)
function loadSettings() {
  fetch('/api/settings')
    .then(r => r.json())
    .then(data => {
      // General
      if (data.botName) document.getElementById('cfgBotName').value = data.botName;
      if (data.prefix) document.getElementById('cfgBotPrefix').value = data.prefix;
      if (data.port) document.getElementById('cfgPort').value = data.port;
      document.getElementById('cfgSoundEnabled').checked = data.soundEnabled !== false;

      // Currency
      if (data.currency) {
        document.getElementById('cfgCurrencyName').value = data.currency.name || 'Cafezinho';
        document.getElementById('cfgCurrencyPlural').value = data.currency.plural || 'Cafezinhos';
        document.getElementById('cfgFarmingEnabled').checked = data.currency.farmingEnabled !== false;
        document.getElementById('cfgFarmingAmount').value = data.currency.farmingAmount || 5;
        document.getElementById('cfgFarmingInterval').value = data.currency.farmingIntervalMinutes || 2;
        document.getElementById('cfgSubMultiplier').value = data.currency.subMultiplier || 1.5;
        const elFan = document.getElementById('cfgTikTokFanMultiplier');
        if (elFan) elFan.value = data.currency.tiktokFanMultiplier || 1.5;
        const elMem = document.getElementById('cfgYouTubeMemberMultiplier');
        if (elMem) elMem.value = data.currency.youtubeMemberMultiplier || 1.5;
        document.getElementById('cfgVipMultiplier').value = data.currency.vipMultiplier || 1.2;
        document.getElementById('cfgCoffeeReward').value = data.currency.coffeeReward || 10;
      }

      // Minigames
      if (data.minigames) {
        if (data.minigames.roulette) {
          document.getElementById('cfgRouletteChance').value = data.minigames.roulette.winChance || 50;
          document.getElementById('cfgRouletteMultiplier').value = data.minigames.roulette.multiplier || 2.0;
          document.getElementById('cfgRouletteMinBet').value = data.minigames.roulette.minBet || 1;
          document.getElementById('cfgRouletteMaxBet').value = data.minigames.roulette.maxBet || 10000;
          const elRC = document.getElementById('cfgRouletteCooldown');
          if (elRC) elRC.value = data.minigames.roulette.cooldownMinutes || 5;
        }
        if (data.minigames.slots) {
          document.getElementById('cfgSlotsWinChance').value = data.minigames.slots.winChancePercent || 40;
          document.getElementById('cfgSlotsJackpot').value = data.minigames.slots.jackpotMultiplier || 5.0;
          document.getElementById('cfgSlotsPair').value = data.minigames.slots.pairMultiplier || 1.5;
          document.getElementById('cfgSlotsMinBet').value = data.minigames.slots.minBet || 5;
          document.getElementById('cfgSlotsMaxBet').value = data.minigames.slots.maxBet || 5000;
          const elSC = document.getElementById('cfgSlotsCooldown');
          if (elSC) elSC.value = data.minigames.slots.cooldownMinutes || 5;
        }
        if (data.minigames.duel) {
          document.getElementById('cfgDuelTimeout').value = data.minigames.duel.timeoutSeconds || 60;
          document.getElementById('cfgDuelMinBet').value = data.minigames.duel.minBet || 5;
          document.getElementById('cfgDuelMaxBet').value = data.minigames.duel.maxBet || 20000;
          const elDC = document.getElementById('cfgDuelCooldown');
          if (elDC) elDC.value = data.minigames.duel.cooldownMinutes || 5;
        }
      }

      // Goals
      if (data.likeGoal) {
        document.getElementById('cfgLikeTarget').value = data.likeGoal.target || 10000;
        document.getElementById('cfgLikeStep').value = data.likeGoal.step || 5000;
        document.getElementById('cfgLikeAutoIncrement').checked = data.likeGoal.autoIncrement !== false;
        document.getElementById('cfgLikeReward').value = data.likeGoal.rewardAllActive || 25;
      }
      if (data.donateGoal) {
        document.getElementById('cfgDonateTitle').value = data.donateGoal.title || 'Meta de Presentes 🎁';
        document.getElementById('cfgDonateTarget').value = data.donateGoal.target || 10;
        const elDStep = document.getElementById('cfgDonateStep');
        if (elDStep) elDStep.value = data.donateGoal.step || 10;
        const elDReward = document.getElementById('cfgDonateReward');
        if (elDReward) elDReward.value = data.donateGoal.rewardAllActive || 25;
        const elDAuto = document.getElementById('cfgDonateAutoIncrement');
        if (elDAuto) elDAuto.checked = data.donateGoal.autoIncrement !== false;
      }

      // Live connections
      if (data.tiktok) {
        document.getElementById('cfgTikTokUser').value = data.tiktok.username || '@gamescoffeesr';
        document.getElementById('cfgTikTokKey').value = data.tiktok.apiKey || '';
      }
      if (data.youtube) {
        document.getElementById('cfgYouTubeUrl').value = data.youtube.liveId || 'eQte0FqK0LU';
      }
      if (data.twitch) {
        document.getElementById('cfgTwitchChannel').value = data.twitch.channel || '';
        document.getElementById('cfgTwitchBotUser').value = data.twitch.botUsername || 'CoffeeBot';
        document.getElementById('cfgTwitchToken').value = data.twitch.oauthToken || '';
      }

      // Automod
      if (data.moderation) {
        document.getElementById('cfgModCaps').checked = Boolean(data.moderation.filterCaps);
        document.getElementById('cfgCapsThreshold').value = data.moderation.capsThresholdPercent || 70;
        document.getElementById('cfgCapsMinLength').value = data.moderation.capsMinLength || 10;
        document.getElementById('cfgModLinks').checked = Boolean(data.moderation.blockLinks);
      }
    })
    .catch(console.error);
}

function saveAllSettings() {
  const elFan = document.getElementById('cfgTikTokFanMultiplier');
  const elMem = document.getElementById('cfgYouTubeMemberMultiplier');
  const elRC = document.getElementById('cfgRouletteCooldown');
  const elSC = document.getElementById('cfgSlotsCooldown');
  const elDC = document.getElementById('cfgDuelCooldown');
  const elDStep = document.getElementById('cfgDonateStep');
  const elDReward = document.getElementById('cfgDonateReward');
  const elDAuto = document.getElementById('cfgDonateAutoIncrement');

  const settings = {
    botName: document.getElementById('cfgBotName').value.trim() || 'Coffee Bot',
    prefix: document.getElementById('cfgBotPrefix').value.trim() || '!',
    port: 3334,
    soundEnabled: document.getElementById('cfgSoundEnabled').checked,

    currency: {
      name: document.getElementById('cfgCurrencyName').value.trim() || 'Cafezinho',
      plural: document.getElementById('cfgCurrencyPlural').value.trim() || 'Cafezinhos',
      farmingEnabled: document.getElementById('cfgFarmingEnabled').checked,
      farmingAmount: parseInt(document.getElementById('cfgFarmingAmount').value) || 5,
      farmingIntervalMinutes: parseInt(document.getElementById('cfgFarmingInterval').value) || 2,
      subMultiplier: parseFloat(document.getElementById('cfgSubMultiplier').value) || 1.5,
      tiktokFanMultiplier: elFan ? (parseFloat(elFan.value) || 1.5) : 1.5,
      youtubeMemberMultiplier: elMem ? (parseFloat(elMem.value) || 1.5) : 1.5,
      vipMultiplier: parseFloat(document.getElementById('cfgVipMultiplier').value) || 1.2,
      coffeeReward: parseInt(document.getElementById('cfgCoffeeReward').value) || 10
    },

    minigames: {
      roulette: {
        winChance: parseInt(document.getElementById('cfgRouletteChance').value) || 50,
        multiplier: parseFloat(document.getElementById('cfgRouletteMultiplier').value) || 2.0,
        minBet: parseInt(document.getElementById('cfgRouletteMinBet').value) || 1,
        maxBet: parseInt(document.getElementById('cfgRouletteMaxBet').value) || 10000,
        cooldownMinutes: elRC ? (parseInt(elRC.value) || 5) : 5
      },
      slots: {
        winChancePercent: parseInt(document.getElementById('cfgSlotsWinChance').value) || 40,
        jackpotMultiplier: parseFloat(document.getElementById('cfgSlotsJackpot').value) || 5.0,
        pairMultiplier: parseFloat(document.getElementById('cfgSlotsPair').value) || 1.5,
        minBet: parseInt(document.getElementById('cfgSlotsMinBet').value) || 5,
        maxBet: parseInt(document.getElementById('cfgSlotsMaxBet').value) || 5000,
        cooldownMinutes: elSC ? (parseInt(elSC.value) || 5) : 5
      },
      duel: {
        timeoutSeconds: parseInt(document.getElementById('cfgDuelTimeout').value) || 60,
        minBet: parseInt(document.getElementById('cfgDuelMinBet').value) || 5,
        maxBet: parseInt(document.getElementById('cfgDuelMaxBet').value) || 20000,
        cooldownMinutes: elDC ? (parseInt(elDC.value) || 5) : 5,
        houseFeePercent: 0
      }
    },

    likeGoal: {
      target: parseInt(document.getElementById('cfgLikeTarget').value) || 10000,
      step: parseInt(document.getElementById('cfgLikeStep').value) || 5000,
      autoIncrement: document.getElementById('cfgLikeAutoIncrement').checked,
      rewardAllActive: parseInt(document.getElementById('cfgLikeReward').value) || 25
    },

    donateGoal: {
      title: document.getElementById('cfgDonateTitle').value.trim() || 'Meta de Presentes 🎁',
      target: parseInt(document.getElementById('cfgDonateTarget').value) || 10,
      step: elDStep ? (parseInt(elDStep.value) || 10) : 10,
      rewardAllActive: elDReward ? (parseInt(elDReward.value) || 25) : 25,
      autoIncrement: elDAuto ? elDAuto.checked : true
    },

    moderation: {
      filterCaps: document.getElementById('cfgModCaps').checked,
      capsThresholdPercent: parseInt(document.getElementById('cfgCapsThreshold').value) || 70,
      capsMinLength: parseInt(document.getElementById('cfgCapsMinLength').value) || 10,
      blockLinks: document.getElementById('cfgModLinks').checked
    }
  };

  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  })
  .then(r => r.json())
  .then(() => {
    showToast('Configurações salvas com sucesso!');
    loadStatus();
  })
  .catch(console.error);
}

// Live Platform Connect Functions
function connectTikTok() {
  const username = document.getElementById('cfgTikTokUser').value.trim();
  const apiKey = document.getElementById('cfgTikTokKey').value.trim();
  if (!username) return alert('Insira o @usuario do TikTok!');
  showToast('Conectando ao TikTok Live...');
  fetch('/api/tiktok/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, apiKey })
  }).then(r => r.json()).then(res => {
    showToast(res.message);
    loadStatus();
  });
}

function disconnectTikTok() {
  fetch('/api/tiktok/disconnect', { method: 'POST' })
    .then(r => r.json())
    .then(res => {
      showToast(res.message);
      loadStatus();
    });
}

function connectYouTube() {
  const liveUrl = document.getElementById('cfgYouTubeUrl').value.trim();
  if (!liveUrl) return alert('Insira o link ou ID da live do YouTube!');
  showToast('Conectando ao YouTube Live...');
  fetch('/api/youtube/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ liveUrl })
  }).then(r => r.json()).then(res => {
    showToast(res.message);
    loadStatus();
  });
}

function disconnectYouTube() {
  fetch('/api/youtube/disconnect', { method: 'POST' })
    .then(r => r.json())
    .then(res => {
      showToast(res.message);
      loadStatus();
    });
}

function connectTwitch() {
  const channel = document.getElementById('cfgTwitchChannel').value.trim();
  const botUsername = document.getElementById('cfgTwitchBotUser').value.trim();
  const oauthToken = document.getElementById('cfgTwitchToken').value.trim();

  if (!channel) return alert('Insira o nome do canal da Twitch!');

  fetch('/api/twitch/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, botUsername, oauthToken })
  })
  .then(r => r.json())
  .then(res => {
    showToast(res.message);
    loadStatus();
  });
}

function disconnectTwitch() {
  fetch('/api/twitch/disconnect', { method: 'POST' })
    .then(r => r.json())
    .then(res => {
      showToast(res.message);
      loadStatus();
    });
}

// Widgets Copy & Test
function copyWidgetUrl(id) {
  const origin = window.location.origin;
  const url = `${origin}/widgets/${id}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast(`URL do widget copiada: ${url}`);
  });
}

function testAlertWidget() {
  fetch('/api/test/alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '☕ NOVO SEGUIDOR NA LIVE!',
      message: 'Bem-vindo à cafeteria! Pegue sua xícara quentinha!',
      icon: '🎉'
    })
  }).then(() => showToast('Alerta de teste enviado para o OBS!'));
}

// Toast
function showToast(msg) {
  const toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.bottom = '24px';
  toast.style.right = '24px';
  toast.style.background = 'rgba(23, 20, 18, 0.95)';
  toast.style.border = '1px solid #f59e0b';
  toast.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.7)';
  toast.style.color = '#fff';
  toast.style.padding = '12px 20px';
  toast.style.borderRadius = '10px';
  toast.style.fontSize = '14px';
  toast.style.zIndex = '9999';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '8px';
  toast.innerHTML = `<span>☕</span> <span>${escapeHtml(msg)}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- Unified Live Chat & Stream Monitor ---
let liveMessages = [];
let currentLiveFilter = 'all';
let isAutoScrollEnabled = true;

function appendLiveChatMessage(data) {
  liveMessages.push(data);
  if (liveMessages.length > 250) liveMessages.shift();

  const badge = document.getElementById('liveMessagesCountBadge');
  if (badge) badge.textContent = `${liveMessages.length} msgs`;

  const box = document.getElementById('liveUnifiedChatBox');
  if (!box) return;

  // Clear welcome placeholder on first incoming message
  if (liveMessages.length === 1 && box.innerHTML.includes('Coffee Bot Monitor Ativo')) {
    box.innerHTML = '';
  }

  const platform = (data.platform || 'simulador').toLowerCase();
  const shouldDisplay = (currentLiveFilter === 'all' || currentLiveFilter === platform);

  const card = document.createElement('div');
  card.className = 'live-msg-card';
  card.dataset.platform = platform;
  if (!shouldDisplay) card.style.display = 'none';

  let pBadgeClass = 'platform-badge-sim';
  let pBadgeText = '☕ Simulador';
  if (platform === 'youtube') {
    pBadgeClass = 'platform-badge-yt';
    pBadgeText = '🔴 YouTube';
  } else if (platform === 'tiktok') {
    pBadgeClass = 'platform-badge-tt';
    pBadgeText = '🎵 TikTok';
  } else if (platform === 'twitch') {
    pBadgeClass = 'platform-badge-tw';
    pBadgeText = '🟣 Twitch';
  }

  let roleBadges = '';
  if (data.isBroadcaster) roleBadges += ' <span style="color:#f59e0b; font-weight:800; font-size:11px;">[👑 STREAMER]</span>';
  if (data.isMod) roleBadges += ' <span style="color:#60a5fa; font-weight:800; font-size:11px;">[🛡️ MOD]</span>';
  if (data.isVip) roleBadges += ' <span style="color:#c084fc; font-weight:800; font-size:11px;">[⭐ VIP]</span>';
  if (data.isSub) roleBadges += ' <span style="color:#34d399; font-weight:800; font-size:11px;">[💎 SUB]</span>';

  const timeStr = new Date(data.timestamp || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  card.innerHTML = `
    <span class="platform-badge ${pBadgeClass}">${pBadgeText}</span>
    <div style="flex:1;">
      <span class="msg-author-tag" style="color:${data.isBot ? '#fbbf24' : '#fff'};">
        ${data.isBot ? '🤖 Coffee Bot' : `@${escapeHtml(data.user || 'Espectador')}`}${roleBadges}:
      </span>
      <span class="msg-text-content">${escapeHtml(data.message || '')}</span>
    </div>
    <span class="msg-timestamp">${timeStr}</span>
  `;

  box.appendChild(card);
  if (isAutoScrollEnabled) {
    box.scrollTop = box.scrollHeight;
  }
}

function filterLiveMessages(platform) {
  currentLiveFilter = platform;
  document.querySelectorAll('.live-chat-filters .filter-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.platform === platform);
  });

  const cards = document.querySelectorAll('#liveUnifiedChatBox .live-msg-card');
  cards.forEach(card => {
    if (platform === 'all' || card.dataset.platform === platform) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });

  if (isAutoScrollEnabled) {
    const box = document.getElementById('liveUnifiedChatBox');
    if (box) box.scrollTop = box.scrollHeight;
  }
}

function toggleAutoScroll() {
  isAutoScrollEnabled = !isAutoScrollEnabled;
  const btn = document.getElementById('btnToggleAutoScroll');
  if (btn) {
    btn.textContent = isAutoScrollEnabled ? '📌 Rolar: ON' : '⏸️ Rolar: PAUSADO';
    btn.classList.toggle('btn-primary', isAutoScrollEnabled);
    btn.classList.toggle('btn-secondary', !isAutoScrollEnabled);
  }
}

function clearLiveMessages() {
  liveMessages = [];
  const box = document.getElementById('liveUnifiedChatBox');
  if (box) {
    box.innerHTML = '<div style="text-align:center; padding:30px 20px; color:#9ca3af; font-size:13px;">Chat limpo. Aguardando novas mensagens...</div>';
  }
  const badge = document.getElementById('liveMessagesCountBadge');
  if (badge) badge.textContent = '0 msgs';
}

function sendLiveQuickMessage(e) {
  e.preventDefault();
  const input = document.getElementById('liveQuickInput');
  const message = input.value.trim();
  if (!message) return;

  fetch('/api/test/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: 'Streamer',
      message,
      isBroadcaster: true,
      platform: 'simulador'
    })
  });
  input.value = '';
}

// --- KPI Details Drawers ---
let currentOpenDrawer = null;

function toggleKpiDrawer(type) {
  const container = document.getElementById('kpiDrawerContainer');
  if (!container) return;

  if (currentOpenDrawer === type && container.classList.contains('open')) {
    container.classList.remove('open');
    currentOpenDrawer = null;
    return;
  }

  container.classList.add('open');
  currentOpenDrawer = type;
  switchDrawerTab(type === 'likes' ? 'gifts' : type);
}

function closeKpiDrawer() {
  const container = document.getElementById('kpiDrawerContainer');
  if (container) container.classList.remove('open');
  currentOpenDrawer = null;
}

function switchDrawerTab(tab) {
  const tabs = ['gifts', 'follows', 'subs', 'donates'];
  tabs.forEach(t => {
    const btn = document.getElementById(`drawerTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const pane = document.getElementById(`drawerPane${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) btn.classList.toggle('active', t === tab);
    if (pane) pane.style.display = (t === tab ? 'block' : 'none');
  });
}

function renderKpiDrawers(stats) {
  if (!stats) return;

  // 1. Gifts Drawer
  const giftsBody = document.getElementById('drawerGiftsTableBody');
  if (giftsBody) {
    const list = stats.giftList || [];
    if (list.length === 0) {
      giftsBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#9ca3af;">Nenhum presente registrado nesta sessão.</td></tr>';
    } else {
      giftsBody.innerHTML = list.map(item => `
        <tr>
          <td style="color:#9ca3af; font-size:12px;">${new Date(item.timestamp || Date.now()).toLocaleTimeString('pt-BR')}</td>
          <td><strong style="color:#fbbf24;">@${escapeHtml(item.user)}</strong></td>
          <td>${escapeHtml(item.giftName)}</td>
          <td>x${item.count}</td>
          <td><span style="color:#ec4899; font-weight:700;">💎 ${item.diamonds}</span></td>
          <td><span class="badge-tag badge-tag-amber">${item.platform || 'tiktok'}</span></td>
        </tr>
      `).join('');
    }
  }

  // 2. Follows Drawer
  const followsBody = document.getElementById('drawerFollowsTableBody');
  if (followsBody) {
    const list = stats.followList || [];
    if (list.length === 0) {
      followsBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#9ca3af;">Nenhum novo seguidor registrado nesta sessão.</td></tr>';
    } else {
      followsBody.innerHTML = list.map(item => `
        <tr>
          <td style="color:#9ca3af; font-size:12px;">${new Date(item.timestamp || Date.now()).toLocaleTimeString('pt-BR')}</td>
          <td><strong style="color:#34d399;">@${escapeHtml(item.user)}</strong></td>
          <td><span class="badge-tag badge-tag-green">${item.platform || 'tiktok'}</span></td>
          <td><span style="color:#34d399;">Seguindo</span></td>
        </tr>
      `).join('');
    }
  }

  // 3. Subs Drawer
  const subsBody = document.getElementById('drawerSubsTableBody');
  if (subsBody) {
    const list = stats.subList || [];
    if (list.length === 0) {
      subsBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#9ca3af;">Nenhum sub ou membro registrado nesta sessão.</td></tr>';
    } else {
      subsBody.innerHTML = list.map(item => `
        <tr>
          <td style="color:#9ca3af; font-size:12px;">${new Date(item.timestamp || Date.now()).toLocaleTimeString('pt-BR')}</td>
          <td><strong style="color:#c4b5fd;">@${escapeHtml(item.user)}</strong></td>
          <td><span class="badge-tag badge-tag-purple">${escapeHtml(item.type || 'Sub')}</span></td>
          <td><span class="badge-tag badge-tag-amber">${item.platform || 'twitch'}</span></td>
        </tr>
      `).join('');
    }
  }

  // 4. Donates Drawer
  const donatesBody = document.getElementById('drawerDonatesTableBody');
  if (donatesBody) {
    const list = stats.donateList || [];
    if (list.length === 0) {
      donatesBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#9ca3af;">Nenhum donate registrado nesta sessão.</td></tr>';
    } else {
      donatesBody.innerHTML = list.map(item => `
        <tr>
          <td style="color:#9ca3af; font-size:12px;">${new Date(item.timestamp || Date.now()).toLocaleTimeString('pt-BR')}</td>
          <td><strong style="color:#fde047;">@${escapeHtml(item.user)}</strong></td>
          <td><span style="color:#22c55e; font-weight:800;">${item.currency || 'R$'} ${item.amount}</span></td>
          <td style="color:#f3f4f6;">${escapeHtml(item.message || '-')}</td>
          <td><span class="badge-tag badge-tag-amber">${item.platform || 'superchat'}</span></td>
        </tr>
      `).join('');
    }
  }
}

// --- Mini Rankings on Dashboard ---
let currentMiniRank = 'gifts';

function switchMiniRank(type) {
  currentMiniRank = type;
  const bGifts = document.getElementById('rankBtnGifts');
  const bLikes = document.getElementById('rankBtnLikes');
  const bBeans = document.getElementById('rankBtnBeans');
  if (bGifts) bGifts.classList.toggle('active', type === 'gifts');
  if (bLikes) bLikes.classList.toggle('active', type === 'likes');
  if (bBeans) bBeans.classList.toggle('active', type === 'beans');
  loadMiniRankings();
}

async function loadMiniRankings() {
  const container = document.getElementById('miniRankingsList');
  if (!container) return;

  let url = '/api/leaderboard/gifts';
  let prefix = '💎 ';
  let valKey = 'diamonds';

  if (currentMiniRank === 'likes') {
    url = '/api/leaderboard/likes';
    prefix = '❤️ ';
    valKey = 'likes';
  } else if (currentMiniRank === 'beans') {
    url = '/api/leaderboard/points';
    prefix = '☕ ';
    valKey = 'beans';
  }

  try {
    const res = await fetch(url);
    const list = await res.json();
    if (!list || list.length === 0) {
      container.innerHTML = '<div style="font-size:12px; color:#9ca3af; text-align:center; padding:10px 0;">Aguardando dados...</div>';
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    container.innerHTML = list.slice(0, 5).map((item, idx) => {
      const val = item[valKey] !== undefined ? item[valKey] : (item.points || item.value || 0);
      const medal = idx < 3 ? medals[idx] : `#${idx + 1}`;
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 8px; border-radius:6px; background:rgba(255,255,255,0.03); font-size:12px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span>${medal}</span>
            <strong style="color:#fff;">@${escapeHtml(item.user)}</strong>
          </div>
          <span style="color:#fbbf24; font-weight:700;">${prefix}${val.toLocaleString('pt-BR')}</span>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
  }
}

// --- Live Simulators for Testing ---
function simulateFollow(user = 'ViewerNovo', platform = 'tiktok') {
  fetch('/api/simulate/follow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, platform })
  });
}

function simulateSub(user = 'FãClubista', subType = 'fan_club', platform = 'tiktok') {
  fetch('/api/simulate/sub', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, subType, platform })
  });
}

function simulateDonate(user = 'SuperApoiador', amount = 20, currency = 'BRL') {
  fetch('/api/simulate/donate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, amount, currency, message: 'Valeu pelo conteúdo!' })
  });
}

// ==========================================
// 🎬 CLIPS & TIMESTAMPS CONTROLLER
// ==========================================
let activeHotkey = 'c';
let allClips = [];
let lastMarkedClipId = null;

function setupClipsAndHotkeys() {
  // Listen for global hotkey
  window.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    const isTyping = activeEl && (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) || activeEl.isContentEditable);
    if (isTyping) return;

    const pressed = e.key.toLowerCase();
    if (pressed === activeHotkey.toLowerCase() || (activeHotkey === ' ' && e.code === 'Space')) {
      e.preventDefault();
      markClipNow();
    }
  });

  // Start real-time timers for the clip tab
  setInterval(updateClipClock, 1000);
  updateClipClock();
}

function updateClipClock() {
  const timerEl = document.getElementById('clipLiveTimer');
  const realEl = document.getElementById('clipRealClock');
  if (!timerEl || !realEl) return;

  const now = new Date();
  realEl.textContent = `Relógio: ${now.toLocaleTimeString('pt-BR')}`;

  const uptimeText = document.getElementById('statUptime') ? document.getElementById('statUptime').textContent : '0s';
  timerEl.textContent = formatUptimeToTimecode(uptimeText);
}

function formatUptimeToTimecode(uptimeStr) {
  if (!uptimeStr) return '00:00:00';
  let hours = 0, mins = 0, secs = 0;
  const hMatch = uptimeStr.match(/(\d+)h/);
  const mMatch = uptimeStr.match(/(\d+)m/);
  const sMatch = uptimeStr.match(/(\d+)s/);
  if (hMatch) hours = parseInt(hMatch[1], 10);
  if (mMatch) mins = parseInt(mMatch[1], 10);
  if (sMatch) secs = parseInt(sMatch[1], 10);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function changeClipHotkey(newKey) {
  activeHotkey = newKey;
  const kbd = document.getElementById('displayHotkey');
  if (kbd) {
    kbd.textContent = newKey === ' ' ? 'ESPAÇO' : newKey.toUpperCase();
  }
  const badge = document.querySelector('.hotkey-badge');
  if (badge) {
    badge.textContent = `Tecla ${newKey === ' ' ? 'Espaço' : newKey.toUpperCase()}`;
  }
  showToast(`Atalho de clipes alterado para: [${newKey === ' ' ? 'Espaço' : newKey.toUpperCase()}]`);
}

function markClipNow() {
  const timerEl = document.getElementById('clipLiveTimer');
  const currentTs = timerEl ? timerEl.textContent : '00:00:00';

  // Play sound effect
  try {
    if (window.SoundFX && typeof window.SoundFX.playCoinSound === 'function') {
      window.SoundFX.playCoinSound();
    }
  } catch (e) {}

  fetch('/api/clips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timestampFormatted: currentTs,
      title: 'Momento Marcado na Live',
      category: 'epic'
    })
  })
  .then(r => r.json())
  .then(res => {
    if (res.success && res.clip) {
      lastMarkedClipId = res.clip.id;
      showToast(`🎯 Clipe Marcado aos [${res.clip.timestampFormatted}]!`);

      // Show quick note box
      const recentBox = document.getElementById('clipRecentBox');
      const tsSpan = document.getElementById('recentClipTs');
      const titleInput = document.getElementById('recentClipTitle');
      if (recentBox && tsSpan && titleInput) {
        recentBox.style.display = 'block';
        tsSpan.textContent = res.clip.timestampFormatted;
        titleInput.value = '';
        titleInput.focus();
      }

      loadClips();
    }
  })
  .catch(console.error);
}

function saveRecentClipNote() {
  if (!lastMarkedClipId) return hideRecentClipBox();
  const title = document.getElementById('recentClipTitle').value.trim() || 'Momento Marcado';
  const category = document.getElementById('recentClipCat').value;

  fetch(`/api/clips/${lastMarkedClipId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, category })
  })
  .then(r => r.json())
  .then(() => {
    showToast('Nota do clipe salva!');
    hideRecentClipBox();
    loadClips();
  })
  .catch(console.error);
}

function hideRecentClipBox() {
  const box = document.getElementById('clipRecentBox');
  if (box) box.style.display = 'none';
  lastMarkedClipId = null;
}

function loadClips() {
  fetch('/api/clips')
    .then(r => r.json())
    .then(clips => {
      allClips = clips || [];
      renderClips(allClips);
    })
    .catch(console.error);
}

function renderClips(clips) {
  const container = document.getElementById('clipsListContainer');
  const emptyState = document.getElementById('clipsEmptyState');
  const countLabel = document.getElementById('clipsCountLabel');
  if (!container) return;

  if (countLabel) countLabel.textContent = clips.length;

  if (!clips || clips.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    container.innerHTML = '';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  const catNames = {
    epic: '🎮 Jogada Épica',
    funny: '😂 Engraçado',
    goal: '🏆 Meta Batida',
    gift: '🎁 Presente Top',
    fail: '💥 Fail / Susto',
    chat: '💬 Momento Chat',
    other: '⭐ Geral'
  };

  container.innerHTML = clips.map(clip => `
    <div class="clip-item-card" id="clip-${clip.id}">
      <span class="clip-time-pill">${clip.timestampFormatted}</span>
      <span class="clip-cat-badge clip-cat-${clip.category || 'other'}">${catNames[clip.category] || '⭐ Geral'}</span>
      <div class="clip-info-col">
        <div class="clip-title-text" title="${escapeHtml(clip.title)}">${escapeHtml(clip.title)}</div>
        <div class="clip-realtime-sub">Gravado às ${clip.realTime} | ID: ${clip.id.substring(0, 14)}</div>
      </div>
      <div class="clip-actions-col">
        <button class="btn btn-secondary btn-sm" style="font-size:11px; padding:4px 8px;" onclick="copyClipTimestamp('${clip.timestampFormatted}')" title="Copiar Timestamp">📋 Tempo</button>
        <button class="btn btn-secondary btn-sm" style="font-size:11px; padding:4px 8px;" onclick="copyClipYouTube('${clip.timestampFormatted}', '${escapeHtml(clip.title)}')" title="Copiar Formato YouTube">📺 YT</button>
        <button class="btn btn-secondary btn-sm" style="font-size:11px; padding:4px 8px;" onclick="editClipPrompt('${clip.id}', '${escapeHtml(clip.title)}')">✏️</button>
        <button class="btn btn-danger btn-sm" style="font-size:11px; padding:4px 8px;" onclick="deleteClip('${clip.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

function copyClipTimestamp(ts) {
  navigator.clipboard.writeText(ts);
  showToast(`Timestamp [${ts}] copiado para a área de transferência!`);
}

function copyClipYouTube(ts, title) {
  const line = `${ts} - ${title}`;
  navigator.clipboard.writeText(line);
  showToast(`Formatado para YouTube: "${line}" copiado!`);
}

function copyAllClips() {
  if (!allClips || allClips.length === 0) return alert('Nenhum clipe para copiar.');
  const text = allClips.map(c => `${c.timestampFormatted} - ${c.title}`).reverse().join('\n');
  navigator.clipboard.writeText(text);
  showToast('Todos os clipes copiados no formato de lista!');
}

function exportClipsYouTube() {
  if (!allClips || allClips.length === 0) return alert('Nenhum clipe para exportar.');
  let content = "00:00:00 - Início da Transmissão\n";
  content += allClips.slice().reverse().map(c => `${c.timestampFormatted} - ${c.title}`).join('\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `youtube_chapters_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Arquivo de capítulos do YouTube baixado com sucesso!');
}

function exportClipsCSV() {
  if (!allClips || allClips.length === 0) return alert('Nenhum clipe para exportar.');
  let csv = "Timestamp,Horario_Real,Categoria,Titulo,Notas\n";
  allClips.slice().reverse().forEach(c => {
    csv += `"${c.timestampFormatted}","${c.realTime}","${c.category}","${(c.title || '').replace(/"/g, '""')}","${(c.notes || '').replace(/"/g, '""')}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clipes_live_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Planilha CSV de clipes baixada com sucesso!');
}

function editClipPrompt(id, currentTitle) {
  const newTitle = prompt('Editar título do clipe:', currentTitle);
  if (newTitle !== null) {
    fetch(`/api/clips/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim() || 'Momento Marcado' })
    })
    .then(r => r.json())
    .then(() => {
      showToast('Título atualizado!');
      loadClips();
    });
  }
}

function deleteClip(id) {
  if (!confirm('Deseja excluir esta marcação de clipe?')) return;
  fetch(`/api/clips/${id}`, { method: 'DELETE' })
    .then(r => r.json())
    .then(() => {
      showToast('Clipe removido.');
      loadClips();
    });
}

function clearAllClips() {
  if (!confirm('Deseja limpar todos os clipes registrados desta sessão?')) return;
  fetch('/api/clips', { method: 'DELETE' })
    .then(r => r.json())
    .then(() => {
      showToast('Todos os clipes foram removidos.');
      loadClips();
    });
}


// ==========================================
// 📜 LIVE SESSIONS & AUDIT CONTROLLER
// ==========================================
let allLiveSessions = [];

function switchHistorySubTab(subId) {
  document.querySelectorAll('.history-subnav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.sub === subId);
  });
  document.querySelectorAll('.history-subpane').forEach(p => {
    p.style.display = p.id === `sub-${subId}` ? 'block' : 'none';
  });

  if (subId === 'hist-lives') loadLiveSessions();
  else if (subId === 'hist-audit') loadAuditLogs();
  else if (subId === 'hist-rewards') loadRewardLogs();
  else if (subId === 'hist-snapshot') loadSnapshotConfig();
}

function loadLiveSessions() {
  fetch('/api/history/sessions')
    .then(r => r.json())
    .then(sessions => {
      allLiveSessions = sessions || [];
      renderLiveSessions(allLiveSessions);
    })
    .catch(console.error);
}

function renderLiveSessions(sessions) {
  const container = document.getElementById('liveSessionsContainer');
  if (!container) return;

  if (!sessions || sessions.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:40px; color:var(--text-dim);">
        <div style="font-size:36px; margin-bottom:10px;">📺</div>
        <div style="font-size:15px; color:var(--text-muted);">Nenhuma transmissão salva no histórico ainda</div>
        <div style="font-size:13px; margin-top:4px;">Ao encerrar a live, clique em "Encerrar & Salvar Live Atual" para registrar a sessão aqui.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = sessions.map(s => {
    const topGiver = (s.topGivers && s.topGivers[0]) ? `@${s.topGivers[0].user} (${s.topGivers[0].value} 💎)` : 'Nenhum';
    const topLiker = (s.topLikers && s.topLikers[0]) ? `@${s.topLikers[0].user} (${s.topLikers[0].likes})` : 'Nenhum';

    const giftRows = (s.giftList || []).slice(0, 6).map(g => `
      <div style="display:flex; justify-content:space-between; font-size:12px; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
        <span>@${escapeHtml(g.user)}: ${escapeHtml(g.giftName)} x${g.count}</span>
        <span style="color:#fbbf24; font-weight:700;">${g.diamonds} 💎</span>
      </div>
    `).join('') || '<div style="font-size:12px; color:var(--text-dim);">Nenhum presente registrado</div>';

    const subRows = (s.subList || []).slice(0, 5).map(sub => `
      <div style="display:flex; justify-content:space-between; font-size:12px; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
        <span>⭐ @${escapeHtml(sub.user)}</span>
        <span style="color:#c084fc; text-transform:uppercase; font-size:10px;">${sub.type} (${sub.platform})</span>
      </div>
    `).join('') || '<div style="font-size:12px; color:var(--text-dim);">Nenhuma nova inscrição</div>';

    const donateRows = (s.donateList || []).slice(0, 5).map(d => `
      <div style="display:flex; justify-content:space-between; font-size:12px; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
        <span>💰 @${escapeHtml(d.user)}</span>
        <span style="color:#34d399; font-weight:700;">${d.amount}</span>
      </div>
    `).join('') || '<div style="font-size:12px; color:var(--text-dim);">Nenhum donate direto</div>';

    return `
      <div class="live-session-item" id="sessionItem-${s.id}">
        <div class="session-row-header" onclick="toggleSessionDetails('${s.id}')">
          <div class="session-title-box">
            <span class="session-status-badge">FINALIZADA</span>
            <div>
              <div class="session-name">${escapeHtml(s.title)}</div>
              <div class="session-date-sub">📅 ${s.date} | ⏱️ Duração: <strong>${s.duration}</strong></div>
            </div>
          </div>

          <div class="session-metrics-badges">
            <span class="metric-pill" title="Pico de espectadores">👥 <strong>${(s.peakViewers || 0).toLocaleString('pt-BR')}</strong></span>
            <span class="metric-pill" title="Total de likes">❤️ <strong>${(s.totalLikes || 0).toLocaleString('pt-BR')}</strong></span>
            <span class="metric-pill" title="Presentes">🎁 <strong>${s.totalGifts || 0} (${(s.totalGiftValue || 0)} 💎)</strong></span>
            <span class="metric-pill" title="Cafés servidos">☕ <strong>${s.coffeesPoured || 0}</strong></span>
            <span class="metric-pill" title="Mensagens do chat">💬 <strong>${(s.totalMessages || 0).toLocaleString('pt-BR')}</strong></span>
            <span class="metric-pill" title="Clipes marcados">🎬 <strong>${s.clipsCount || 0}</strong></span>
          </div>

          <div style="display:flex; align-items:center; gap:8px;">
            <button class="session-expand-btn" id="btnExp-${s.id}" onclick="event.stopPropagation(); toggleSessionDetails('${s.id}')">
              ▼ Detalhes
            </button>
            <button class="btn btn-danger btn-sm" style="padding:6px 10px;" onclick="event.stopPropagation(); deleteLiveSession('${s.id}')" title="Excluir Registro">
              🗑️
            </button>
          </div>
        </div>

        <!-- Expanded Details Panel -->
        <div class="session-detail-panel" id="sessionPanel-${s.id}">
          <div class="session-grid-details">
            <!-- 1. Top Apoiadores -->
            <div class="session-card-box">
              <div class="session-card-title">🥇 Top Apoiadores da Sessão</div>
              <div style="font-size:12px; margin-bottom:6px;"><strong>Maior Presenteador:</strong> ${topGiver}</div>
              <div style="font-size:12px; margin-bottom:8px;"><strong>Maior nos Likes:</strong> ${topLiker}</div>
              <div style="font-size:12px; color:var(--text-dim);">Chatters Únicos: <strong>${s.uniqueChatters || 0}</strong> | Comandos Executados: <strong>${s.totalCommands || 0}</strong></div>
            </div>

            <!-- 2. Presentes Recebidos -->
            <div class="session-card-box">
              <div class="session-card-title">🎁 Presentes (${(s.giftList || []).length})</div>
              ${giftRows}
            </div>

            <!-- 3. Subs & Inscrições -->
            <div class="session-card-box">
              <div class="session-card-title">⭐ Inscrições & Membros (${(s.subList || []).length})</div>
              ${subRows}
            </div>

            <!-- 4. Donates & Apoios -->
            <div class="session-card-box">
              <div class="session-card-title">💰 Donates & Super Chats (${(s.donateList || []).length})</div>
              ${donateRows}
            </div>
          </div>

          ${s.notes ? `
            <div style="margin-top:14px; padding:10px 14px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.06); font-size:13px;">
              <strong style="color:#fbbf24;">📝 Notas da Live:</strong> ${escapeHtml(s.notes)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function toggleSessionDetails(id) {
  const panel = document.getElementById(`sessionPanel-${id}`);
  const btn = document.getElementById(`btnExp-${id}`);
  if (!panel) return;
  const isOpen = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  if (btn) btn.textContent = isOpen ? '▼ Detalhes' : '▲ Fechar';
}

function openArchiveLiveModal() {
  const modal = document.getElementById('archiveLiveModal');
  const now = new Date();
  const dateFormatted = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  document.getElementById('archiveLiveTitle').value = `Live de ${dateFormatted} - Transmissão Especial`;
  document.getElementById('archiveLiveNotes').value = '';
  if (modal) modal.style.display = 'flex';
}

function closeArchiveLiveModal() {
  const modal = document.getElementById('archiveLiveModal');
  if (modal) modal.style.display = 'none';
}

function confirmArchiveLive() {
  const title = document.getElementById('archiveLiveTitle').value.trim();
  const notes = document.getElementById('archiveLiveNotes').value.trim();
  const shouldReset = document.getElementById('archiveResetSession').checked;

  fetch('/api/history/sessions/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, notes })
  })
  .then(r => r.json())
  .then(res => {
    closeArchiveLiveModal();
    showToast('🎉 Live arquivada no histórico com sucesso!');
    loadLiveSessions();

    if (shouldReset) {
      resetSessionStats();
    }
  })
  .catch(console.error);
}

function deleteLiveSession(id) {
  if (!confirm('Deseja excluir esta live do histórico?')) return;
  fetch(`/api/history/sessions/${id}`, { method: 'DELETE' })
    .then(r => r.json())
    .then(() => {
      showToast('Registro de live excluído.');
      loadLiveSessions();
    })
    .catch(console.error);
}


// ==========================================
// 📝 AUDIT & REWARD LOGS CONTROLLER
// ==========================================
function loadAuditLogs(category = 'all') {
  fetch(`/api/history/audit?category=${category}`)
    .then(r => r.json())
    .then(logs => {
      renderAuditLogs(logs || []);
    })
    .catch(console.error);
}

function renderAuditLogs(logs) {
  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;

  if (!logs || logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-dim);">Nenhum log de alteração registrado.</td></tr>`;
    return;
  }

  const catBadges = {
    config: '<span class="badge" style="background:rgba(217,119,6,0.2); color:#fbbf24; border:1px solid #d97706;">Configuração</span>',
    command: '<span class="badge" style="background:rgba(59,130,246,0.2); color:#60a5fa; border:1px solid #3b82f6;">Comando</span>',
    timer: '<span class="badge" style="background:rgba(168,85,247,0.2); color:#c084fc; border:1px solid #a855f7;">Timer</span>',
    reward: '<span class="badge" style="background:rgba(16,185,129,0.2); color:#34d399; border:1px solid #10b981;">Premiação</span>'
  };

  tbody.innerHTML = logs.map(l => {
    const d = new Date(l.timestamp);
    const timeStr = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR')}`;
    return `
      <tr>
        <td style="font-size:12px; color:var(--text-muted); font-family:monospace;">${timeStr}</td>
        <td>${catBadges[l.category] || '<span class="badge">Geral</span>'}</td>
        <td style="font-weight:700; color:#fff;">${escapeHtml(l.action)}</td>
        <td style="font-size:13px; color:#e5e7eb;">${escapeHtml(l.details)}</td>
        <td style="font-size:12px; color:var(--text-dim);">${escapeHtml(l.author || 'Painel')}</td>
      </tr>
    `;
  }).join('');
}

function clearAuditLogs() {
  if (!confirm('Deseja limpar todos os registros do log de auditoria?')) return;
  fetch('/api/history/audit', { method: 'DELETE' })
    .then(r => r.json())
    .then(() => {
      showToast('Logs de auditoria limpos.');
      loadAuditLogs();
    });
}

function loadRewardLogs() {
  fetch('/api/history/audit?category=reward')
    .then(r => r.json())
    .then(rewards => {
      renderRewardLogs(rewards || []);
    })
    .catch(console.error);
}

function renderRewardLogs(rewards) {
  const tbody = document.getElementById('rewardsTableBody');
  if (!tbody) return;

  if (!rewards || rewards.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-dim);">Nenhuma premiação concedida registrada ainda.</td></tr>`;
    return;
  }

  tbody.innerHTML = rewards.map(r => {
    const d = new Date(r.timestamp);
    const timeStr = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR')}`;
    return `
      <tr>
        <td style="font-size:12px; color:var(--text-muted); font-family:monospace;">${timeStr}</td>
        <td style="font-weight:700; color:#fbbf24;">🎁 ${escapeHtml(r.action)}</td>
        <td style="font-size:13px; color:#f3f4f6;">${escapeHtml(r.details)}</td>
        <td style="font-size:12px; color:var(--text-dim);">${escapeHtml(r.author || 'Sistema')}</td>
      </tr>
    `;
  }).join('');
}

function loadSnapshotConfig() {
  fetch('/api/settings')
    .then(r => r.json())
    .then(settings => {
      renderSnapshotConfig(settings || {});
    })
    .catch(console.error);
}

function renderSnapshotConfig(cfg) {
  const grid = document.getElementById('snapshotGrid');
  if (!grid) return;

  const cur = cfg.currency || {};
  const mg = cfg.minigames || {};
  const rlt = mg.roulette || {};
  const slt = mg.slots || {};
  const dul = mg.duel || {};
  const lGoal = cfg.likeGoal || {};
  const dGoal = cfg.donateGoal || {};

  grid.innerHTML = `
    <!-- Card Moeda -->
    <div class="session-card-box">
      <div class="session-card-title">☕ Moeda da Live: ${cur.name || 'Cafezinho'}</div>
      <div style="font-size:13px; line-height:1.7;">
        <div>Farming por Tempo: <strong>${cur.farmingEnabled ? 'Ativo' : 'Desativado'}</strong></div>
        <div>Recompensa por ciclo: <strong>+${cur.farmingAmount || 5} ${cur.plural || 'Cafezinhos'}</strong> a cada <strong>${cur.farmingIntervalMinutes || 2} min</strong></div>
        <div>Multiplicador Subs Twitch: <strong>${cur.subMultiplier || 1.5}x</strong></div>
        <div>Multiplicador TikTok Fã Clube: <strong>${cur.tiktokFanMultiplier || 1.5}x</strong></div>
        <div>Multiplicador YouTube Membros: <strong>${cur.youtubeMemberMultiplier || 1.5}x</strong></div>
        <div>Multiplicador VIPs/Mods: <strong>${cur.vipMultiplier || 1.2}x</strong></div>
      </div>
    </div>

    <!-- Card Mini-Games -->
    <div class="session-card-box">
      <div class="session-card-title">🎲 Regras dos Mini-Games</div>
      <div style="font-size:13px; line-height:1.7;">
        <div><strong>!roleta:</strong> Chance: ${rlt.winChance || 50}% | Mult: ${rlt.multiplier || 2}x | Cooldown: <strong>${rlt.cooldownMinutes || 5}min</strong></div>
        <div><strong>!slots:</strong> Chance: ${slt.winChancePercent || 40}% | Jackpot: ${slt.jackpotMultiplier || 5}x | Cooldown: <strong>${slt.cooldownMinutes || 5}min</strong></div>
        <div><strong>!duelo:</strong> Timeout: ${dul.timeoutSeconds || 60}s | Cooldown: <strong>${dul.cooldownMinutes || 5}min</strong></div>
        <div>Símbolos do Slot: <strong>🧀 🐍 ☕ 💎 ❤️</strong></div>
      </div>
    </div>

    <!-- Card Metas -->
    <div class="session-card-box">
      <div class="session-card-title">🎯 Metas Comunitárias</div>
      <div style="font-size:13px; line-height:1.7;">
        <div><strong>Meta de Likes:</strong> ${(lGoal.target || 10000).toLocaleString('pt-BR')} (Incremento: +${(lGoal.step || 5000).toLocaleString('pt-BR')})</div>
        <div>Chuva de Likes: <strong>+${lGoal.rewardAllActive || 25} Cafezinhos</strong></div>
        <div><strong>Meta de Presentes:</strong> ${dGoal.target || 10} presentes (Incremento: +${dGoal.step || 10})</div>
        <div>Chuva de Presentes: <strong>+${dGoal.rewardAllActive || 25} Cafezinhos</strong></div>
      </div>
    </div>

    <!-- Card Bot & Servidor -->
    <div class="session-card-box">
      <div class="session-card-title">🤖 Bot & Conexões</div>
      <div style="font-size:13px; line-height:1.7;">
        <div>Nome do Bot: <strong>${cfg.botName || 'Coffee Bot'}</strong></div>
        <div>Prefixo de Comandos: <strong>${cfg.prefix || '!'}</strong></div>
        <div>Porta Ativa: <strong>3334</strong></div>
        <div>Sons do Navegador: <strong>${cfg.soundEnabled !== false ? 'Ativos' : 'Desativados'}</strong></div>
      </div>
    </div>
  `;
}
