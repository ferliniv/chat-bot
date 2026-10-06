const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}

const storage = require('./storageService');
const botEngine = require('./botEngine');

class TikTokService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.username = null;
    this.statusMessage = 'Desconectado do TikTok';
  }

  cleanUsername(input) {
    if (!input) return '';
    let name = input.trim();
    const match = name.match(/tiktok\.com\/@([a-zA-Z0-9_.-]+)/);
    if (match) return match[1];
    return name.replace('@', '').trim();
  }

  async connect(rawUsername, apiKey = null) {
    const username = this.cleanUsername(rawUsername || (storage.settings.tiktok && storage.settings.tiktok.username) || 'gamescoffeesr');
    const key = apiKey !== null ? apiKey : (storage.settings.tiktok && storage.settings.tiktok.apiKey);

    if (!username) {
      this.statusMessage = 'Usuário do TikTok não informado.';
      return { success: false, message: this.statusMessage };
    }

    try {
      if (this.client) {
        await this.disconnect();
      }

      this.username = username;
      if (!storage.settings.tiktok) storage.settings.tiktok = {};
      storage.settings.tiktok.username = username;
      if (key !== undefined) storage.settings.tiktok.apiKey = key;
      storage.saveSettings();

      console.log(`[TikTok] Conectando ao canal @${username}...`);

      const { TikTokLiveConnection } = require('tiktok-live-connector');

      const options = {
        processInitialData: false,
        enableExtendedGiftInfo: true
      };

      if (key && key.trim()) {
        options.signApiKey = key.trim();
      }

      this.client = new TikTokLiveConnection(username, options);

      // Event: CHAT
      this.client.on('chat', async (data) => {
        const user = data.user ? (data.user.nickname || data.user.uniqueId || 'Espectador TikTok') : 'Espectador';
        const message = data.comment || '';
        if (!message) return;

        const isMod = Boolean(data.user && (data.user.isModerator || data.user.isOwner));
        const isSub = Boolean(data.user && data.user.isSubscriber);

        const userContext = {
          username: user,
          isBroadcaster: Boolean(data.user && data.user.isOwner),
          isMod,
          isVip: false,
          isSubscriber: isSub,
          platform: 'tiktok'
        };

        await botEngine.handleIncomingMessage(message, userContext);
      });

      // Event: LIKE
      this.client.on('like', (data) => {
        const user = data.user ? (data.user.nickname || data.user.uniqueId || 'Espectador') : 'Espectador';
        const count = data.likeCount || 1;
        botEngine.handleLikes(count, user, 'tiktok');
      });

      // Event: GIFT
      this.client.on('gift', (data) => {
        const user = data.user ? (data.user.nickname || data.user.uniqueId || 'Espectador') : 'Espectador';
        const giftName = data.giftName || (data.extendedGiftInfo && data.extendedGiftInfo.name) || 'Presente';
        const count = data.repeatCount || 1;
        const diamonds = data.diamondCount || 1;
        botEngine.handleGift(user, giftName, count, diamonds, 'tiktok');
      });

      // Event: FOLLOW
      this.client.on('follow', (data) => {
        const user = data.user ? (data.user.nickname || data.user.uniqueId || 'Espectador') : 'Espectador';
        botEngine.handleFollow(user, 'tiktok');
      });

      // Event: SUBSCRIBE (Fã Clube)
      this.client.on('subscribe', (data) => {
        const user = data.user ? (data.user.nickname || data.user.uniqueId || 'Espectador') : 'Espectador';
        botEngine.handleSub(user, 'fan_club', 'tiktok');
      });

      // Event: ROOM USER / VIEWERS
      this.client.on('roomUser', (data) => {
        const viewers = data.viewerCount || 0;
        storage.updateViewers('tiktok', viewers);
        botEngine.broadcast('viewers_update', {
          platform: 'tiktok',
          viewers,
          total: storage.stats.currentViewers.total,
          peak: storage.stats.peakViewers
        });
      });

      this.client.on('disconnected', (reason) => {
        this.isConnected = false;
        this.statusMessage = `Desconectado do TikTok (${reason || 'encerrado'})`;
        console.log(`[TikTok] ${this.statusMessage}`);
        botEngine.broadcast('tiktok_status', { connected: false, status: this.statusMessage, username });
      });

      this.client.on('streamEnd', () => {
        this.isConnected = false;
        this.statusMessage = 'Live do TikTok finalizada.';
        botEngine.broadcast('tiktok_status', { connected: false, status: this.statusMessage, username });
      });

      this.client.on('error', (err) => {
        console.error('[TikTok Live Error]', err.message || err);
      });

      await this.client.connect();
      this.isConnected = true;
      this.statusMessage = `Conectado ao TikTok Live (@${username})`;
      console.log(`[TikTok] ${this.statusMessage}`);
      botEngine.broadcast('tiktok_status', { connected: true, status: this.statusMessage, username });
      return { success: true, message: this.statusMessage };
    } catch (err) {
      this.isConnected = false;
      this.statusMessage = `Falha TikTok: ${err.message || err}`;
      console.error('[TikTok Connect Error]', err.message || err);
      botEngine.broadcast('tiktok_status', { connected: false, status: this.statusMessage, username });
      return { success: false, message: this.statusMessage };
    }
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch (e) {}
      this.client = null;
      this.isConnected = false;
      this.statusMessage = 'Desconectado do TikTok';
      botEngine.broadcast('tiktok_status', { connected: false, status: this.statusMessage });
    }
  }

  // Handle incoming events from TikFinity / Webhook / Local Relay
  async handleExternalMessage(payload) {
    if (!payload) return;

    const raw = payload.data || payload.body || payload;
    const eventType = (payload.event || payload.type || raw.event || raw.type || 'chat').toLowerCase();

    // 1. LIKE EVENT
    if (eventType.includes('like') || raw.likeCount || raw.likes) {
      const user = raw.nickname || raw.uniqueId || raw.user || raw.username || 'Espectador';
      const count = Number(raw.likeCount || raw.count || raw.likes || 1);
      botEngine.handleLikes(count, user, 'tiktok');

      this.isConnected = true;
      this.statusMessage = 'Ativo via Webhook TikFinity';
      botEngine.broadcast('tiktok_status', { connected: true, status: this.statusMessage, username: 'TikFinity' });
      return;
    }

    // 2. GIFT EVENT
    if (eventType.includes('gift') || raw.giftName || raw.gift) {
      const user = raw.nickname || raw.uniqueId || raw.user || raw.username || 'Espectador TikTok';
      const giftName = raw.giftName || raw.gift || 'Presente';
      const count = Number(raw.repeatCount || raw.count || 1);
      const diamonds = Number(raw.diamondCount || raw.diamonds || 1);

      botEngine.handleGift(user, giftName, count, diamonds, 'tiktok');

      this.isConnected = true;
      this.statusMessage = 'Ativo via Webhook TikFinity';
      botEngine.broadcast('tiktok_status', { connected: true, status: this.statusMessage, username: 'TikFinity' });
      return;
    }

    // 3. FOLLOW EVENT
    if (eventType.includes('follow')) {
      const user = raw.nickname || raw.uniqueId || raw.user || raw.username || 'Espectador';
      botEngine.handleFollow(user, 'tiktok');
      return;
    }

    // 4. SUBSCRIBE EVENT (Fã Clube)
    if (eventType.includes('sub') || eventType.includes('fan')) {
      const user = raw.nickname || raw.uniqueId || raw.user || raw.username || 'Espectador';
      botEngine.handleSub(user, 'fan_club', 'tiktok');
      return;
    }

    // 5. ROOM USERS / VIEWERS EVENT
    if (eventType.includes('roomuser') || eventType.includes('viewer') || raw.viewerCount !== undefined) {
      const viewers = Number(raw.viewerCount || raw.viewers || 0);
      storage.updateViewers('tiktok', viewers);
      botEngine.broadcast('viewers_update', {
        platform: 'tiktok',
        viewers,
        total: storage.stats.currentViewers.total,
        peak: storage.stats.peakViewers
      });
      return;
    }

    // 6. CHAT MESSAGE
    const user = raw.nickname || raw.uniqueId || raw.user || raw.username || raw.author || 'Espectador TikTok';
    const message = raw.comment || raw.message || raw.text || raw.content || '';
    if (!message) return;

    this.isConnected = true;
    this.statusMessage = 'Conectado via TikFinity';
    botEngine.broadcast('tiktok_status', { connected: true, status: this.statusMessage, username: 'TikFinity' });

    const userContext = {
      username: user,
      isBroadcaster: Boolean(raw.isBroadcaster || raw.isOwner),
      isMod: Boolean(raw.isMod || raw.isModerator),
      isVip: false,
      isSubscriber: Boolean(raw.isSub || raw.isSubscriber),
      platform: 'tiktok'
    };

    await botEngine.handleIncomingMessage(message, userContext);
  }
}

module.exports = new TikTokService();
