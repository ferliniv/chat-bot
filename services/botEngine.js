const storage = require('./storageService');

class BotEngine {
  constructor() {
    this.storage = storage;
    this.cooldowns = new Map(); // key: "cmd" or "cmd:user" -> timestamp
    this.chatLinesSinceTimer = new Map(); // timerId -> count
    this.timerLastRun = new Map(); // timerId -> timestamp
    this.timerInterval = null;
    this.farmingInterval = null;
    this.historyInterval = null;
    this.wsBroadcaster = null;
    this.chatSender = null;

    // Track active viewers for Watch-Time Farming (username -> userContext)
    this.activeViewers = new Map();

    // Track pending Duels (targetUsername -> duelState)
    this.pendingDuels = new Map();

    // Track last like milestone reached
    this.lastLikeMilestone = 0;
  }

  init(broadcaster, sender) {
    this.wsBroadcaster = broadcaster;
    this.chatSender = sender;
    this.startTimers();
    this.startFarmingLoop();
    this.startHistoryLoop();
  }

  setChatSender(sender) {
    this.chatSender = sender;
  }

  setBroadcaster(broadcaster) {
    this.wsBroadcaster = broadcaster;
  }

  // Emit event to connected OBS widgets and web dashboard
  broadcast(type, data) {
    if (this.wsBroadcaster) {
      this.wsBroadcaster({ type, data, timestamp: Date.now() });
    }
  }

  // Send message back to chat
  sendChatMessage(message, replyTo = null) {
    if (this.chatSender) {
      this.chatSender(message, replyTo);
    }
  }

