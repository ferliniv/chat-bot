const tmi = require('tmi.js');
const storage = require('./storageService');
const botEngine = require('./botEngine');

class TwitchService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.statusMessage = 'Desconectado (Modo Simulador Local Ativo)';
  }

  async connect() {
    const config = storage.settings.twitch || {};
    if (!config.channel) {
      this.statusMessage = 'Canal não configurado. Operando em modo simulador.';
      return { success: false, message: this.statusMessage };
    }

    try {
      if (this.client) {
        await this.disconnect();
      }

      const clientOptions = {
        options: { debug: false },
        connection: {
          reconnect: true,
          secure: true
        },
        channels: [config.channel.toLowerCase().replace('#', '')]
      };

      // If user provided bot username and oauth token
      if (config.botUsername && config.oauthToken) {
        clientOptions.identity = {
          username: config.botUsername.toLowerCase(),
          password: config.oauthToken.startsWith('oauth:') ? config.oauthToken : `oauth:${config.oauthToken}`
        };
      }

      this.client = new tmi.Client(clientOptions);

      this.client.on('connected', (address, port) => {
        this.isConnected = true;
        this.statusMessage = `Conectado ao canal #${config.channel}`;
        console.log(`[Twitch] ${this.statusMessage}`);
        botEngine.broadcast('twitch_status', { connected: true, status: this.statusMessage });
      });

      this.client.on('disconnected', (reason) => {
        this.isConnected = false;
        this.statusMessage = `Desconectado da Twitch (${reason})`;
        console.log(`[Twitch] ${this.statusMessage}`);
        botEngine.broadcast('twitch_status', { connected: false, status: this.statusMessage });
      });

      this.client.on('message', async (channel, tags, message, self) => {
        if (self) return; // Don't reply to own messages

        const isBroadcaster = tags.badges ? Boolean(tags.badges.broadcaster) : false;
        const isMod = tags.mod || isBroadcaster;
        const isVip = tags.badges ? Boolean(tags.badges.vip) : false;
        const isSubscriber = tags.subscriber || false;
        const username = tags['display-name'] || tags.username;

        const userContext = {
          username,
          isBroadcaster,
          isMod,
          isVip,
          isSubscriber,
          platform: 'twitch',
          rawTags: tags
        };

        if (tags.bits) {
          botEngine.handleDonate(username, `${tags.bits} Bits`, 'twitch');
        }

        await botEngine.handleIncomingMessage(message, userContext);
      });

      await this.client.connect();
      return { success: true, message: this.statusMessage };
    } catch (err) {
      this.isConnected = false;
      this.statusMessage = `Falha na conexão: ${err.message || err}`;
      console.error('[Twitch Error]', err);
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
      this.statusMessage = 'Desconectado';
      botEngine.broadcast('twitch_status', { connected: false, status: this.statusMessage });
    }
  }

  sendMessage(message) {
    const config = storage.settings.twitch || {};
    if (this.client && this.isConnected && config.channel && config.oauthToken) {
      const channel = config.channel.toLowerCase().replace('#', '');
      this.client.say(channel, message).catch(err => {
        console.error('[Twitch Send Error]', err);
      });
    }
  }
}

module.exports = new TwitchService();
