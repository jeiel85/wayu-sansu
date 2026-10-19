// Web Audio API Procedural Korean Traditional Soundscape (가야금·풍경·물소리·조형 효과음)
export class GuGakAudio {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.ambientTimer = null;
    this.windGain = null;
    // Traditional Pyeongjo / Gyemyeonjo Pentatonic Frequencies (궁·상·각·치·우)
    this.scale = [196.00, 220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) {
      this.init();
      this.startAmbient();
      this.playPluck(523.25, 0.14);
    } else {
      this.stopAmbient();
    }
  }

  startAmbient() {
    if (!this.ctx) return;
    this.stopAmbient();

    // Gentle wind / water stream noise
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 0.15;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = 1.8;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.04;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
    this.windNode = noise;
    this.windGain = gain;

    // Periodic Gayageum & Wind-bell (풍경) notes
    this.ambientTimer = setInterval(() => {
      if (!this.enabled || !this.ctx) return;
      const r = Math.random();
      if (r < 0.65) {
        const freq = this.scale[Math.floor(Math.random() * this.scale.length)];
        this.playPluck(freq, 0.07 + Math.random() * 0.05);
        if (Math.random() < 0.35) {
          setTimeout(() => {
            if (this.enabled) {
              const fifth = freq * 1.5;
              this.playPluck(fifth, 0.05);
            }
          }, 260);
        }
      } else if (r < 0.85) {
        this.playWindBell();
      }
    }, 2400);
  }

  stopAmbient() {
    if (this.ambientTimer) {
      clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
    if (this.windNode) {
      try { this.windNode.stop(); } catch (_) {}
      this.windNode = null;
    }
  }

  // Gayageum string pluck sound
  playPluck(freq = 392, volume = 0.08) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc2.type = 'sine';
    // Slight pitch bend at attack like Gayageum 농현 (vibrato/bend)
    osc.frequency.setValueAtTime(freq * 0.985, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.08);
    osc2.frequency.setValueAtTime(freq * 2, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 5, now);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.3, now + 1.4);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 2.2);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 2.3);
    osc2.stop(now + 2.3);
  }

  // Temple Eaves Wind-Bell (산사 풍경소리)
  playWindBell(volume = 0.045) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const base = 1174.66; // D6
    [1, 1.51, 2.42].forEach((ratio, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base * ratio, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(volume / (idx + 1), now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 2.6 - idx * 0.4);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 2.7);
    });
  }

  // Subtle sound when a house or tree pops up
  playSprout(index = 0) {
    if (!this.enabled) return;
    this.init();
    const freq = this.scale[index % this.scale.length];
    this.playPluck(freq, 0.045);
  }
}
