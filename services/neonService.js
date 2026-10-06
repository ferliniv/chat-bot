require('dotenv').config();
const { Pool } = require('pg');

class NeonService {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.statusMessage = 'Não inicializado';
    this.stats = {
      sessionsCount: 0,
      clipsCount: 0,
      auditLogsCount: 0,
      pointsCount: 0,
      eventsCount: 0
    };
    this.lastSyncAt = null;
    this.initPool();
  }

  initPool() {
    const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
    if (!connectionString) {
      this.statusMessage = 'DATABASE_URL não configurada no .env';
      console.warn('[Neon DB]', this.statusMessage);
      return;
    }

    try {
      this.pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      });

      this.pool.on('error', (err) => {
        console.error('[Neon DB Pool Error]:', err.message);
        this.isConnected = false;
      });
    } catch (err) {
      console.error('[Neon DB Init Error]:', err.message);
      this.isConnected = false;
    }
  }

  async init(storageService) {
    if (!this.pool) return false;

    try {
      const client = await this.pool.connect();
      try {
        const testRes = await client.query('SELECT NOW() as now, current_database() as db');
        this.isConnected = true;
        this.statusMessage = `Conectado ao Neon (${testRes.rows[0].db})`;
        console.log(`✓ [Neon DB] Conexão estabelecida com sucesso: ${this.statusMessage}`);

        // Create Tables if not exist
        await this.createTables(client);

        // Sync initial data if needed
        if (storageService) {
          await this.syncInitialData(client, storageService);
        }

        await this.refreshCounts(client);
        return true;
      } finally {
        client.release();
      }
    } catch (err) {
      this.isConnected = false;
      this.statusMessage = `Erro de conexão: ${err.message}`;
      console.warn('[Neon DB Connection Failed]:', err.message);
      return false;
    }
  }

  async createTables(client) {
    const query = `
      -- 1. Live Sessions
      CREATE TABLE IF NOT EXISTS bot_live_sessions (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        date VARCHAR(32),
        start_time BIGINT,
        end_time BIGINT,
        duration VARCHAR(32),
        peak_viewers INT DEFAULT 0,
        total_likes INT DEFAULT 0,
        total_gifts INT DEFAULT 0,
        total_gift_value INT DEFAULT 0,
        coffees_poured INT DEFAULT 0,
        total_messages INT DEFAULT 0,
        total_commands INT DEFAULT 0,
        unique_chatters INT DEFAULT 0,
        clips_count INT DEFAULT 0,
        notes TEXT,
        top_givers JSONB,
        top_likers JSONB,
        gift_list JSONB,
        sub_list JSONB,
        donate_list JSONB,
        follow_list JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- 2. Clips & Timestamps
      CREATE TABLE IF NOT EXISTS bot_clips (
        id VARCHAR(64) PRIMARY KEY,
        timestamp_formatted VARCHAR(32) NOT NULL,
        timestamp_seconds INT DEFAULT 0,
        real_time VARCHAR(32),
        title VARCHAR(255) NOT NULL,
        category VARCHAR(32) DEFAULT 'epic',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- 3. Audit Logs
      CREATE TABLE IF NOT EXISTS bot_audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        timestamp BIGINT NOT NULL,
        category VARCHAR(32) NOT NULL,
        action VARCHAR(255) NOT NULL,
        details TEXT,
        author VARCHAR(64) DEFAULT 'Painel',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- 4. User Points (Cafezinhos)
      CREATE TABLE IF NOT EXISTS bot_user_points (
        username VARCHAR(128) PRIMARY KEY,
        points INT DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- 5. Live Events Stream
      CREATE TABLE IF NOT EXISTS bot_live_events (
        id VARCHAR(64) PRIMARY KEY,
        type VARCHAR(32) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        platform VARCHAR(32) DEFAULT 'tiktok',
        timestamp BIGINT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- 6. Settings Store
      CREATE TABLE IF NOT EXISTS bot_settings (
        key VARCHAR(64) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await client.query(query);
    console.log('✓ [Neon DB] Tabelas bot_* verificadas/criadas com sucesso no PostgreSQL.');
  }

  async syncInitialData(client, storage) {
    try {
      // 1. Sync Live Sessions if Neon table is empty
      const sessRes = await client.query('SELECT COUNT(*) FROM bot_live_sessions');
      if (parseInt(sessRes.rows[0].count, 10) === 0 && Array.isArray(storage.liveSessions) && storage.liveSessions.length > 0) {
        console.log(`[Neon DB Sync] Migrando ${storage.liveSessions.length} sessões de live para o Neon...`);
        for (const s of storage.liveSessions) {
          await this.saveLiveSession(s);
        }
      }

      // 2. Sync Clips if Neon table is empty
      const clipsRes = await client.query('SELECT COUNT(*) FROM bot_clips');
      if (parseInt(clipsRes.rows[0].count, 10) === 0 && Array.isArray(storage.clips) && storage.clips.length > 0) {
        console.log(`[Neon DB Sync] Migrando ${storage.clips.length} clipes para o Neon...`);
        for (const c of storage.clips) {
          await this.saveClip(c);
        }
      }

      // 3. Sync Audit Logs if Neon table is empty
      const auditRes = await client.query('SELECT COUNT(*) FROM bot_audit_logs');
      if (parseInt(auditRes.rows[0].count, 10) === 0 && Array.isArray(storage.auditLog) && storage.auditLog.length > 0) {
        console.log(`[Neon DB Sync] Migrando ${storage.auditLog.length} logs de auditoria para o Neon...`);
        for (const a of storage.auditLog) {
          await this.saveAuditLog(a);
        }
      }

      // 4. Sync User Points (Cafezinhos)
      if (storage.points && typeof storage.points === 'object') {
        const pointsEntries = Object.entries(storage.points);
        for (const [user, beans] of pointsEntries) {
          await this.savePoints(user, beans);
        }
      }

      // 5. Sync Settings
      if (storage.settings) {
        await this.saveSettings('active_settings', storage.settings);
      }

      this.lastSyncAt = new Date().toISOString();
      console.log('✓ [Neon DB Sync] Sincronização de dados inicial com o Neon concluída!');
    } catch (e) {
      console.error('[Neon DB Sync Error]:', e.message);
    }
  }

  async refreshCounts(client) {
    const c = client || this.pool;
    if (!c) return;
    try {
      const rS = await c.query('SELECT COUNT(*) FROM bot_live_sessions');
      const rC = await c.query('SELECT COUNT(*) FROM bot_clips');
      const rA = await c.query('SELECT COUNT(*) FROM bot_audit_logs');
      const rP = await c.query('SELECT COUNT(*) FROM bot_user_points');
      const rE = await c.query('SELECT COUNT(*) FROM bot_live_events');

      this.stats = {
        sessionsCount: parseInt(rS.rows[0].count, 10),
        clipsCount: parseInt(rC.rows[0].count, 10),
        auditLogsCount: parseInt(rA.rows[0].count, 10),
        pointsCount: parseInt(rP.rows[0].count, 10),
        eventsCount: parseInt(rE.rows[0].count, 10)
      };
    } catch (e) {
      console.error('[Neon Refresh Counts Error]:', e.message);
    }
  }

  // --- CRUD Operations in Neon ---

  async saveLiveSession(s) {
    if (!this.pool || !this.isConnected) return false;
    try {
      const query = `
        INSERT INTO bot_live_sessions (
          id, title, date, start_time, end_time, duration,
          peak_viewers, total_likes, total_gifts, total_gift_value, coffees_poured,
          total_messages, total_commands, unique_chatters, clips_count, notes,
          top_givers, top_likers, gift_list, sub_list, donate_list, follow_list
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          end_time = EXCLUDED.end_time,
          duration = EXCLUDED.duration,
          peak_viewers = EXCLUDED.peak_viewers,
          total_likes = EXCLUDED.total_likes,
          total_gifts = EXCLUDED.total_gifts,
          total_gift_value = EXCLUDED.total_gift_value,
          coffees_poured = EXCLUDED.coffees_poured,
          total_messages = EXCLUDED.total_messages,
          total_commands = EXCLUDED.total_commands,
          unique_chatters = EXCLUDED.unique_chatters,
          clips_count = EXCLUDED.clips_count,
          notes = EXCLUDED.notes,
          top_givers = EXCLUDED.top_givers,
          top_likers = EXCLUDED.top_likers,
          gift_list = EXCLUDED.gift_list,
          sub_list = EXCLUDED.sub_list,
          donate_list = EXCLUDED.donate_list,
          follow_list = EXCLUDED.follow_list;
      `;
      const values = [
        s.id,
        s.title || 'Live sem título',
        s.date || '',
        s.startTime || Date.now(),
        s.endTime || Date.now(),
        s.duration || '0m',
        s.peakViewers || 0,
        s.totalLikes || 0,
        s.totalGifts || 0,
        s.totalGiftValue || 0,
        s.coffeesPoured || 0,
        s.totalMessages || 0,
        s.totalCommands || 0,
        s.uniqueChatters || 0,
        s.clipsCount || 0,
        s.notes || '',
        JSON.stringify(s.topGivers || []),
        JSON.stringify(s.topLikers || []),
        JSON.stringify(s.giftList || []),
        JSON.stringify(s.subList || []),
        JSON.stringify(s.donateList || []),
        JSON.stringify(s.followList || [])
      ];

      await this.pool.query(query, values);
      this.stats.sessionsCount++;
      return true;
    } catch (e) {
      console.error('[Neon Save Session Error]:', e.message);
      return false;
    }
  }

  async deleteLiveSession(id) {
    if (!this.pool || !this.isConnected) return false;
    try {
      await this.pool.query('DELETE FROM bot_live_sessions WHERE id = $1', [id]);
      this.stats.sessionsCount = Math.max(0, this.stats.sessionsCount - 1);
      return true;
    } catch (e) {
      console.error('[Neon Delete Session Error]:', e.message);
      return false;
    }
  }

  async saveClip(clip) {
    if (!this.pool || !this.isConnected) return false;
    try {
      const query = `
        INSERT INTO bot_clips (
          id, timestamp_formatted, timestamp_seconds, real_time, title, category, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          category = EXCLUDED.category,
          notes = EXCLUDED.notes;
      `;
      await this.pool.query(query, [
        clip.id,
        clip.timestampFormatted,
        clip.timestampSeconds || 0,
        clip.realTime || '',
        clip.title || 'Momento Marcado',
        clip.category || 'epic',
        clip.notes || ''
      ]);
      this.stats.clipsCount++;
      return true;
    } catch (e) {
      console.error('[Neon Save Clip Error]:', e.message);
      return false;
    }
  }

  async updateClip(id, updates) {
    if (!this.pool || !this.isConnected) return false;
    try {
      const query = `
        UPDATE bot_clips
        SET title = COALESCE($2, title),
            category = COALESCE($3, category),
            notes = COALESCE($4, notes)
        WHERE id = $1;
      `;
      await this.pool.query(query, [id, updates.title, updates.category, updates.notes]);
      return true;
    } catch (e) {
      console.error('[Neon Update Clip Error]:', e.message);
      return false;
    }
  }

  async deleteClip(id) {
    if (!this.pool || !this.isConnected) return false;
    try {
      await this.pool.query('DELETE FROM bot_clips WHERE id = $1', [id]);
      this.stats.clipsCount = Math.max(0, this.stats.clipsCount - 1);
      return true;
    } catch (e) {
      console.error('[Neon Delete Clip Error]:', e.message);
      return false;
    }
  }

  async clearClips() {
    if (!this.pool || !this.isConnected) return false;
    try {
      await this.pool.query('DELETE FROM bot_clips');
      this.stats.clipsCount = 0;
      return true;
    } catch (e) {
      console.error('[Neon Clear Clips Error]:', e.message);
      return false;
    }
  }

  async saveAuditLog(entry) {
    if (!this.pool || !this.isConnected) return false;
    try {
      const query = `
        INSERT INTO bot_audit_logs (
          id, timestamp, category, action, details, author
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING;
      `;
      await this.pool.query(query, [
        entry.id,
        entry.timestamp || Date.now(),
        entry.category || 'config',
        entry.action || 'Ação',
        entry.details || '',
        entry.author || 'Painel'
      ]);
      this.stats.auditLogsCount++;
      return true;
    } catch (e) {
      console.error('[Neon Save Audit Error]:', e.message);
      return false;
    }
  }

  async clearAuditLogs() {
    if (!this.pool || !this.isConnected) return false;
    try {
      await this.pool.query('DELETE FROM bot_audit_logs');
      this.stats.auditLogsCount = 0;
      return true;
    } catch (e) {
      console.error('[Neon Clear Audit Error]:', e.message);
      return false;
    }
  }

  async savePoints(username, points) {
    if (!this.pool || !this.isConnected || !username) return false;
    try {
      const cleanUser = username.toLowerCase().replace('@', '').trim();
      const query = `
        INSERT INTO bot_user_points (username, points, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (username) DO UPDATE
        SET points = EXCLUDED.points, updated_at = NOW();
      `;
      await this.pool.query(query, [cleanUser, points]);
      return true;
    } catch (e) {
      console.error('[Neon Save Points Error]:', e.message);
      return false;
    }
  }

  async saveEvent(event) {
    if (!this.pool || !this.isConnected) return false;
    try {
      const query = `
        INSERT INTO bot_live_events (id, type, title, description, platform, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING;
      `;
      await this.pool.query(query, [
        event.id || `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        event.type || 'info',
        event.title || 'Evento da Live',
        event.description || '',
        event.platform || 'tiktok',
        event.timestamp || Date.now()
      ]);
      this.stats.eventsCount++;
      return true;
    } catch (e) {
      console.error('[Neon Save Event Error]:', e.message);
      return false;
    }
  }

  async saveSettings(key, value) {
    if (!this.pool || !this.isConnected) return false;
    try {
      const query = `
        INSERT INTO bot_settings (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = NOW();
      `;
      await this.pool.query(query, [key, JSON.stringify(value)]);
      return true;
    } catch (e) {
      console.error('[Neon Save Settings Error]:', e.message);
      return false;
    }
  }

  getStatus() {
    return {
      connected: this.isConnected,
      status: this.statusMessage,
      database: 'neondb (PostgreSQL 18.6)',
      provider: 'Neon Serverless Postgres',
      host: 'ep-snowy-dew-b4cyje9w-pooler.c-6.us-east-2.aws.neon.tech',
      stats: this.stats,
      lastSyncAt: this.lastSyncAt
    };
  }
}

module.exports = new NeonService();
