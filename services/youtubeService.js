const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}

const { LiveChat } = require('youtube-chat');
const storage = require('./storageService');
const botEngine = require('./botEngine');

class YouTubeService {
  constructor() {
    this.liveChat = null;
    this.isConnected = false;
    this.liveId = null;
    this.statusMessage = 'Desconectado do YouTube';
  }

  // Extract video ID from URL or return raw ID
  extractLiveId(input) {
    if (!input) return null;
    const trimmed = input.trim();
    const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/))([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    if (trimmed.length === 11) return trimmed;
    return trimmed;
  }

  async connect(videoUrlOrId) {
    const liveId = this.extractLiveId(videoUrlOrId || (storage.settings.youtube && storage.settings.youtube.liveId));
    if (!liveId) {
      this.statusMessage = 'ID do vídeo do YouTube não informado.';
      return { success: false, message: this.statusMessage };
    }

    try {
      if (this.liveChat) {
        await this.disconnect();
      }

      this.liveId = liveId;
      if (!storage.settings.youtube) storage.settings.youtube = {};
      storage.settings.youtube.liveId = liveId;
      storage.saveSettings();

      console.log(`[YouTube] Conectando ao chat da live: ${liveId}...`);
      this.liveChat = new LiveChat({ liveId });

      this.liveChat.on('start', (id) => {
        this.isConnected = true;
        this.statusMessage = `Conectado ao YouTube Live (${id})`;
        console.log(`[YouTube] ${this.statusMessage}`);
        botEngine.broadcast('youtube_status', { connected: true, status: this.statusMessage, liveId });
      });

      this.liveChat.on('end', (reason) => {
        this.isConnected = false;
        this.statusMessage = `YouTube Live finalizada (${reason || 'encerrada'})`;
        console.log(`[YouTube] ${this.statusMessage}`);
        botEngine.broadcast('youtube_status', { connected: false, status: this.statusMessage, liveId: null });
      });

      this.liveChat.on('error', (err) => {
        console.error('[YouTube Error]', err.message || err);
      });

      this.liveChat.on('chat', async (chatItem) => {
        const username = chatItem.author ? (chatItem.author.name || 'Espectador') : 'Espectador';
        const message = (chatItem.message || []).map(m => m.text || '').join('');
        if (!message) return;

        const isBroadcaster = Boolean(chatItem.author && chatItem.author.isChatOwner);
        const isMod = Boolean(chatItem.author && (chatItem.author.isChatModerator || isBroadcaster));
        const isSub = Boolean(chatItem.author && chatItem.author.isChatSponsor);

        const userContext = {
          username,
          isBroadcaster,
          isMod,
          isVip: false,
          isSubscriber: isSub,
          platform: 'youtube'
        };

        // Handle Super Chat (Donate)
        if (chatItem.superchat) {
          const amount = chatItem.superchat.amount || 'R$ 0';
          botEngine.handleDonate(username, amount, 'youtube');
        }

        // Handle Membership / Sponsor
        if (isSub) {
          botEngine.handleSub(username, 'member', 'youtube');
        }

        // Broadcast to Unified Chat with platform badge
        botEngine.broadcast('chat_message', {
          platform: 'youtube',
          user: username,
          message,
          isBroadcaster,
          isMod,
          isSub,
          timestamp: Date.now()
        });

        // Pass to Bot Engine command parser
        await botEngine.handleIncomingMessage(message, userContext);
      });

      const started = await this.liveChat.start();
      if (started) {
        this.isConnected = true;
        this.statusMessage = `Conectado ao YouTube Live (${liveId})`;
        return { success: true, message: this.statusMessage, liveId };
      } else {
        this.statusMessage = 'Falha ao iniciar leitura do YouTube Live';
        return { success: false, message: this.statusMessage };
      }
    } catch (err) {
      this.isConnected = false;
      this.statusMessage = `Erro YouTube: ${err.message || err}`;
      console.error('[YouTube Connect Error]', err);
      return { success: false, message: this.statusMessage };
    }
  }

  async disconnect() {
    if (this.liveChat) {
      try {
        this.liveChat.stop();
      } catch (e) {}
      this.liveChat = null;
      this.isConnected = false;
      this.statusMessage = 'Desconectado do YouTube';
      botEngine.broadcast('youtube_status', { connected: false, status: this.statusMessage });
    }
  }
}

module.exports = new YouTubeService();