  // Format uptime string
  getUptime() {
    const started = this.storage.stats.startedAt || Date.now();
    const diff = Math.floor((Date.now() - started) / 1000);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  // Mark viewer as actively engaged (for watch-time farming and activity stats)
  touchViewer(username, userContext = {}) {
    if (!username) return;
    const cleanUser = username.trim().toLowerCase().replace('@', '');
    this.activeViewers.set(cleanUser, {
      username: username.replace('@', ''),
      lastSeen: Date.now(),
      isBroadcaster: Boolean(userContext.isBroadcaster),
      isMod: Boolean(userContext.isMod),
      isVip: Boolean(userContext.isVip),
      isSubscriber: Boolean(userContext.isSubscriber),
      platform: userContext.platform || 'simulador'
    });
    this.storage.recordChatter(cleanUser);
  }

  // Handle incoming likes (e.g. from TikTok Live)
  handleLikes(count = 1, user = 'Espectador', platform = 'tiktok') {
    const currentLikes = this.storage.addLikes(count, user);
    this.touchViewer(user, { platform });

    // Broadcast like event to OBS likes widget and dashboard
    this.broadcast('like_event', {
      likesAdded: count,
      totalLikes: currentLikes,
      user,
      platform,
      target: this.storage.settings.likeGoal ? this.storage.settings.likeGoal.target : 10000
    });

    // Check Like Milestones and Goals
    const goal = this.storage.settings.likeGoal;
    if (goal) {
      const step = goal.step || 5000;
      const currentMilestoneTier = Math.floor(currentLikes / step) * step;

      // When crossing a step milestone (e.g. 5.000, 10.000, 15.000 likes)
      if (currentMilestoneTier > this.lastLikeMilestone && currentMilestoneTier >= (goal.step || 5000)) {
        this.lastLikeMilestone = currentMilestoneTier;

        // Trigger Alert on OBS with distinct milestone sound
        this.broadcast('alert', {
          title: `🔥 MARCO DE ${currentMilestoneTier.toLocaleString('pt-BR')} LIKES!`,
          message: `Incrível! A live acabou de bater ${currentMilestoneTier.toLocaleString('pt-BR')} curtidas! Obrigado a todos!`,
          type: 'like_milestone',
          icon: '❤️',
          duration: 6000
        });

        // Award "Chuva de Cafezinhos" to all currently active viewers
        const reward = goal.rewardAllActive || 25;
        let rewardedCount = 0;
        const now = Date.now();
        for (const [key, viewer] of this.activeViewers.entries()) {
          if (now - viewer.lastSeen <= 15 * 60 * 1000) {
            this.storage.addPoints(key, reward);
            rewardedCount++;
          }
        }

        const celebrationMsg = `🎉 META BATIDA: ${currentMilestoneTier.toLocaleString('pt-BR')} LIKES! Chuva de Cafezinhos: +${reward} Cafezinhos para ${rewardedCount || 1} espectadores ativos! ☕🔥`;
        this.sendChatMessage(celebrationMsg);

        this.storage.logEvent({
          type: 'like_milestone',
          title: `🔥 Marco de ${currentMilestoneTier} Likes Batido!`,
          description: celebrationMsg,
          platform,
          timestamp: Date.now()
        });

        this.storage.logAudit({
          category: 'reward',
          action: `Meta de ${currentMilestoneTier.toLocaleString('pt-BR')} Likes Batida`,
          details: `Chuva de +${reward} Cafezinhos distribuída para ${rewardedCount || 1} espectadores ativos no chat`,
          author: 'Sistema Automático'
        });

        // Auto increment goal if reached
        if (goal.autoIncrement && currentLikes >= goal.target) {
          goal.target = currentMilestoneTier + step;
          this.storage.saveSettings();
        }

        this.broadcast('like_goal_update', {
          current: currentLikes,
          target: goal.target
        });
      }
    }

    return currentLikes;
  }

  // Handle incoming gifts (e.g. from TikTok Live or SuperChats)
  handleGift(username, giftName, count = 1, diamonds = 1, platform = 'tiktok') {
    const giftResult = this.storage.addGift(username, giftName, count, diamonds, platform);
    const beansEarned = 25 * count * Math.max(1, diamonds);
    this.storage.addPoints(username, beansEarned);

    this.touchViewer(username, { platform });

    this.broadcast('gift_event', {
      user: username,
      giftName,
      count,
      diamonds,
      totalGifts: this.storage.stats.totalGifts,
      totalGiftValue: this.storage.stats.totalGiftValue
    });

    this.broadcast('alert', {
      title: '🎁 NOVO PRESENTE NA LIVE!',
      message: `${username} enviou ${giftName} x${count}! (+${beansEarned} Cafezinhos)`,
      type: 'gift',
      icon: '🎁',
      duration: 6000
    });

    // Check Gift Goal (+10 increment and Chuva de Cafezinhos)
    const goal = this.storage.settings.donateGoal;
    if (goal) {
      const target = goal.target || 10;
      if (this.storage.stats.totalGifts >= target) {
        const step = goal.step || 10;
        const reached = target;
        if (goal.autoIncrement !== false) {
          goal.target = target + step;
          this.storage.saveSettings();
        }

        // Chuva de Cafezinhos
        const reward = goal.rewardAllActive || 25;
        let rewardedCount = 0;
        const now = Date.now();
        for (const [key, viewer] of this.activeViewers.entries()) {
          if (now - viewer.lastSeen <= 15 * 60 * 1000) {
            this.storage.addPoints(key, reward);
            rewardedCount++;
          }
        }

        const msg = `🎉 META BATIDA: ${reached} PRESENTES! Chuva de Cafezinhos: +${reward} Cafezinhos para ${rewardedCount || 1} espectadores ativos! 🎁☕`;
        this.sendChatMessage(msg);

        this.broadcast('alert', {
          title: `🎁 META DE ${reached} PRESENTES ATINGIDA!`,
          message: `Obrigado a todos! Chuva de +${reward} Cafezinhos distribuída! Próxima meta: ${goal.target}`,
          type: 'milestone',
          icon: '🎁',
          duration: 7000
        });

        this.storage.logEvent({
          type: 'gift_milestone',
          title: `🎁 Meta de ${reached} Presentes Atingida!`,
          description: msg,
          platform,
          timestamp: Date.now()
        });

        this.storage.logAudit({
          category: 'reward',
          action: `Meta de ${reached} Presentes Batida`,
          details: `Chuva de +${reward} Cafezinhos concedida. Próxima meta incrementada (+${step}) para ${goal.target} presentes`,
          author: 'Sistema Automático'
        });

        this.broadcast('donate_goal_update', {
          current: this.storage.stats.totalGifts,
          target: goal.target,
          title: goal.title
        });
      }
    }

    return giftResult;
  }

  // Handle incoming Follows
  handleFollow(username, platform = 'tiktok') {
    const item = this.storage.addFollow(username, platform);
    this.touchViewer(username, { platform });

    this.broadcast('follow_event', {
      user: username,
      platform,
      timestamp: Date.now()
    });

    this.broadcast('alert', {
      title: '🌟 NOVO SEGUIDOR NA LIVE!',
      message: `${username} começou a seguir a transmissão!`,
      type: 'follow',
      icon: '🌟',
      duration: 5000
    });

    return item;
  }

  // Handle incoming Subs / Members / Fan Club
  handleSub(username, type = 'sub', platform = 'twitch') {
    const item = this.storage.addSub(username, type, platform);
    this.touchViewer(username, { platform, isSubscriber: true });

    let title = '⭐ NOVO INSCRITO NA LIVE!';
    let label = 'Inscrição (Sub)';
    if (type === 'fan_club') {
      title = '⭐ ENTROU NO FÃ CLUBE (TIKTOK)!';
      label = 'Fã Clube do TikTok';
    } else if (type === 'member') {
      title = '⭐ NOVO MEMBRO (YOUTUBE)!';
      label = 'Membro do Canal';
    }

    this.broadcast('sub_event', {
      user: username,
      type,
      platform,
      timestamp: Date.now()
    });

    this.broadcast('alert', {
      title,
      message: `${username} agora apoia como ${label}!`,
      type: 'sub',
      icon: '⭐',
      duration: 6000
    });

    return item;
  }

  // Handle incoming Donates / Super Chats
  handleDonate(username, amount, platform = 'youtube') {
    const item = this.storage.addDonate(username, amount, platform);
    this.touchViewer(username, { platform });

    this.broadcast('donate_event', {
      user: username,
      amount,
      platform,
      timestamp: Date.now()
    });

    this.broadcast('alert', {
      title: '💸 APOIO FINANCEIRO RECEBIDO!',
      message: `${username} enviou uma doação de ${amount}!`,
      type: 'donate',
      icon: '💸',
      duration: 6000
    });

    return item;
  }

  // Check user permission
  checkPermission(required, userContext) {
    if (!required || required === 'everyone') return true;
    if (userContext.isBroadcaster) return true;
    if (required === 'mod' && userContext.isMod) return true;
    if (required === 'vip' && (userContext.isMod || userContext.isVip)) return true;
    if (required === 'sub' && (userContext.isMod || userContext.isVip || userContext.isSubscriber)) return true;
    return false;
  }

  // Check cooldown
  checkCooldown(command, username) {
    const now = Date.now();
    const globalKey = `global:${command.name}`;
    const userKey = `user:${command.name}:${username.toLowerCase()}`;

    const globalCd = (command.cooldown || 0) * 1000;
    const userCd = (command.userCooldown || 0) * 1000;

    if (globalCd > 0 && this.cooldowns.has(globalKey)) {
      const diff = now - this.cooldowns.get(globalKey);
      if (diff < globalCd) {
        return { onCooldown: true, remaining: Math.ceil((globalCd - diff) / 1000), type: 'global' };
      }
    }

    if (userCd > 0 && this.cooldowns.has(userKey)) {
      const diff = now - this.cooldowns.get(userKey);
      if (diff < userCd) {
        return { onCooldown: true, remaining: Math.ceil((userCd - diff) / 1000), type: 'user' };
      }
    }

    if (globalCd > 0) this.cooldowns.set(globalKey, now);
    if (userCd > 0) this.cooldowns.set(userKey, now);

    return { onCooldown: false };
  }

  // Automod check
  checkAutomod(message, userContext) {
    if (userContext.isBroadcaster || userContext.isMod) return null;

    const settings = this.storage.settings.moderation;
    if (!settings) return null;

    if (settings.filterCaps && message.length >= (settings.capsMinLength || 10)) {
      const letters = message.replace(/[^a-zA-Z]/g, '');
      if (letters.length >= 8) {
        const upper = letters.replace(/[^A-Z]/g, '').length;
        const percentage = (upper / letters.length) * 100;
        if (percentage >= (settings.capsThresholdPercent || 70)) {
          return {
            violation: 'caps',
            reason: `☕ @${userContext.username}, por favor evite usar excesso de letras maiúsculas!`
          };
        }
      }
    }

    if (settings.blockLinks) {
      const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|br|io|net|org|gg|tv))/gi;
      if (urlRegex.test(message)) {
        const permitted = (settings.permittedUsers || []).includes(userContext.username.toLowerCase());
        if (!permitted) {
          return {
            violation: 'link',
            reason: `☕ @${userContext.username}, links não são permitidos no chat sem autorização prévia!`
          };
        }
      }
    }

