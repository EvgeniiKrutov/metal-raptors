import Phaser from 'phaser';
import { MusicConfig, MusicNoteEvent, MusicTrackConfig } from '../../types/game.types';
import { gameEvents, EVENTS } from '../Game';
import { getMusicById } from '../config/data/music/index';
import { isMusicEnabled } from '../utils/musicPreference';

const SCHEDULE_AHEAD_SEC = 0.25;
const TICK_MS = 60;
const START_DELAY_SEC = 0.08;
const DEFAULT_ATTACK = 0.01;
const DEFAULT_RELEASE = 0.05;
const GATE_RATIO = 0.9;
const DETUNE_VOICE_LEVEL = 0.5;
const NOISE_BUFFER_SEC = 1;
const NOISE_FILTER_HZ = 3500;
const NOISE_MAX_GATE_SEC = 0.25;
const GAME_OVER_FADE_MS = 800;

const NOTE_OFFSETS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function pitchToFrequency(pitch: string | number): number | null {
  if (typeof pitch === 'number') return pitch > 0 ? pitch : null;
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(pitch.trim());
  if (!match) return null;
  let semitone = NOTE_OFFSETS[match[1].toUpperCase()];
  if (match[2] === '#') semitone += 1;
  if (match[2] === 'b') semitone -= 1;
  const midi = (parseInt(match[3], 10) + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class MusicSystem {
  private scene: Phaser.Scene;
  private config: MusicConfig | null = null;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private timer: number | null = null;
  private fadeTimer: number | null = null;
  private activeSources = new Set<AudioScheduledSourceNode>();

  private patternIndex = 0;
  private nextPatternTime = 0;
  private patternDurations = new Map<string, number>();

  private introPlayed = false;
  private gameOver = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    gameEvents.on(EVENTS.TOGGLE_MUSIC, this.handleToggle, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  start(musicId?: string): void {
    if (!musicId) return;
    const config = getMusicById(musicId);
    if (!config || config.sequence.length === 0) return;

    this.config = config;
    this.patternDurations.clear();
    const secPerBeat = 60 / config.tempo;

    for (const [name, tracks] of Object.entries(config.patterns)) {
      let longest = 0;
      for (const notes of Object.values(tracks)) {
        const beats = notes.reduce((sum, note) => sum + note[1], 0);
        longest = Math.max(longest, beats);
      }
      this.patternDurations.set(name, longest * secPerBeat);
    }

    if (isMusicEnabled()) this.play(0);
  }

  enterGameOver(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.fadeOutAndStop(GAME_OVER_FADE_MS);
  }

  private handleToggle({ enabled }: { enabled: boolean }): void {
    if (enabled) {
      if (this.config && !this.gameOver && this.timer === null) {
        this.play(this.introPlayed ? (this.config.loopStart ?? 0) : 0);
      }
    } else {
      this.stop();
    }
  }

  private play(fromIndex: number): void {
    const config = this.config;
    if (!config) return;

    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') void ctx.resume();

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = config.volume;
    this.masterGain.connect(ctx.destination);

    this.patternIndex = Math.min(fromIndex, config.sequence.length - 1);
    this.nextPatternTime = ctx.currentTime + START_DELAY_SEC;

    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  private stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (this.fadeTimer !== null) {
      window.clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        void 0;
      }
    }
    this.activeSources.clear();
    this.masterGain?.disconnect();
    this.masterGain = null;
  }

  private fadeOutAndStop(durationMs: number): void {
    if (this.timer === null || !this.ctx || !this.masterGain) {
      this.stop();
      return;
    }
    const gain = this.masterGain.gain;
    gain.cancelScheduledValues(this.ctx.currentTime);
    gain.setValueAtTime(gain.value, this.ctx.currentTime);
    gain.linearRampToValueAtTime(0, this.ctx.currentTime + durationMs / 1000);
    this.fadeTimer = window.setTimeout(() => this.stop(), durationMs + 50);
  }

  private tick(): void {
    const config = this.config;
    const ctx = this.ctx;
    if (!config || !ctx) return;

    while (this.nextPatternTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const patternName = config.sequence[this.patternIndex];
      const duration = this.patternDurations.get(patternName) ?? 0;

      if (duration > 0) this.schedulePattern(patternName, this.nextPatternTime);

      this.nextPatternTime += duration;
      this.patternIndex += 1;
      if (this.patternIndex >= config.sequence.length) {
        this.introPlayed = true;
        this.patternIndex = Math.min(config.loopStart ?? 0, config.sequence.length - 1);
      }
      if (duration <= 0) break;
    }
  }

  private schedulePattern(patternName: string, startTime: number): void {
    const config = this.config;
    if (!config) return;

    const pattern = config.patterns[patternName];
    if (!pattern) return;

    const secPerBeat = 60 / config.tempo;

    for (const [trackName, notes] of Object.entries(pattern)) {
      const track = config.tracks[trackName];
      if (!track) continue;

      let time = startTime;
      for (const note of notes) {
        const duration = note[1] * secPerBeat;
        this.scheduleNote(track, note, time, duration);
        time += duration;
      }
    }
  }

  private scheduleNote(
    track: MusicTrackConfig,
    note: MusicNoteEvent,
    startTime: number,
    duration: number,
  ): void {
    const [pitch, , velocity = 1] = note;
    const level = track.volume * velocity;
    if (level <= 0) return;

    if (track.wave === 'noise') {
      this.scheduleNoise(track, level, startTime, duration);
      return;
    }

    if (pitch === null || pitch === 'rest') return;
    const frequency = pitchToFrequency(pitch);
    if (frequency === null) return;

    const detunes = track.detune ? [track.detune / 2, -track.detune / 2] : [0];
    const voiceLevel = detunes.length > 1 ? level * DETUNE_VOICE_LEVEL : level;

    for (const detune of detunes) {
      this.scheduleOscillator(track, frequency, detune, voiceLevel, startTime, duration);
    }
  }

  private scheduleOscillator(
    track: MusicTrackConfig,
    frequency: number,
    detune: number,
    level: number,
    startTime: number,
    duration: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain) return;

    const attack = track.attack ?? DEFAULT_ATTACK;
    const release = track.release ?? DEFAULT_RELEASE;
    const gateEnd = startTime + duration * GATE_RATIO;
    const sustainEnd = Math.max(startTime + attack, gateEnd - release);

    const osc = ctx.createOscillator();
    osc.type = track.wave as OscillatorType;
    osc.frequency.value = frequency;
    osc.detune.value = detune;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(level, startTime + attack);
    gain.gain.setValueAtTime(level, sustainEnd);
    gain.gain.linearRampToValueAtTime(0, gateEnd);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(startTime);
    osc.stop(gateEnd + 0.05);
    this.trackSource(osc);
  }

  private scheduleNoise(
    track: MusicTrackConfig,
    level: number,
    startTime: number,
    duration: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain) return;

    const attack = track.attack ?? DEFAULT_ATTACK / 2;
    const gateEnd = startTime + Math.min(duration * GATE_RATIO, NOISE_MAX_GATE_SEC);

    const source = ctx.createBufferSource();
    source.buffer = this.ensureNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = NOISE_FILTER_HZ;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(level, startTime + attack);
    gain.gain.linearRampToValueAtTime(0, gateEnd);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(startTime);
    source.stop(gateEnd + 0.05);
    this.trackSource(source);
  }

  private trackSource(source: AudioScheduledSourceNode): void {
    this.activeSources.add(source);
    source.onended = () => this.activeSources.delete(source);
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private ensureNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const length = Math.floor(ctx.sampleRate * NOISE_BUFFER_SEC);
      this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuffer;
  }

  private shutdown(): void {
    gameEvents.off(EVENTS.TOGGLE_MUSIC, this.handleToggle, this);
    this.stop();
    this.config = null;
    this.noiseBuffer = null;
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
