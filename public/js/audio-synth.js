// Web Audio API Sound Synthesizer for OBS Widgets & Dashboard
// Distinct realistic coffee sounds (pouring, beans dropping, steam, cup clink) + musical chimes

class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Synthesize realistic coffee stream pouring into ceramic/porcelain cup
  // pitchSweep simulates liquid level rising in the cup!
  _synthesizePour({ duration = 1.2, startFreq = 650, endFreq = 1350, volume = 0.22, bubbleCount = 4 } = {}) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Filtered white noise stream
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (0.8 + 0.2 * Math.sin(i / 80));
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    // Liquid resonance filter rising as cup fills
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(startFreq, now);
    filter.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    filter.Q.setValueAtTime(3.8, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.15);
    gain.gain.setValueAtTime(volume, now + duration - 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noiseSource.start(now);
    noiseSource.stop(now + duration);

    // Occasional droplet / splash bubbles
    for (let b = 0; b < bubbleCount; b++) {
      const bTime = now + 0.15 + (b * (duration - 0.3) / bubbleCount) + (Math.random() * 0.05);
      const bOsc = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      const bubbleFreq = 800 + Math.random() * 600;

      bOsc.type = 'sine';
      bOsc.frequency.setValueAtTime(bubbleFreq, bTime);
      bOsc.frequency.exponentialRampToValueAtTime(bubbleFreq * 1.5, bTime + 0.04);

      bGain.gain.setValueAtTime(0.08 * volume, bTime);
      bGain.gain.exponentialRampToValueAtTime(0.0001, bTime + 0.05);

      bOsc.connect(bGain);
      bGain.connect(this.ctx.destination);
      bOsc.start(bTime);
      bOsc.stop(bTime + 0.06);
    }
  }

  // Single porcelain cup clink
  _playCupClink(timeOffset = 0, freq = 2100, vol = 0.18) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + timeOffset;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  // Multiple coffee bean plops falling into cup
  _playBeanPlops(count = 3, timeOffset = 0) {
    if (!this.enabled || !this.ctx) return;
    const base = this.ctx.currentTime + timeOffset;

    for (let i = 0; i < count; i++) {
      const t = base + i * 0.09 + (Math.random() * 0.03);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const f = 900 + i * 150 + Math.random() * 100;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.3, t + 0.04);

      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    }
  }

  // 1. EVENT: FOLLOW
  // Light, crisp splash of coffee falling into cup + cheerful bright chime
  playFollowSound() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    // Coffee pour sound into cup (short & crisp)
    this._synthesizePour({ duration: 0.9, startFreq: 800, endFreq: 1400, volume: 0.18, bubbleCount: 3 });
    this._playCupClink(0.05, 2300, 0.12);

    // Warm friendly chime sequence (C5, E5, G5, B5)
    const notes = [523.25, 659.25, 783.99, 987.77];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + 0.3 + idx * 0.1;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  // 2. EVENT: DONATE / SUPER CHAT / BITS
  // Rhythmic beans clattering into cup + golden coin register bell + warm rich coffee stream
  playDonateSound() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    // Bean plops into cup
    this._playBeanPlops(4, 0);

    // Full rich coffee pour
    this._synthesizePour({ duration: 1.4, startFreq: 550, endFreq: 1200, volume: 0.24, bubbleCount: 6 });
    this._playCupClink(0.2, 2600, 0.2);

    // Golden reward bell chord (C6, E6, G6)
    const chord = [1046.50, 1318.51, 1567.98];
    chord.forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + 0.45;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.9);
    });
  }

  // 3. EVENT: GIFT (TIKTOK PRESENTE)
  // Coffee pour with multiple bean plops + magical sparkle arpeggio
  playGiftSound() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    this._playBeanPlops(5, 0.05);
    this._synthesizePour({ duration: 1.1, startFreq: 700, endFreq: 1500, volume: 0.22, bubbleCount: 5 });

    // Sparkle melodic flourish
    const notes = [659.25, 783.99, 987.77, 1318.51, 1567.98]; // E5 to G6
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + 0.25 + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  // 4. EVENT: METAS BATIDAS (LIKES / PRESENTES / CHUVA DE CAFEZINHOS)
  // Grand cascade of coffee filling mug + triumphant celebration fanfare
  playMilestoneSound() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    // Heavy cascade coffee pour
    this._synthesizePour({ duration: 1.8, startFreq: 450, endFreq: 1300, volume: 0.28, bubbleCount: 8 });
    this._playCupClink(0.1, 2200, 0.2);
    this._playCupClink(0.35, 2400, 0.18);

    // Triumph Fanfare Arpeggio: C5 -> G5 -> C6 -> E6 -> G6 (Epic crescendo)
    const fanfare = [
      { f: 523.25, t: 0.3, d: 0.2 },
      { f: 659.25, t: 0.45, d: 0.2 },
      { f: 783.99, t: 0.6, d: 0.25 },
      { f: 1046.50, t: 0.8, d: 0.3 },
      { f: 1318.51, t: 1.05, d: 0.35 },
      { f: 1567.98, t: 1.35, d: 0.7 }
    ];

    fanfare.forEach(item => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = this.ctx.currentTime + item.t;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(item.f, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.24, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + item.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + item.d + 0.05);
    });
  }

  // 5. EVENT: SUB / MEMBRO / FÃ CLUBE
  // Velvety espresso extraction hiss + royal warm chord
  playSubSound() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    // Espresso extraction steam hiss & pour
    this._synthesizePour({ duration: 1.5, startFreq: 600, endFreq: 1250, volume: 0.25, bubbleCount: 5 });

    // Majestic chord (F4, A4, C5, E5, A5)
    const subChord = [349.23, 440.00, 523.25, 659.25, 880.00];
    subChord.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + 0.4;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 1.2);
    });
  }

  // 6. EVENT: CAFÉ SERVIDO (!cafe)
  playCoffeePour() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    this._synthesizePour({ duration: 1.3, startFreq: 750, endFreq: 1400, volume: 0.22, bubbleCount: 4 });
    this._playCupClink(0.2, 2200, 0.15);

    // Cozy warm chime
    setTimeout(() => {
      this.playChime(659.25, 0.5);
    }, 450);
  }

  // Simple Chime helper
  playChime(freq = 880, duration = 0.5) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // Route any event type to the distinct coffee audio
  playEventSound(type) {
    const t = (type || '').toLowerCase();
    if (t === 'follow') {
      this.playFollowSound();
    } else if (t === 'donate' || t === 'superchat' || t === 'bits') {
      this.playDonateSound();
    } else if (t === 'gift') {
      this.playGiftSound();
    } else if (t === 'sub' || t === 'member' || t === 'fan_club') {
      this.playSubSound();
    } else if (t === 'milestone' || t === 'like_goal' || t === 'rain' || t === 'jackpot') {
      this.playMilestoneSound();
    } else if (t === 'coffee') {
      this.playCoffeePour();
    } else {
      this.playFollowSound();
    }
  }
}

window.SoundFX = new SoundFX();
