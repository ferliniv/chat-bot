const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

class StorageService {
  constructor() {
    this.ensureDirectory();
    this.commandsFile = path.join(DATA_DIR, 'commands.json');
    this.timersFile = path.join(DATA_DIR, 'timers.json');
    this.settingsFile = path.join(DATA_DIR, 'settings.json');
    this.pointsFile = path.join(DATA_DIR, 'points.json');
    this.statsFile = path.join(DATA_DIR, 'stats.json');
    this.auditLogFile = path.join(DATA_DIR, 'audit_log.json');
    this.liveSessionsFile = path.join(DATA_DIR, 'live_sessions.json');
    this.clipsFile = path.join(DATA_DIR, 'clips.json');

    this.commands = this.loadOrCreate(this.commandsFile, path.join(DATA_DIR, 'default_commands.json'), []);
    this.timers = this.loadOrCreate(this.timersFile, path.join(DATA_DIR, 'default_timers.json'), []);
    this.settings = this.loadOrCreate(this.settingsFile, path.join(DATA_DIR, 'default_settings.json'), {});
    this.auditLog = this.loadOrCreate(this.auditLogFile, null, [
      {
        id: 'log-seed-1',
        timestamp: Date.now() - 3600000 * 2,
        category: 'config',
        action: 'Atualização de Cooldowns',
        details: 'Cooldown dos mini-games (!roleta, !slots, !duelo) ajustado para 5 minutos por usuário',
        author: 'Painel Web'
      },
      {
        id: 'log-seed-2',
        timestamp: Date.now() - 3600000,
        category: 'config',
        action: 'Novos Multiplicadores',
        details: 'Configurado multiplicador de 1.5x para TikTok Fã Clube e YouTube Membros',
        author: 'Painel Web'
      },
      {
        id: 'log-seed-3',
        timestamp: Date.now() - 1800000,
        category: 'reward',
        action: 'Meta Batida: 10.000 Likes',
        details: 'Meta de 10.000 likes alcançada no TikTok! Chuva de 25 cafezinhos concedida a todos os espectadores ativos',
        author: 'Sistema Automático'
      }
    ]);
    this.liveSessions = this.loadOrCreate(this.liveSessionsFile, null, [
      {
        id: 'session-1728082800000',
        title: 'Live #12 - Gameplay & Conversa com Chat',
        date: '04/10/2026',
        startTime: Date.now() - 86400000 * 1 - 10800000,
        endTime: Date.now() - 86400000 * 1,
        duration: '3h 00m',
        peakViewers: 85,
        totalLikes: 14500,
        totalGifts: 18,
        totalGiftValue: 320,
        coffeesPoured: 42,
        totalMessages: 890,
        totalCommands: 145,
        uniqueChatters: 56,
        clipsCount: 3,
        notes: 'Meta de likes batida 2 vezes! Chuva de cafezinhos animou a comunidade.',
        topGivers: [
          { user: 'cafeinado_pro', value: 180 },
          { user: 'vinicius', value: 90 },
          { user: 'mod_master', value: 50 }
        ],
        topLikers: [
          { user: 'vinicius', likes: 6500 },
          { user: 'viewer_amigo', likes: 3200 },
          { user: 'cafeinado_pro', likes: 2100 }
        ],
        giftList: [
          { id: 'g1', user: 'cafeinado_pro', giftName: 'Café Quente ☕', count: 3, diamonds: 30, platform: 'tiktok', timestamp: Date.now() - 86400000 - 5000000 },
          { id: 'g2', user: 'vinicius', giftName: 'Rosa 🌹', count: 10, diamonds: 10, platform: 'tiktok', timestamp: Date.now() - 86400000 - 3000000 }
        ],
        subList: [
          { id: 's1', user: 'cafeinado_pro', type: 'fan_club', platform: 'tiktok', timestamp: Date.now() - 86400000 - 4000000 }
        ],
        donateList: [
          { id: 'd1', user: 'apoiador_top', amount: 'R$ 20,00', platform: 'youtube', timestamp: Date.now() - 86400000 - 2000000 }
        ],
        followList: [
          { id: 'f1', user: 'novo_viewer1', platform: 'tiktok', timestamp: Date.now() - 86400000 - 7000000 }
        ]
      },
      {
        id: 'session-1727996400000',
        title: 'Live #11 - Sexta dos Games & Cafezinhos',
        date: '03/10/2026',
        startTime: Date.now() - 86400000 * 2 - 9000000,
        endTime: Date.now() - 86400000 * 2,
        duration: '2h 30m',
        peakViewers: 64,
        totalLikes: 11200,
        totalGifts: 12,
        totalGiftValue: 210,
        coffeesPoured: 35,
        totalMessages: 680,
        totalCommands: 110,
        uniqueChatters: 42,
        clipsCount: 2,
        notes: 'Aquecimento do final de semana com mini-games.',
        topGivers: [
          { user: 'vinicius', value: 120 },
          { user: 'cafeinado_pro', value: 90 }
        ],
        topLikers: [
          { user: 'vinicius', likes: 5100 },
          { user: 'mod_master', likes: 2800 }
        ],
        giftList: [
          { id: 'g3', user: 'vinicius', giftName: 'Rosa 🌹', count: 10, diamonds: 10, platform: 'tiktok', timestamp: Date.now() - 86400000 * 2 - 3000000 }
        ],
        subList: [
          { id: 's2', user: 'vip_fiel', type: 'sub', platform: 'twitch', timestamp: Date.now() - 86400000 * 2 - 4000000 }
        ],
        donateList: [
          { id: 'd2', user: 'anonimo', amount: 'R$ 10,00', platform: 'youtube', timestamp: Date.now() - 86400000 * 2 - 2000000 }
        ],
        followList: [
          { id: 'f2', user: 'gamer_br', platform: 'tiktok', timestamp: Date.now() - 86400000 * 2 - 6000000 }
        ]
      }
    ]);
    this.clips = this.loadOrCreate(this.clipsFile, null, [
      {
        id: 'clip-seed-1',
        timestampFormatted: '00:41:40',
        timestampSeconds: 2500,
        realTime: '19:41:40',
        title: 'Vitória épica no clutch final!',
        category: 'epic',
        notes: 'Último segundo com 1 de HP e reação do chat!',
        createdAt: Date.now() - 86400000
      },
      {
        id: 'clip-seed-2',
        timestampFormatted: '01:15:20',
        timestampSeconds: 4520,
        realTime: '20:15:20',
        title: 'Chuva de cafezinhos bateu na meta de likes',
        category: 'goal',
        notes: 'Comemoração dos 10k likes ao vivo',
        createdAt: Date.now() - 86400000
      }
    ]);
    this.points = this.loadOrCreate(this.pointsFile, null, {
      "vinicius": 150,
      "cafeinado_pro": 280,
      "mod_master": 95,
      "viewer_amigo": 45
    });
    this.stats = this.loadOrCreate(this.statsFile, null, {
      totalMessages: 0,
      totalCommands: 0,
      coffeesPoured: 17,
      totalLikes: 10100,
      peakViewers: 0,
      currentViewers: { total: 0, tiktok: 0, youtube: 0, twitch: 0 },
      totalGifts: 0,
      totalGiftValue: 0,
      uniqueChatters: [],
      recentEvents: [],
      historyTimeline: [],
      giftList: [],
      followList: [],
      subList: [],
      donateList: [],
      userLikes: {
        "vinicius": 10000,
        "viewerfiel": 100
      },
      userGifts: {
        "doadormaster": 10
      },
      startedAt: Date.now()
    });

    this.ensureDefaults();
  }

  ensureDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  ensureDefaults() {
    // Ensure currency settings
    if (!this.settings.currency) {
      this.settings.currency = {
        name: 'Cafezinho',
        plural: 'Cafezinhos',
        farmingEnabled: true,
        farmingIntervalMinutes: 2,
        farmingAmount: 5,
        subMultiplier: 1.5,
        tiktokFanMultiplier: 1.5,
        youtubeMemberMultiplier: 1.5,
        vipMultiplier: 1.2,
        coffeeReward: 10
      };
    } else {
      if (this.settings.currency.tiktokFanMultiplier === undefined) this.settings.currency.tiktokFanMultiplier = 1.5;
      if (this.settings.currency.youtubeMemberMultiplier === undefined) this.settings.currency.youtubeMemberMultiplier = 1.5;
    }

    // Ensure minigames settings
    if (!this.settings.minigames) {
      this.settings.minigames = {
        roulette: { winChance: 50, multiplier: 2.0, minBet: 1, maxBet: 10000, cooldownMinutes: 5 },
        slots: { winChancePercent: 40, jackpotMultiplier: 5.0, pairMultiplier: 1.5, minBet: 5, maxBet: 5000, cooldownMinutes: 5 },
        duel: { timeoutSeconds: 60, minBet: 5, maxBet: 20000, houseFeePercent: 0, cooldownMinutes: 5 }
      };
    }

    // Ensure likeGoal settings
    if (!this.settings.likeGoal) {
      this.settings.likeGoal = {
        current: 0,
        target: 10000,
        step: 5000,
        autoIncrement: true,
        milestoneAlert: true,
        rewardAllActive: 25
      };
    }

    // Ensure donateGoal settings
    if (!this.settings.donateGoal) {
      this.settings.donateGoal = {
        current: 0,
        target: 10,
        step: 10,
        autoIncrement: true,
        milestoneAlert: true,
        rewardAllActive: 25,
        title: 'Meta de Presentes 🎁'
      };
    } else {
      if (this.settings.donateGoal.step === undefined) this.settings.donateGoal.step = 10;
      if (this.settings.donateGoal.rewardAllActive === undefined) this.settings.donateGoal.rewardAllActive = 25;
      if (this.settings.donateGoal.autoIncrement === undefined) this.settings.donateGoal.autoIncrement = true;
    }

    // Ensure stats lists
    if (this.stats.totalLikes === undefined) this.stats.totalLikes = 0;
    if (this.stats.peakViewers === undefined) this.stats.peakViewers = 0;
    if (!this.stats.currentViewers) this.stats.currentViewers = { total: 0, tiktok: 0, youtube: 0, twitch: 0 };
    if (this.stats.totalGifts === undefined) this.stats.totalGifts = 0;
    if (this.stats.totalGiftValue === undefined) this.stats.totalGiftValue = 0;
    if (!Array.isArray(this.stats.uniqueChatters)) this.stats.uniqueChatters = [];
    if (!Array.isArray(this.stats.recentEvents)) this.stats.recentEvents = [];
    if (!Array.isArray(this.stats.historyTimeline)) this.stats.historyTimeline = [];
    if (!Array.isArray(this.stats.giftList)) this.stats.giftList = [];
    if (!Array.isArray(this.stats.followList)) this.stats.followList = [];
    if (!Array.isArray(this.stats.subList)) this.stats.subList = [];
    if (!Array.isArray(this.stats.donateList)) this.stats.donateList = [];
    if (!this.stats.userLikes) this.stats.userLikes = {};
    if (!this.stats.userGifts) this.stats.userGifts = {};
    if (!this.stats.startedAt) this.stats.startedAt = Date.now();

    this.saveSettings();
    this.saveStats();
  }

