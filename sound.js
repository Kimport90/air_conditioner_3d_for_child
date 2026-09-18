// sound.js - Процедурный синтезатор звуков кондиционера (Web Audio API)

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.compressorOsc = null;
        this.compressorSubOsc = null;
        this.compressorGain = null;
        this.compressorFilter = null;
        this.windSource = null;
        this.windGain = null;
        this.windFilter = null;
        this.isCompressorRunning = false;
        this.targetRpmRatio = 1.0; // 0.5 - 1.8
        this.currentRpmRatio = 1.0;
    }

    init() {
        if (this.ctx) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
            this.setupCompressor();
            this.setupWind();
        } catch (e) {
            console.warn("Web Audio API not supported", e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.ctx) {
            if (this.isMuted) {
                if (this.compressorGain) this.compressorGain.gain.setValueAtTime(0, this.ctx.currentTime);
                if (this.windGain) this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);
            } else {
                this.updateVolumes();
            }
        }
        return this.isMuted;
    }

    // Писк пульта ДУ (характерный электронный двухтональный "пик")
    playRemoteBeep() {
        this.init();
        this.resume();
        if (this.isMuted || !this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.setValueAtTime(2400, now + 0.04);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.12);
    }

    // Приятный колокольчик при клике на деталь
    playChime() {
        this.init();
        this.resume();
        if (this.isMuted || !this.ctx) return;

        const now = this.ctx.currentTime;
        const freqs = [523.25, 659.25, 783.99, 1046.50]; // C-E-G-C аккорд
        freqs.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.03);

            const startT = now + idx * 0.03;
            gain.gain.setValueAtTime(0.08, startT);
            gain.gain.exponentialRampToValueAtTime(0.0001, startT + 0.4);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(startT);
            osc.stop(startT + 0.4);
        });
    }

    // Низкий рокочущий звук компрессора
    setupCompressor() {
        if (!this.ctx) return;

        // Основной тон компрессора
        this.compressorOsc = this.ctx.createOscillator();
        this.compressorOsc.type = 'sawtooth';
        this.compressorOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // Базовая частота 55 Гц

        // Саб-осциллятор для вибрации корпуса
        this.compressorSubOsc = this.ctx.createOscillator();
        this.compressorSubOsc.type = 'triangle';
        this.compressorSubOsc.frequency.setValueAtTime(27.5, this.ctx.currentTime);

        // Фильтр низких частот
        this.compressorFilter = this.ctx.createBiquadFilter();
        this.compressorFilter.type = 'lowpass';
        this.compressorFilter.frequency.setValueAtTime(140, this.ctx.currentTime);
        this.compressorFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

        // LFO для легкой вибрации компрессора
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(8, this.ctx.currentTime);
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(6, this.ctx.currentTime);
        lfo.connect(this.compressorOsc.frequency);
        lfo.start();

        this.compressorGain = this.ctx.createGain();
        this.compressorGain.gain.setValueAtTime(0, this.ctx.currentTime);

        this.compressorOsc.connect(this.compressorFilter);
        this.compressorSubOsc.connect(this.compressorFilter);
        this.compressorFilter.connect(this.compressorGain);
        this.compressorGain.connect(this.ctx.destination);

        this.compressorOsc.start();
        this.compressorSubOsc.start();
    }

    // Шелест воздуха (шумовой генератор)
    setupWind() {
        if (!this.ctx) return;

        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        this.windSource = this.ctx.createBufferSource();
        this.windSource.buffer = noiseBuffer;
        this.windSource.loop = true;

        this.windFilter = this.ctx.createBiquadFilter();
        this.windFilter.type = 'bandpass';
        this.windFilter.frequency.setValueAtTime(650, this.ctx.currentTime);
        this.windFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

        this.windGain = this.ctx.createGain();
        this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);

        this.windSource.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windGain.connect(this.ctx.destination);

        this.windSource.start();
    }

    // Запуск/остановка работы компрессора и вентилятора с реалистичной инерцией звука
    setPower(isOn) {
        this.init();
        this.resume();
        this.isCompressorRunning = isOn;

        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        if (isOn) {
            // Плавный разгон звука за 2.5 секунды
            const targetBaseFreq = 50 * this.targetRpmRatio;
            const targetCompGain = 0.12 * Math.min(1.5, this.targetRpmRatio);
            const targetWindGain = 0.09 * Math.min(1.5, this.targetRpmRatio);

            if (this.compressorOsc) {
                this.compressorOsc.frequency.cancelScheduledValues(now);
                this.compressorOsc.frequency.setValueAtTime(20, now);
                this.compressorOsc.frequency.exponentialRampToValueAtTime(targetBaseFreq, now + 2.5);

                this.compressorSubOsc.frequency.cancelScheduledValues(now);
                this.compressorSubOsc.frequency.setValueAtTime(10, now);
                this.compressorSubOsc.frequency.exponentialRampToValueAtTime(targetBaseFreq / 2, now + 2.5);

                this.compressorFilter.frequency.cancelScheduledValues(now);
                this.compressorFilter.frequency.setValueAtTime(50, now);
                this.compressorFilter.frequency.exponentialRampToValueAtTime(130 * this.targetRpmRatio, now + 2.5);
            }

            if (this.windFilter) {
                this.windFilter.frequency.cancelScheduledValues(now);
                this.windFilter.frequency.setValueAtTime(300, now);
                this.windFilter.frequency.linearRampToValueAtTime(600 + 400 * (this.targetRpmRatio - 0.5), now + 2.2);
            }

            if (this.compressorGain) {
                this.compressorGain.gain.cancelScheduledValues(now);
                this.compressorGain.gain.setValueAtTime(0.001, now);
                this.compressorGain.gain.exponentialRampToValueAtTime(targetCompGain, now + 2.5);
            }

            if (this.windGain) {
                this.windGain.gain.cancelScheduledValues(now);
                this.windGain.gain.setValueAtTime(0.001, now);
                this.windGain.gain.exponentialRampToValueAtTime(targetWindGain, now + 2.2);
            }
        } else {
            // Плавное затухание звука с падением оборотов за 3.2 секунды
            if (this.compressorOsc) {
                this.compressorOsc.frequency.cancelScheduledValues(now);
                this.compressorOsc.frequency.exponentialRampToValueAtTime(14, now + 3.2);

                this.compressorSubOsc.frequency.cancelScheduledValues(now);
                this.compressorSubOsc.frequency.exponentialRampToValueAtTime(7, now + 3.2);

                this.compressorFilter.frequency.cancelScheduledValues(now);
                this.compressorFilter.frequency.exponentialRampToValueAtTime(30, now + 3.0);
            }

            if (this.windFilter) {
                this.windFilter.frequency.cancelScheduledValues(now);
                this.windFilter.frequency.linearRampToValueAtTime(180, now + 3.0);
            }

            if (this.compressorGain) {
                this.compressorGain.gain.cancelScheduledValues(now);
                this.compressorGain.gain.linearRampToValueAtTime(0, now + 3.4);
            }

            if (this.windGain) {
                this.windGain.gain.cancelScheduledValues(now);
                this.windGain.gain.linearRampToValueAtTime(0, now + 3.0);
            }
        }
    }

    setSpeed(rpmRatio) {
        this.targetRpmRatio = rpmRatio;
        this.updateFrequencies();
    }

    updateVolumes() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const targetCompGain = this.isCompressorRunning ? 0.12 * Math.min(1.5, this.targetRpmRatio) : 0.0;
        const targetWindGain = this.isCompressorRunning ? 0.09 * Math.min(1.5, this.targetRpmRatio) : 0.0;

        if (this.compressorGain) {
            this.compressorGain.gain.cancelScheduledValues(now);
            this.compressorGain.gain.linearRampToValueAtTime(targetCompGain, now + 0.8);
        }
        if (this.windGain) {
            this.windGain.gain.cancelScheduledValues(now);
            this.windGain.gain.linearRampToValueAtTime(targetWindGain, now + 0.6);
        }
    }

    updateFrequencies() {
        if (!this.ctx || !this.isCompressorRunning) return;
        const now = this.ctx.currentTime;
        const baseFreq = 50 * this.targetRpmRatio;
        if (this.compressorOsc) {
            this.compressorOsc.frequency.linearRampToValueAtTime(baseFreq, now + 0.5);
            this.compressorSubOsc.frequency.linearRampToValueAtTime(baseFreq / 2, now + 0.5);
            this.compressorFilter.frequency.linearRampToValueAtTime(120 * this.targetRpmRatio, now + 0.5);
        }
        if (this.windFilter) {
            this.windFilter.frequency.linearRampToValueAtTime(600 + 400 * (this.targetRpmRatio - 0.5), now + 0.5);
        }
        this.updateVolumes();
    }
}

window.soundEngine = new SoundEngine();