    return null;
  }

  // Parse and execute command
  async handleIncomingMessage(rawMessage, userContext = {}) {
    const text = (rawMessage || '').trim();
    if (!text) return null;

    const username = userContext.username || 'Espectador';
    this.touchViewer(username, userContext);

    this.storage.stats.totalMessages = (this.storage.stats.totalMessages || 0) + 1;
    this.storage.saveStats();

    for (const timer of this.storage.timers) {
      const current = this.chatLinesSinceTimer.get(timer.id) || 0;
      this.chatLinesSinceTimer.set(timer.id, current + 1);
    }

    // Broadcast message to live overlay and dashboard
    this.broadcast('chat_message', {
      platform: userContext.platform || 'simulador',
      user: username,
      message: text,
      isMod: userContext.isMod || false,
      isVip: userContext.isVip || false,
      isSub: userContext.isSubscriber || false,
      isBroadcaster: userContext.isBroadcaster || false,
      timestamp: Date.now()
    });

    const automod = this.checkAutomod(text, userContext);
    if (automod) {
      this.sendChatMessage(automod.reason);
      this.broadcast('automod_warn', {
        user: username,
        violation: automod.violation
      });
      return { handled: true, automod: true };
    }

    const prefix = this.storage.settings.prefix || '!';
    if (!text.startsWith(prefix)) {
      return null;
    }

    const parts = text.slice(prefix.length).split(' ');
    const trigger = parts[0].toLowerCase();
    const args = parts.slice(1);
    const argsText = args.join(' ');

    const command = this.storage.commands.find(c => {
      if (!c.enabled) return false;
      if (c.name.toLowerCase() === trigger) return true;
      if (Array.isArray(c.aliases) && c.aliases.map(a => a.toLowerCase()).includes(trigger)) return true;
      return false;
    });

    if (!command) {
      return null;
    }

    if (!this.checkPermission(command.permission, userContext)) {
      this.sendChatMessage(`☕ @${username}, você não tem permissão para usar esse comando.`);
      return { handled: true, error: 'permission_denied' };
    }

    const cd = this.checkCooldown(command, username);
    if (cd.onCooldown) {
      return { handled: true, error: 'cooldown', remaining: cd.remaining };
    }

    this.storage.stats.totalCommands = (this.storage.stats.totalCommands || 0) + 1;
    this.storage.saveStats();

    let responseText = command.response || '';

    if (command.action) {
      const actionResult = await this.executeAction(command.action, userContext, args, argsText);
      if (actionResult && actionResult.reply) {
        responseText = actionResult.reply;
      }
    }

    if (responseText) {
      responseText = this.parseVariables(responseText, userContext, args, argsText);
      this.sendChatMessage(responseText);
    }

    return { handled: true, command: command.name, response: responseText };
  }

  // Parse variables inside response string
  parseVariables(template, userContext, args, argsText) {
    let result = template;
    const username = userContext.username || 'Espectador';
    const target = args[0] ? args[0].replace('@', '') : username;

    const curr = this.storage.settings.currency || { name: 'Cafezinho', plural: 'Cafezinhos' };
    const userBeans = this.storage.getUserPoints(username);

    result = result.replace(/\$\(user\)/g, username);
    result = result.replace(/\$\(target\)/g, target);
    result = result.replace(/\$\(args\)/g, argsText);
    result = result.replace(/\$\(coffeeCount\)/g, this.storage.settings.coffeeMeter.current);
    result = result.replace(/\$\(uptime\)/g, this.getUptime());
    result = result.replace(/\$\(userBeans\)/g, userBeans);
    result = result.replace(/\$\(userCafezinhos\)/g, userBeans);
    result = result.replace(/\$\(currencyName\)/g, curr.plural || 'Cafezinhos');
    result = result.replace(/\$\(coffeeReward\)/g, curr.coffeeReward || 10);
    result = result.replace(/\$\(totalLikes\)/g, (this.storage.stats.totalLikes || 0).toLocaleString('pt-BR'));
    result = result.replace(/\$\(viewersCount\)/g, this.storage.stats.currentViewers ? this.storage.stats.currentViewers.total : 0);

    if (result.includes('$(topBeans)')) {
      const top = this.storage.getTopPoints(5);
      const topFormatted = top.map((t, idx) => `${idx + 1}º @${t.user} (${t.beans} ${curr.plural})`).join(' | ');
      result = result.replace(/\$\(topBeans\)/g, topFormatted || 'Nenhum cafezinho registrado ainda!');
    }

    const raffle = this.storage.settings.raffle || {};
    result = result.replace(/\$\(rafflePrize\)/g, raffle.prize || 'Prêmio Secreto');
    result = result.replace(/\$\(raffleCount\)/g, (raffle.entries || []).length);

    result = result.replace(/\$\(random\s+(\d+)-(\d+)\)/g, (match, min, max) => {
      const low = parseInt(min, 10);
      const high = parseInt(max, 10);
      return Math.floor(Math.random() * (high - low + 1)) + low;
    });

    return result;
  }

  // Execute custom logic for interactive commands & mini-games
  async executeAction(action, userContext, args, argsText) {
    const username = (userContext.username || 'Espectador').replace('@', '').trim();
    const cleanUser = username.toLowerCase();
    const currencyName = (this.storage.settings.currency && this.storage.settings.currency.plural) || 'Cafezinhos';

    switch (action) {
      case 'drink_coffee': {
        const rewardAmount = (this.storage.settings.currency && this.storage.settings.currency.coffeeReward) || 10;
        const updatedMeter = this.storage.incrementCoffee(1);
        const beans = this.storage.addPoints(cleanUser, rewardAmount);

        this.broadcast('coffee_poured', {
          user: username,
          current: updatedMeter.current,
          target: updatedMeter.target,
          beansEarned: rewardAmount,
          totalBeans: beans
        });

        this.broadcast('alert', {
          title: '☕ HORA DO CAFÉ!',
          message: `${username} serviu um café quentinho na live! (+${rewardAmount} ${currencyName})`,
          type: 'coffee',
          icon: '☕'
        });

        this.storage.logEvent({
          type: 'coffee',
          title: '☕ Café Servido',
          description: `@${username} tomou um café (+${rewardAmount} ${currencyName}). Meta: ${updatedMeter.current}/${updatedMeter.target}`,
          platform: userContext.platform || 'simulador',
          timestamp: Date.now()
        });

        return {
          reply: `☕ @${username} preparou uma xícara quentinha! Ganhou +${rewardAmount} ${currencyName} (Saldo: ${beans}). Meta da live: ${updatedMeter.current}/${updatedMeter.target} xícaras!`
        };
      }

      case 'check_beans': {
        const beans = this.storage.getUserPoints(cleanUser);
        return {
          reply: `☕ @${username}, você tem ${beans} ${currencyName}! Jogue: !roleta <quantia>, !slots <quantia> ou !duelo @user <quantia>`
        };
      }

      case 'roulette': {
        const rConfig = (this.storage.settings.minigames && this.storage.settings.minigames.roulette) || {
          winChance: 50,
          multiplier: 2.0,
          minBet: 1,
          maxBet: 10000
        };

        const betArg = args[0];
        const currentBeans = this.storage.getUserPoints(cleanUser);

        if (!betArg) {
          return { reply: `☕ @${username}, uso: !roleta <quantidade> ou !roleta tudo (Seu saldo: ${currentBeans} ${currencyName})` };
        }

        let betAmount = 0;
        if (betArg.toLowerCase() === 'tudo' || betArg.toLowerCase() === 'all') {
          betAmount = currentBeans;
        } else {
          betAmount = parseInt(betArg, 10);
        }

        if (isNaN(betAmount) || betAmount <= 0) {
          return { reply: `☕ @${username}, insira uma quantia válida de ${currencyName}!` };
        }

        if (betAmount < (rConfig.minBet || 1)) {
          return { reply: `☕ @${username}, a aposta mínima na roleta é ${rConfig.minBet || 1} ${currencyName}.` };
        }

        if (rConfig.maxBet && betAmount > rConfig.maxBet) {
          return { reply: `☕ @${username}, a aposta máxima permitida é ${rConfig.maxBet} ${currencyName}.` };
        }

        if (betAmount > currentBeans) {
          return { reply: `☕ @${username}, você não tem ${currencyName} suficientes! Seu saldo atual é ${currentBeans}.` };
        }

        const roll = Math.random() * 100;
        const winChance = rConfig.winChance !== undefined ? rConfig.winChance : 50;
        const won = roll < winChance;

        if (won) {
          const winGain = Math.round(betAmount * (rConfig.multiplier || 2.0)) - betAmount;
          const newBalance = this.storage.addPoints(cleanUser, winGain);

          this.storage.logEvent({
            type: 'minigame',
            title: '🎰 Vitória na Roleta',
            description: `@${username} apostou ${betAmount} e ganhou +${winGain} ${currencyName}!`,
            platform: userContext.platform || 'simulador',
            timestamp: Date.now()
          });

          return {
            reply: `🎉 AROMA PERFEITO! @${username} apostou ${betAmount} ${currencyName} e a torra ficou no ponto! Ganhou +${winGain} (Novo saldo: ${newBalance})`
          };
        } else {
          const newBalance = this.storage.addPoints(cleanUser, -betAmount);

          this.storage.logEvent({
            type: 'minigame',
            title: '🔥 Derrota na Roleta',
            description: `@${username} apostou ${betAmount} e perdeu na roleta.`,
            platform: userContext.platform || 'simulador',
            timestamp: Date.now()
          });

          return {
            reply: `🔥 EITA! O café queimou na torra! @${username} perdeu ${betAmount} ${currencyName}. (Saldo restante: ${newBalance})`
          };
        }
      }

      // 4. MINI-GAME: CAÇA-NÍQUEIS COM (Queijo, Cobrinha, Cafezinho, Diamante, Coração)
      case 'slots': {
        const sConfig = (this.storage.settings.minigames && this.storage.settings.minigames.slots) || {
          minBet: 5,
          maxBet: 5000,
          winChancePercent: 40,
          jackpotMultiplier: 5.0,
          pairMultiplier: 1.5
        };

        const betArg = args[0];
        const currentBeans = this.storage.getUserPoints(cleanUser);

        if (!betArg) {
          return { reply: `🎰 @${username}, uso: !slots <quantidade> (Aposta mín: ${sConfig.minBet}, Máx: ${sConfig.maxBet}) | Saldo: ${currentBeans}` };
        }

        let betAmount = 0;
        if (betArg.toLowerCase() === 'tudo' || betArg.toLowerCase() === 'all') {
          betAmount = Math.min(currentBeans, sConfig.maxBet || 5000);
        } else {
          betAmount = parseInt(betArg, 10);
        }

        if (isNaN(betAmount) || betAmount <= 0) {
          return { reply: `🎰 @${username}, digite um valor válido de ${currencyName} para girar os slots!` };
        }

        if (betAmount < (sConfig.minBet || 5)) {
          return { reply: `🎰 @${username}, a aposta mínima nos slots é de ${sConfig.minBet} ${currencyName}.` };
        }

        if (sConfig.maxBet && betAmount > sConfig.maxBet) {
          return { reply: `🎰 @${username}, a aposta máxima nos slots é de ${sConfig.maxBet} ${currencyName}.` };
        }

        if (betAmount > currentBeans) {
          return { reply: `🎰 @${username}, saldo insuficiente! Você tem ${currentBeans} ${currencyName}.` };
        }

        // Updated symbols: Queijo, Cobrinha, Cafezinho, Diamante, Coração
        const icons = ['🧀', '🐍', '☕', '💎', '❤️'];
        const roll = Math.random() * 100;
        const winChance = sConfig.winChancePercent !== undefined ? sConfig.winChancePercent : 40;

        let reels = [];
        let outcome = 'lose';

        if (roll < winChance) {
          const jackpotRoll = Math.random() < 0.20;
          if (jackpotRoll) {
            outcome = 'jackpot';
            const icon = icons[Math.floor(Math.random() * icons.length)];
            reels = [icon, icon, icon];
          } else {
            outcome = 'pair';
            const icon = icons[Math.floor(Math.random() * icons.length)];
            const otherIcon = icons.filter(i => i !== icon)[Math.floor(Math.random() * (icons.length - 1))];
            const arr = [icon, icon, otherIcon];
            reels = arr.sort(() => Math.random() - 0.5);
          }
        } else {
          const shuffled = [...icons].sort(() => Math.random() - 0.5);
          reels = [shuffled[0], shuffled[1], shuffled[2]];
        }

        const reelsStr = `[ ${reels.join(' | ')} ]`;

        if (outcome === 'jackpot') {
          const mult = sConfig.jackpotMultiplier || 5.0;
          const winGain = Math.round(betAmount * mult) - betAmount;
          const newBal = this.storage.addPoints(cleanUser, winGain);

          this.broadcast('alert', {
            title: '🎰 JACKPOT NO CAÇA-NÍQUEIS!',
            message: `@${username} tirou 3x ${reels[0]} e faturou +${winGain} ${currencyName}!`,
            type: 'jackpot',
            icon: '💎',
            duration: 6000
          });

          this.storage.logEvent({
            type: 'minigame',
            title: '💎 JACKPOT nos Slots!',
            description: `@${username} tirou ${reelsStr} e ganhou +${winGain} ${currencyName}!`,
            platform: userContext.platform || 'simulador',
            timestamp: Date.now()
          });

          return {
            reply: `🎰 @${username} girou os slots: ${reelsStr} -> 💎 JACKPOT INCRÍVEL! Multiplicador ${mult}x! Ganhou +${winGain} ${currencyName}! (Novo saldo: ${newBal})`
          };
        } else if (outcome === 'pair') {
          const mult = sConfig.pairMultiplier || 1.5;
          const winGain = Math.round(betAmount * mult) - betAmount;
          const newBal = this.storage.addPoints(cleanUser, winGain);

          return {
            reply: `🎰 @${username} girou os slots: ${reelsStr} -> ✨ COMBINAÇÃO DUPLA! Ganhou +${winGain} ${currencyName}! (Novo saldo: ${newBal})`
          };
        } else {
          const newBal = this.storage.addPoints(cleanUser, -betAmount);
          return {
            reply: `🎰 @${username} girou os slots: ${reelsStr} -> ❌ Nada combinado! Perdeu ${betAmount} ${currencyName}. (Saldo: ${newBal})`
          };
        }
      }

      // 5. MINI-GAME: DUELO
      case 'duel': {
        const dConfig = (this.storage.settings.minigames && this.storage.settings.minigames.duel) || {
          timeoutSeconds: 60,
          minBet: 5,
          maxBet: 20000,
          houseFeePercent: 0
        };

        const targetArg = args[0];
        const betArg = args[1];
        const currentBeans = this.storage.getUserPoints(cleanUser);

        if (!targetArg || !betArg) {
          return { reply: `⚔️ @${username}, uso: !duelo @oponente <quantia>` };
        }

        const targetUser = targetArg.replace('@', '').trim();
        const cleanTarget = targetUser.toLowerCase();

        if (cleanTarget === cleanUser) {
          return { reply: `⚔️ @${username}, você não pode duelar contra você mesmo!` };
        }

        const betAmount = parseInt(betArg, 10);
        if (isNaN(betAmount) || betAmount <= 0) {
          return { reply: `⚔️ @${username}, informe uma quantia válida de ${currencyName}!` };
        }

        if (betAmount < (dConfig.minBet || 5)) {
          return { reply: `⚔️ @${username}, aposta mínima para duelo é de ${dConfig.minBet} ${currencyName}.` };
        }

        if (dConfig.maxBet && betAmount > dConfig.maxBet) {
          return { reply: `⚔️ @${username}, aposta máxima para duelo é de ${dConfig.maxBet} ${currencyName}.` };
        }

        if (betAmount > currentBeans) {
          return { reply: `⚔️ @${username}, você não tem ${currencyName} suficientes! (Seu saldo: ${currentBeans})` };
        }

        const targetBeans = this.storage.getUserPoints(cleanTarget);
        if (targetBeans < betAmount) {
          return { reply: `⚔️ @${username}, @${targetUser} não tem ${currencyName} suficientes para aceitar esse duelo (Saldo de @${targetUser}: ${targetBeans}).` };
        }

        if (this.pendingDuels.has(cleanTarget)) {
          return { reply: `⚔️ @${username}, @${targetUser} já tem um duelo pendente aguardando resposta!` };
        }

        const timeoutMs = (dConfig.timeoutSeconds || 60) * 1000;
        const timer = setTimeout(() => {
          if (this.pendingDuels.has(cleanTarget)) {
            this.pendingDuels.delete(cleanTarget);
            this.sendChatMessage(`⏱️ O duelo entre @${username} e @${targetUser} expirou sem resposta.`);
          }
        }, timeoutMs);

        this.pendingDuels.set(cleanTarget, {
          challenger: username,
          cleanChallenger: cleanUser,
          target: targetUser,
          cleanTarget,
          amount: betAmount,
          timer,
          expiresAt: Date.now() + timeoutMs
        });

        return {
          reply: `⚔️ DESAFIO LANÇADO! @${username} desafiou @${targetUser} para um duelo valendo ${betAmount} ${currencyName}! @${targetUser}, digite !aceitar ou !recusar (${dConfig.timeoutSeconds || 60}s para responder)`
        };
      }

      // 6. ACEITAR DUELO
      case 'accept_duel': {
        if (!this.pendingDuels.has(cleanUser)) {
          return { reply: `⚔️ @${username}, você não tem nenhum duelo pendente para aceitar!` };
        }

        const duel = this.pendingDuels.get(cleanUser);
        clearTimeout(duel.timer);
        this.pendingDuels.delete(cleanUser);

        const challengerBeans = this.storage.getUserPoints(duel.cleanChallenger);
        const targetBeans = this.storage.getUserPoints(cleanUser);

        if (challengerBeans < duel.amount) {
          return { reply: `⚔️ O duelo foi cancelado pois @${duel.challenger} não possui mais saldo suficiente.` };
        }
        if (targetBeans < duel.amount) {
          return { reply: `⚔️ @${username}, você não possui mais saldo suficiente para cobrir os ${duel.amount} ${currencyName}.` };
        }

        const challengerWon = Math.random() >= 0.5;
        const winner = challengerWon ? duel.challenger : username;
        const cleanWinner = challengerWon ? duel.cleanChallenger : cleanUser;
        const loser = challengerWon ? username : duel.challenger;
        const cleanLoser = challengerWon ? cleanUser : duel.cleanChallenger;

        this.storage.addPoints(cleanLoser, -duel.amount);
        const winnerBal = this.storage.addPoints(cleanWinner, duel.amount);

        this.broadcast('alert', {
          title: '⚔️ VENCEDOR DO DUELO!',
          message: `@${winner} venceu o duelo contra @${loser} e levou ${duel.amount * 2} ${currencyName}!`,
          type: 'duel',
          icon: '⚔️',
          duration: 5000
        });

        this.storage.logEvent({
          type: 'duel',
          title: '⚔️ Duelo Finalizado',
          description: `@${winner} venceu @${loser} valendo ${duel.amount} ${currencyName}!`,
          platform: userContext.platform || 'simulador',
          timestamp: Date.now()
        });

        return {
          reply: `⚔️ CLASH! No confronto de cafeterias, @${winner} venceu o duelo contra @${loser}! Faturou o pote de ${duel.amount} ${currencyName}! (Novo saldo de @${winner}: ${winnerBal})`
        };
      }

      // 7. RECUSAR DUELO
      case 'refuse_duel': {
        if (!this.pendingDuels.has(cleanUser)) {
          return { reply: `☕ @${username}, você não tem nenhum duelo para recusar.` };
        }

        const duel = this.pendingDuels.get(cleanUser);
        clearTimeout(duel.timer);
        this.pendingDuels.delete(cleanUser);

        return {
          reply: `💨 @${username} arregou e recusou o duelo com @${duel.challenger}!`
        };
      }

      // 8. TOP CAFEZEIROS
      case 'top_beans': {
        const top = this.storage.getTopPoints(5);
        const text = top.map((t, i) => `${i + 1}º @${t.user} (${t.beans})`).join(' | ');
        return { reply: `🏆 Top Cafezeiros da Live: ${text || 'Nenhum cafezinho registrado ainda!'}` };
      }

      // 9. DISPARAR ALERTA NA TELA
      case 'trigger_alert': {
        if (!argsText) {
          return { reply: `📢 @${username}, escreva a mensagem para o alerta: !alerta <sua mensagem>` };
        }
        this.broadcast('alert', {
          title: `📢 Alerta de @${username}`,
          message: argsText,
          type: 'custom',
          icon: '⭐'
        });
        return { reply: `📢 Alerta transmitido para a tela da live!` };
      }

      // 10. SORTEIO / RIFA
      case 'raffle_info': {
        const r = this.storage.settings.raffle;
        if (!r.active) {
          return { reply: `🎁 Nenhum sorteio ativo no momento. Fique de olho na live!` };
        }
        return {
          reply: `🎁 Sorteio Aberto: "${r.prize}"! Digite !entrar para concorrer. Total de inscritos: ${r.entries.length}`
        };
      }

      case 'raffle_join': {
        const r = this.storage.settings.raffle;
        if (!r.active) {
          return { reply: `☕ @${username}, nenhum sorteio está aberto agora.` };
        }
        if (r.entries.includes(cleanUser)) {
          return { reply: `☕ @${username}, você já está participando deste sorteio!` };
        }
        r.entries.push(cleanUser);
        this.storage.saveSettings();
        return { reply: `🎟️ @${username} entrou no sorteio! Boa sorte!` };
      }

      default:
        return null;
    }
  }

  // Watch-Time Farming Loop (Cafezinhos por assistir a live)
  startFarmingLoop() {
    if (this.farmingInterval) clearInterval(this.farmingInterval);

    this.farmingInterval = setInterval(() => {
      this.checkFarming();
    }, 60000);
  }

  checkFarming() {
    const config = this.storage.settings.currency;
    if (!config || !config.farmingEnabled) return;

    const intervalMin = config.farmingIntervalMinutes || 2;
    const now = Date.now();
    const activeThreshold = 10 * 60 * 1000;
    let awardedViewers = 0;
    let totalBeansAwarded = 0;

    for (const [key, viewer] of this.activeViewers.entries()) {
      if (now - viewer.lastSeen <= activeThreshold) {
        let amount = config.farmingAmount || 5;

        // Platform-specific VIP/Sub Multipliers: TikTok Fã Clube & YouTube Membros
        if (viewer.platform === 'tiktok' && viewer.isSubscriber && config.tiktokFanMultiplier) {
          amount = Math.round(amount * config.tiktokFanMultiplier);
        } else if (viewer.platform === 'youtube' && viewer.isSubscriber && config.youtubeMemberMultiplier) {
          amount = Math.round(amount * config.youtubeMemberMultiplier);
        } else if (viewer.isSubscriber && config.subMultiplier) {
          amount = Math.round(amount * config.subMultiplier);
        } else if (viewer.isVip && config.vipMultiplier) {
          amount = Math.round(amount * config.vipMultiplier);
        }

        this.storage.addPoints(key, amount);
        awardedViewers++;
        totalBeansAwarded += amount;
      }
    }

    if (awardedViewers > 0) {
      this.broadcast('farming_awarded', {
        viewersCount: awardedViewers,
        totalBeans: totalBeansAwarded,
        amount: config.farmingAmount || 5
      });
    }
  }

  startHistoryLoop() {
    if (this.historyInterval) clearInterval(this.historyInterval);

    this.historyInterval = setInterval(() => {
      this.storage.addHistorySnapshot();
    }, 120000);

    this.storage.addHistorySnapshot();
  }

  startTimers() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      this.checkTimers();
    }, 30000);
  }

  checkTimers() {
    const now = Date.now();
    for (const timer of this.storage.timers) {
      if (!timer.enabled) continue;

      const lastRun = this.timerLastRun.get(timer.id) || 0;
      const intervalMs = (timer.intervalMinutes || 15) * 60 * 1000;
      const lines = this.chatLinesSinceTimer.get(timer.id) || 0;
      const threshold = timer.chatLinesThreshold || 3;

      if (now - lastRun >= intervalMs) {
        if (lines >= threshold) {
          this.sendChatMessage(timer.message);
          this.timerLastRun.set(timer.id, now);
          this.chatLinesSinceTimer.set(timer.id, 0);

          this.broadcast('timer_triggered', {
            id: timer.id,
            name: timer.name,
            message: timer.message
          });
        }
      }
    }
  }

  stop() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.farmingInterval) {
      clearInterval(this.farmingInterval);
      this.farmingInterval = null;
    }
    if (this.historyInterval) {
      clearInterval(this.historyInterval);
      this.historyInterval = null;
    }
  }
}

module.exports = new BotEngine();