  loadOrCreate(filePath, defaultTemplatePath, fallback) {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
      if (defaultTemplatePath && fs.existsSync(defaultTemplatePath)) {
        const data = JSON.parse(fs.readFileSync(defaultTemplatePath, 'utf8'));
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return data;
      }
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf8');
      return fallback;
    } catch (err) {
      console.error(`Erro ao carregar/criar ${filePath}:`, err);
      return fallback;
    }
  }

  saveCommands() {
    fs.writeFileSync(this.commandsFile, JSON.stringify(this.commands, null, 2), 'utf8');
  }

  saveTimers() {
    fs.writeFileSync(this.timersFile, JSON.stringify(this.timers, null, 2), 'utf8');
  }

  saveSettings() {
    fs.writeFileSync(this.settingsFile, JSON.stringify(this.settings, null, 2), 'utf8');
  }

  savePoints() {
    fs.writeFileSync(this.pointsFile, JSON.stringify(this.points, null, 2), 'utf8');
  }

  saveStats() {
    fs.writeFileSync(this.statsFile, JSON.stringify(this.stats, null, 2), 'utf8');
  }

  saveAuditLog() {
    fs.writeFileSync(this.auditLogFile, JSON.stringify(this.auditLog, null, 2), 'utf8');
  }

  saveLiveSessions() {
    fs.writeFileSync(this.liveSessionsFile, JSON.stringify(this.liveSessions, null, 2), 'utf8');
  }

  saveClips() {
    fs.writeFileSync(this.clipsFile, JSON.stringify(this.clips, null, 2), 'utf8');
  }

  // --- Helpers for Points & Economy (Cafezinhos) ---
  getUserPoints(username) {
    const key = (username || '').toLowerCase().replace('@', '').trim();
    return this.points[key] || 0;
  }

  addPoints(username, amount) {
    const key = (username || '').toLowerCase().replace('@', '').trim();
    if (!key) return 0;
    this.points[key] = (this.points[key] || 0) + amount;
    if (this.points[key] < 0) this.points[key] = 0;
    this.savePoints();
    return this.points[key];
  }

  getTopPoints(limit = 10) {
    return Object.entries(this.points)
      .map(([user, beans]) => ({ user, beans }))
      .sort((a, b) => b.beans - a.beans)
      .slice(0, limit);
  }

  getTopLikes(limit = 10) {
    if (!this.stats.userLikes) this.stats.userLikes = {};
    return Object.entries(this.stats.userLikes)
      .map(([user, likes]) => ({ user, likes }))
      .sort((a, b) => b.likes - a.likes)
      .slice(0, limit);
  }

  getTopGifts(limit = 10) {
    if (!this.stats.userGifts) this.stats.userGifts = {};
    return Object.entries(this.stats.userGifts)
      .map(([user, value]) => ({ user, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  // --- Helpers for Coffee Meter ---
  incrementCoffee(amount = 1) {
    this.settings.coffeeMeter.current += amount;
    this.stats.coffeesPoured += amount;
    this.saveSettings();
    this.saveStats();
    return this.settings.coffeeMeter;
  }

  setCoffeeMeter(current, target) {
    if (typeof current === 'number') this.settings.coffeeMeter.current = current;
    if (typeof target === 'number') this.settings.coffeeMeter.target = target;
    this.saveSettings();
    return this.settings.coffeeMeter;
  }

  // --- Helpers for Likes & Live Health ---
  addLikes(count = 1, username = 'Espectador') {
    const qty = Math.max(1, Number(count) || 1);
    this.stats.totalLikes += qty;
    if (this.settings.likeGoal) {
      this.settings.likeGoal.current = this.stats.totalLikes;
    }

    if (username && username !== 'Espectador') {
      const cleanUser = username.toLowerCase().replace('@', '').trim();
      if (!this.stats.userLikes) this.stats.userLikes = {};
      this.stats.userLikes[cleanUser] = (this.stats.userLikes[cleanUser] || 0) + qty;
    }

    this.saveStats();
    this.saveSettings();
    return this.stats.totalLikes;
  }

  addGift(username, giftName, count = 1, diamondValue = 1, platform = 'tiktok') {
    const qty = Math.max(1, Number(count) || 1);
    const diamonds = Math.max(1, Number(diamondValue) || 1) * qty;

    this.stats.totalGifts = (this.stats.totalGifts || 0) + qty;
    this.stats.totalGiftValue = (this.stats.totalGiftValue || 0) + diamonds;

    if (this.settings.donateGoal) {
      this.settings.donateGoal.current = (this.settings.donateGoal.current || 0) + qty;
    }

    const cleanUser = (username || 'Espectador').toLowerCase().replace('@', '').trim();
    if (!this.stats.userGifts) this.stats.userGifts = {};
    this.stats.userGifts[cleanUser] = (this.stats.userGifts[cleanUser] || 0) + diamonds;

    // Detailed gift item
    const giftItem = {
      id: `gift-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      user: username.replace('@', ''),
      giftName,
      count: qty,
      diamonds,
      platform,
      timestamp: Date.now()
    };

    if (!Array.isArray(this.stats.giftList)) this.stats.giftList = [];
    this.stats.giftList.unshift(giftItem);
    if (this.stats.giftList.length > 100) this.stats.giftList.length = 100;

    this.logEvent({
      type: 'gift',
      title: '🎁 Presente Recebido',
      description: `${username} enviou ${giftName} x${qty} (${diamonds} 💎)`,
      platform,
      timestamp: Date.now()
    });

    this.saveStats();
    this.saveSettings();
    return {
      totalGifts: this.stats.totalGifts,
      totalValue: this.stats.totalGiftValue,
      item: giftItem
    };
  }

  addFollow(username, platform = 'tiktok') {
    const followItem = {
      id: `flw-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      user: username.replace('@', ''),
      platform,
      timestamp: Date.now()
    };
    if (!Array.isArray(this.stats.followList)) this.stats.followList = [];
    this.stats.followList.unshift(followItem);
    if (this.stats.followList.length > 100) this.stats.followList.length = 100;

    this.logEvent({
      type: 'follow',
      title: '🌟 Novo Seguidor',
      description: `@${username} começou a seguir a transmissão!`,
      platform,
      timestamp: Date.now()
    });

    this.saveStats();
    return followItem;
  }

  addSub(username, type = 'sub', platform = 'twitch') {
    const subItem = {
      id: `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      user: username.replace('@', ''),
      type, // 'sub' (Twitch), 'member' (YouTube), 'fan_club' (TikTok)
      platform,
      timestamp: Date.now()
    };
    if (!Array.isArray(this.stats.subList)) this.stats.subList = [];
    this.stats.subList.unshift(subItem);
    if (this.stats.subList.length > 100) this.stats.subList.length = 100;

    let title = '⭐ Novo Inscrito';
    if (type === 'fan_club') title = '⭐ Entrou no Fã Clube (TikTok)';
    else if (type === 'member') title = '⭐ Novo Membro (YouTube)';

    this.logEvent({
      type: 'sub',
      title,
      description: `@${username} apoiou como ${type.toUpperCase()}!`,
      platform,
      timestamp: Date.now()
    });

    this.saveStats();
    return subItem;
  }

  addDonate(username, amount, platform = 'youtube') {
    const donateItem = {
      id: `dnt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      user: username.replace('@', ''),
      amount,
      platform,
      timestamp: Date.now()
    };
    if (!Array.isArray(this.stats.donateList)) this.stats.donateList = [];
    this.stats.donateList.unshift(donateItem);
    if (this.stats.donateList.length > 100) this.stats.donateList.length = 100;

    this.logEvent({
      type: 'donate',
      title: '💸 Doação / Super Chat',
      description: `@${username} enviou apoio de ${amount}!`,
      platform,
      timestamp: Date.now()
    });

    this.saveStats();
    return donateItem;
  }

  updateViewers(platform, count) {
    const qty = Math.max(0, Number(count) || 0);
    if (!this.stats.currentViewers) {
      this.stats.currentViewers = { total: 0, tiktok: 0, youtube: 0, twitch: 0 };
    }
    this.stats.currentViewers[platform] = qty;
    this.stats.currentViewers.total =
      (this.stats.currentViewers.tiktok || 0) +
      (this.stats.currentViewers.youtube || 0) +
      (this.stats.currentViewers.twitch || 0);

    if (this.stats.currentViewers.total > (this.stats.peakViewers || 0)) {
      this.stats.peakViewers = this.stats.currentViewers.total;
    }
    this.saveStats();
    return this.stats.currentViewers;
  }

  recordChatter(username) {
    if (!username) return;
    const clean = username.trim().toLowerCase();
    if (!this.stats.uniqueChatters.includes(clean)) {
      this.stats.uniqueChatters.push(clean);
      this.saveStats();
    }
  }

  logEvent(event) {
    if (!this.stats.recentEvents) this.stats.recentEvents = [];
    this.stats.recentEvents.unshift({
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      ...event
    });
    if (this.stats.recentEvents.length > 60) {
      this.stats.recentEvents.length = 60;
    }
    this.saveStats();
  }

  addHistorySnapshot() {
    if (!this.stats.historyTimeline) this.stats.historyTimeline = [];
    const now = new Date();
    const timeLabel = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    this.stats.historyTimeline.push({
      time: timeLabel,
      viewers: this.stats.currentViewers ? this.stats.currentViewers.total : 0,
      likes: this.stats.totalLikes || 0,
      messages: this.stats.totalMessages || 0,
      timestamp: Date.now()
    });

    if (this.stats.historyTimeline.length > 60) {
      this.stats.historyTimeline.shift();
    }
    this.saveStats();
  }

  resetLiveStats() {
    this.stats.totalMessages = 0;
    this.stats.totalCommands = 0;
    this.stats.coffeesPoured = 0;
    this.stats.totalLikes = 0;
    this.stats.peakViewers = 0;
    this.stats.currentViewers = { total: 0, tiktok: 0, youtube: 0, twitch: 0 };
    this.stats.totalGifts = 0;
    this.stats.totalGiftValue = 0;
    this.stats.uniqueChatters = [];
    this.stats.recentEvents = [];
    this.stats.historyTimeline = [];
    this.stats.giftList = [];
    this.stats.followList = [];
    this.stats.subList = [];
    this.stats.donateList = [];
    this.stats.userLikes = {};
    this.stats.userGifts = {};
    this.stats.startedAt = Date.now();

    if (this.settings.coffeeMeter) this.settings.coffeeMeter.current = 0;
    if (this.settings.likeGoal) this.settings.likeGoal.current = 0;
    if (this.settings.donateGoal) this.settings.donateGoal.current = 0;

    this.saveStats();
    this.saveSettings();
    return this.stats;
  }

  // --- Audit Log Methods ---
  logAudit({ category = 'config', action, details, author = 'Painel Web' }) {
    if (!Array.isArray(this.auditLog)) this.auditLog = [];
    const entry = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      category, // 'config' | 'reward' | 'command' | 'timer'
      action: action || 'Alteração',
      details: details || '',
      author: author || 'Painel Web'
    };
    this.auditLog.unshift(entry);
    if (this.auditLog.length > 200) this.auditLog.length = 200;
    this.saveAuditLog();
    return entry;
  }

  getAuditLogs(category, limit = 100) {
    if (!Array.isArray(this.auditLog)) this.auditLog = [];
    let list = this.auditLog;
    if (category && category !== 'all') {
      list = list.filter(l => l.category === category);
    }
    return list.slice(0, limit);
  }

  clearAuditLogs() {
    this.auditLog = [];
    this.saveAuditLog();
    return true;
  }

  // --- Live Sessions History Methods ---
  getLiveSessions() {
    if (!Array.isArray(this.liveSessions)) this.liveSessions = [];
    return this.liveSessions;
  }

  archiveCurrentLive(customTitle, notes = '') {
    if (!Array.isArray(this.liveSessions)) this.liveSessions = [];

    const now = Date.now();
    const startTime = this.stats.startedAt || (now - 3600000);
    const durationMs = Math.max(0, now - startTime);
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    const durationFormatted = `${hours}h ${minutes.toString().padStart(2, '0')}m`;

    const nowObj = new Date(now);
    const dateFormatted = `${nowObj.getDate().toString().padStart(2, '0')}/${(nowObj.getMonth() + 1).toString().padStart(2, '0')}/${nowObj.getFullYear()}`;

    // Count clips created during this session
    const currentClips = Array.isArray(this.clips) ? this.clips.length : 0;

    const session = {
      id: `session-${now}`,
      title: customTitle || `Live de ${dateFormatted} - Transmissão #${this.liveSessions.length + 1}`,
      date: dateFormatted,
      startTime,
      endTime: now,
      duration: durationFormatted,
      peakViewers: this.stats.peakViewers || 0,
      totalLikes: this.stats.totalLikes || 0,
      totalGifts: this.stats.totalGifts || 0,
      totalGiftValue: this.stats.totalGiftValue || 0,
      coffeesPoured: this.stats.coffeesPoured || 0,
      totalMessages: this.stats.totalMessages || 0,
      totalCommands: this.stats.totalCommands || 0,
      uniqueChatters: Array.isArray(this.stats.uniqueChatters) ? this.stats.uniqueChatters.length : 0,
      clipsCount: currentClips,
      notes: notes || '',
      topGivers: this.getTopGifts(5),
      topLikers: this.getTopLikes(5),
      giftList: Array.isArray(this.stats.giftList) ? [...this.stats.giftList] : [],
      subList: Array.isArray(this.stats.subList) ? [...this.stats.subList] : [],
      donateList: Array.isArray(this.stats.donateList) ? [...this.stats.donateList] : [],
      followList: Array.isArray(this.stats.followList) ? [...this.stats.followList] : []
    };

    this.liveSessions.unshift(session);
    this.saveLiveSessions();

    this.logAudit({
      category: 'config',
      action: 'Live Arquivada no Histórico',
      details: `Sessão "${session.title}" finalizada e salva (${session.duration}, ${session.totalLikes} likes, ${session.totalGifts} presentes)`,
      author: 'Painel Web'
    });

    return session;
  }

  deleteLiveSession(id) {
    if (!Array.isArray(this.liveSessions)) return false;
    const idx = this.liveSessions.findIndex(s => s.id === id);
    if (idx >= 0) {
      const removed = this.liveSessions.splice(idx, 1)[0];
      this.saveLiveSessions();
      this.logAudit({
        category: 'config',
        action: 'Sessão de Live Excluída',
        details: `Registro de live "${removed.title}" (${removed.date}) foi removido`,
        author: 'Painel Web'
      });
      return true;
    }
    return false;
  }

  // --- Clips & Timestamps Methods ---
  getClips() {
    if (!Array.isArray(this.clips)) this.clips = [];
    return this.clips;
  }

  addClip(data) {
    if (!Array.isArray(this.clips)) this.clips = [];

    const now = Date.now();
    const liveStart = this.stats.startedAt || now;
    const diffSeconds = Math.max(0, Math.floor((now - liveStart) / 1000));

    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;
    const tsFormatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const dateObj = new Date(now);
    const realTimeFormatted = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}:${dateObj.getSeconds().toString().padStart(2, '0')}`;

    const clip = {
      id: `clip-${now}-${Math.floor(Math.random() * 1000)}`,
      timestampFormatted: data.timestampFormatted || tsFormatted,
      timestampSeconds: data.timestampSeconds !== undefined ? data.timestampSeconds : diffSeconds,
      realTime: data.realTime || realTimeFormatted,
      title: data.title || 'Momento Marcado na Live',
      category: data.category || 'epic', // 'epic', 'funny', 'fail', 'goal', 'gift', 'chat', 'other'
      notes: data.notes || '',
      createdAt: now
    };

    this.clips.unshift(clip);
    this.saveClips();
    return clip;
  }

  updateClip(id, updates) {
    if (!Array.isArray(this.clips)) return null;
    const clip = this.clips.find(c => c.id === id);
    if (!clip) return null;
    if (updates.title !== undefined) clip.title = updates.title;
    if (updates.category !== undefined) clip.category = updates.category;
    if (updates.notes !== undefined) clip.notes = updates.notes;
    this.saveClips();
    return clip;
  }

  deleteClip(id) {
    if (!Array.isArray(this.clips)) return false;
    const idx = this.clips.findIndex(c => c.id === id);
    if (idx >= 0) {
      this.clips.splice(idx, 1);
      this.saveClips();
      return true;
    }
    return false;
  }

  clearClips() {
    this.clips = [];
    this.saveClips();
    return true;
  }
}

module.exports = new StorageService();
