export type AudioScreen =
  | "home"
  | "collection"
  | "menu"
  | "reveal"
  | "draw"
  | "rates"
  | "room"
  | string;

type SoundEntry = {
  file: string;
  volume: number;
  loopStart?: number;
  loopEndSec?: number;
  useFor?: string[];
  cooldownSec?: number;
  labelKo?: string;
};

type SoundsConfig = {
  _version?: string;
  basePath?: string;
  masterVolume: number;
  formats: { preferred: string; fallback: string; probe: string };
  timing: {
    bgmFadeInMs: number;
    bgmCrossfadeMs: number;
    bgmFadeOutMs: number;
    tapDebounceMs: number;
    maxConcurrentSfx: number;
    meowCooldownSec?: number;
  };
  bgm: Record<string, SoundEntry>;
  sfx: Record<string, SoundEntry>;
  screenBgm: Record<string, string>;
  /** 방 환경음. 그 방에 처음 들어갈 때만 파일 하나를 받는다. */
  ambience?: Record<string, SoundEntry>;
};

const AMBIENCE_FADE_MS = 600;
/** 배경음과 같이 들릴 때 환경음에 곱하는 비율. */
const AMBIENCE_BGM_DUCK = 0.7;

const BGM_KEY = "lc.audio.bgm";
const SFX_KEY = "lc.audio.sfx";
const CONFIG_URL = "/assets/audio/sounds.json";

type ActiveSfx = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};

type BgmSlot = {
  source: AudioBufferSourceNode | null;
  gain: GainNode;
  id: string | null;
};

function readFlag(key: string, defaultOn: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return defaultOn;
    return raw === "1";
  } catch {
    return defaultOn;
  }
}

function writeFlag(key: string, on: boolean) {
  try {
    window.localStorage.setItem(key, on ? "1" : "0");
  } catch {
    // ignore
  }
}

function pickExt(probe: string): "m4a" | "mp3" {
  try {
    const a = document.createElement("audio");
    const can = a.canPlayType(probe);
    if (can === "probably" || can === "maybe") return "m4a";
  } catch {
    // fall through
  }
  return "mp3";
}

class AudioManagerImpl {
  private config: SoundsConfig | null = null;
  private loadPromise: Promise<void> | null = null;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private decoding = new Map<string, Promise<AudioBuffer | null>>();
  private ext: "m4a" | "mp3" = "mp3";
  private unlocked = false;
  private bgmEnabled = readFlag(BGM_KEY, false);
  private sfxEnabled = readFlag(SFX_KEY, true);
  private adMuted = false;
  private pageHidden = false;
  private currentScreen: AudioScreen = "home";
  private desiredBgmId: string | null = null;
  private lastTapAt = 0;
  private activeSfx: ActiveSfx[] = [];
  private meowCooldown = new Map<string, number>();
  private slots: [BgmSlot, BgmSlot] | null = null;
  private activeSlot = 0;
  private fadeToken = 0;
  /** 분위기 창의 방 소리. 배경음 스위치와 따로이고 기본은 꺼짐. */
  private ambienceOn = false;
  private ambienceRoom: string | null = null;
  private ambSlots: [BgmSlot, BgmSlot] | null = null;
  private ambActive = 0;
  private ambGen = 0;

  async init(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this.loadConfigAndBuffers();
    this.bindLifecycle();
    this.bindUnlock();
    return this.loadPromise;
  }

  private async loadConfigAndBuffers() {
    const res = await fetch(CONFIG_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error("sounds.json missing");
    this.config = (await res.json()) as SoundsConfig;
    this.ext = pickExt(this.config.formats.probe);
    // Decode lazily on unlock / first play to avoid autoplay work before gesture.
  }

  private ensureContext() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) throw new Error("Web Audio unsupported");
    this.ctx = new Ctx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.config?.masterVolume ?? 1;
    this.masterGain.connect(this.ctx.destination);
    const g0 = this.ctx.createGain();
    const g1 = this.ctx.createGain();
    g0.gain.value = 0;
    g1.gain.value = 0;
    g0.connect(this.masterGain);
    g1.connect(this.masterGain);
    this.slots = [
      { source: null, gain: g0, id: null },
      { source: null, gain: g1, id: null },
    ];
    const a0 = this.ctx.createGain();
    const a1 = this.ctx.createGain();
    a0.gain.value = 0;
    a1.gain.value = 0;
    a0.connect(this.masterGain);
    a1.connect(this.masterGain);
    this.ambSlots = [
      { source: null, gain: a0, id: null },
      { source: null, gain: a1, id: null },
    ];
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = "ambient";
    } catch {
      // optional
    }
    return this.ctx;
  }

  private bindUnlock() {
    const unlock = () => {
      void this.unlock().then(() => {
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("touchend", unlock);
      });
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("touchend", unlock, { passive: true });
  }

  private bindLifecycle() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.onPageHide();
      } else {
        this.onPageShow();
      }
    });
    window.addEventListener("pagehide", () => this.onPageHide());
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return;
    await this.init();
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }
    this.unlocked = true;
    await this.preloadAll();
    if (this.bgmEnabled && !this.adMuted && !this.pageHidden) {
      this.setScreen(this.currentScreen, true);
    }
    this.applyAmbience();
  }

  private fileUrl(file: string): string {
    const base = (this.config?.basePath ?? "/assets/audio").replace(/\/$/, "");
    return `${base}/${file}.${this.ext}`;
  }

  private async decode(file: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(file)) return this.buffers.get(file)!;
    const ctx = this.ensureContext();
    try {
      const res = await fetch(this.fileUrl(file));
      if (!res.ok) return null;
      const raw = await res.arrayBuffer();
      const buffer = await ctx.decodeAudioData(raw.slice(0));
      this.buffers.set(file, buffer);
      return buffer;
    } catch {
      return null;
    }
  }

  /** 환경음만 확장자를 바꿔 다시 받는다. 배경음 캐시 키는 그대로 둔다. */
  private async decodeExt(file: string, ext: "m4a" | "mp3"): Promise<AudioBuffer | null> {
    const key = `${file}.${ext}`;
    const cached = this.buffers.get(key);
    if (cached) return cached;
    const pending = this.decoding.get(key);
    if (pending) return pending;
    const job = this.fetchExt(key, file, ext);
    this.decoding.set(key, job);
    try {
      return await job;
    } finally {
      this.decoding.delete(key);
    }
  }

  private async fetchExt(key: string, file: string, ext: "m4a" | "mp3"): Promise<AudioBuffer | null> {
    const ctx = this.ensureContext();
    const base = (this.config?.basePath ?? "/assets/audio").replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/${file}.${ext}`);
      if (!res.ok) return null;
      const raw = await res.arrayBuffer();
      const buffer = await ctx.decodeAudioData(raw.slice(0));
      this.buffers.set(key, buffer);
      return buffer;
    } catch {
      return null;
    }
  }

  private async decodeAmbience(file: string): Promise<AudioBuffer | null> {
    const first = await this.decodeExt(file, this.ext);
    if (first) return first;
    return this.decodeExt(file, this.ext === "m4a" ? "mp3" : "m4a");
  }

  private async preloadAll() {
    if (!this.config) return;
    const files = new Set<string>();
    for (const entry of Object.values(this.config.bgm)) files.add(entry.file);
    for (const entry of Object.values(this.config.sfx)) files.add(entry.file);
    await Promise.all([...files].map((file) => this.decode(file)));
  }

  isBgmEnabled() {
    return this.bgmEnabled;
  }

  isSfxEnabled() {
    return this.sfxEnabled;
  }

  setBgmEnabled(on: boolean) {
    this.bgmEnabled = on;
    writeFlag(BGM_KEY, on);
    this.refreshAmbienceGain();
    if (!on) {
      void this.fadeOutAndStopBgm(this.config?.timing.bgmFadeOutMs ?? 400);
      return;
    }
    if (this.unlocked && !this.adMuted && !this.pageHidden) {
      this.setScreen(this.currentScreen, true);
    }
  }

  isAmbienceEnabled() {
    return this.ambienceOn;
  }

  /** 분위기 창의 방 소리 스위치. 배경음이 꺼져 있어도 이것만으로 켜진다. */
  setAmbienceEnabled(enabled: boolean) {
    this.ambienceOn = enabled;
    this.applyAmbience();
  }

  /** 지금 방의 환경음. null 이면 끈다. 방이 바뀌면 0.6초에 걸쳐 겹친다. */
  setAmbience(roomId: string | null) {
    this.ambienceRoom = roomId;
    this.applyAmbience();
  }

  /** 방과 스위치 값을 한 번에 반영한다. 방을 넘길 때 이전 방이 잠깐 켜지지 않게. */
  syncRoomAmbience(roomId: string | null, enabled: boolean) {
    this.ambienceRoom = roomId;
    this.ambienceOn = enabled;
    this.applyAmbience();
  }

  setSfxEnabled(on: boolean) {
    this.sfxEnabled = on;
    writeFlag(SFX_KEY, on);
    if (!on) this.stopAllSfx();
  }

  setScreen(screen: AudioScreen, forceFadeIn = false) {
    this.currentScreen = screen;
    if (!this.config) {
      void this.init().then(() => this.setScreen(screen, forceFadeIn));
      return;
    }
    const id = this.config.screenBgm[screen] ?? this.config.screenBgm.home ?? null;
    this.desiredBgmId = id;
    if (!this.unlocked || !this.bgmEnabled || this.adMuted || this.pageHidden || !id) return;
    void this.crossfadeTo(id, forceFadeIn);
  }

  private activeBgm(): BgmSlot | null {
    return this.slots?.[this.activeSlot] ?? null;
  }

  private async crossfadeTo(id: string, forceFadeIn = false) {
    if (!this.config || !this.slots) return;
    const entry = this.config.bgm[id];
    if (!entry) return;
    const current = this.activeBgm();
    if (current?.id === id && current.source && !forceFadeIn) return;

    const ctx = this.ensureContext();
    const buffer = await this.decode(entry.file);
    if (!buffer) return;

    const nextIndex = this.activeSlot ^ 1;
    const next = this.slots[nextIndex];
    const prev = this.slots[this.activeSlot];
    const token = ++this.fadeToken;

    if (next.source) {
      try {
        next.source.stop();
      } catch {
        // ignore
      }
      next.source = null;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = entry.loopStart ?? 0;
    source.loopEnd = entry.loopEndSec ?? buffer.duration;
    source.connect(next.gain);
    const target = entry.volume * (this.config.masterVolume ?? 1);
    const fadeMs = forceFadeIn
      ? this.config.timing.bgmFadeInMs
      : prev?.id
        ? this.config.timing.bgmCrossfadeMs
        : this.config.timing.bgmFadeInMs;
    const now = ctx.currentTime;
    next.gain.gain.cancelScheduledValues(now);
    next.gain.gain.setValueAtTime(0, now);
    next.gain.gain.linearRampToValueAtTime(target, now + fadeMs / 1000);
    source.start(0);
    next.source = source;
    next.id = id;

    if (prev && prev !== next) {
      prev.gain.gain.cancelScheduledValues(now);
      prev.gain.gain.setValueAtTime(prev.gain.gain.value, now);
      prev.gain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
      const stopping = prev.source;
      window.setTimeout(() => {
        if (token !== this.fadeToken) return;
        if (stopping) {
          try {
            stopping.stop();
          } catch {
            // ignore
          }
        }
        if (prev.source === stopping) {
          prev.source = null;
          prev.id = null;
        }
      }, fadeMs + 30);
    }

    this.activeSlot = nextIndex;
  }

  private async fadeOutAndStopBgm(ms: number) {
    if (!this.slots || !this.ctx) return;
    const token = ++this.fadeToken;
    const now = this.ctx.currentTime;
    for (const slot of this.slots) {
      slot.gain.gain.cancelScheduledValues(now);
      slot.gain.gain.setValueAtTime(slot.gain.gain.value, now);
      slot.gain.gain.linearRampToValueAtTime(0, now + ms / 1000);
    }
    window.setTimeout(() => {
      if (token !== this.fadeToken || !this.slots) return;
      for (const slot of this.slots) {
        if (slot.source) {
          try {
            slot.source.stop();
          } catch {
            // ignore
          }
          slot.source = null;
          slot.id = null;
        }
      }
    }, ms + 30);
  }

  private onPageHide() {
    this.pageHidden = true;
    void this.fadeOutAndStopBgm(this.config?.timing.bgmFadeOutMs ?? 400);
    this.fadeOutAmbience(this.config?.timing.bgmFadeOutMs ?? 400);
    this.stopAllSfx();
  }

  private onPageShow() {
    this.pageHidden = false;
    if (this.bgmEnabled && this.unlocked && !this.adMuted && this.desiredBgmId) {
      void this.crossfadeTo(this.desiredBgmId, true);
    }
    this.applyAmbience();
  }

  onAdOpen() {
    this.adMuted = true;
    void this.fadeOutAndStopBgm(120);
    this.fadeOutAmbience(120);
    this.stopAllSfx();
  }

  onAdClose() {
    this.adMuted = false;
    if (this.bgmEnabled && this.unlocked && !this.pageHidden && this.desiredBgmId) {
      void this.crossfadeTo(this.desiredBgmId, true);
    }
    this.applyAmbience();
  }

  private stopAllSfx() {
    for (const item of this.activeSfx) {
      try {
        item.source.stop();
      } catch {
        // ignore
      }
    }
    this.activeSfx = [];
  }

  private pruneSfx() {
    // Keep list tidy; ended nodes are removed via onended.
    const max = this.config?.timing.maxConcurrentSfx ?? 6;
    while (this.activeSfx.length > max) {
      const oldest = this.activeSfx.shift();
      if (!oldest) break;
      try {
        oldest.source.stop();
      } catch {
        // ignore
      }
    }
  }

  playSfx(id: string, opts?: { catId?: string; rarity?: string; volume?: number }) {
    if (!this.sfxEnabled || this.adMuted || !this.unlocked) return;
    if (!this.config) {
      void this.init().then(() => this.playSfx(id, opts));
      return;
    }

    let key = id;
    if (id === "reveal" || id === "reveal-rare") {
      key = this.resolveReveal(opts?.rarity) ?? id;
    }
    if (key === "tap") {
      const now = performance.now();
      const debounce = this.config.timing.tapDebounceMs ?? 80;
      if (now - this.lastTapAt < debounce) return;
      this.lastTapAt = now;
    }
    if (key === "meow") {
      const catId = opts?.catId ?? "default";
      const cooldown =
        (this.config.sfx.meow?.cooldownSec ?? this.config.timing.meowCooldownSec ?? 8) * 1000;
      const last = this.meowCooldown.get(catId) ?? 0;
      const now = Date.now();
      if (now - last < cooldown) return;
      this.meowCooldown.set(catId, now);
    }

    const entry = this.config.sfx[key];
    if (!entry) return;
    void this.playBuffer(entry, opts?.volume);
  }

  private resolveReveal(rarity?: string): string | null {
    if (!this.config || !rarity) return "reveal";
    for (const [id, entry] of Object.entries(this.config.sfx)) {
      if (entry.useFor?.includes(rarity)) return id;
    }
    return "reveal";
  }

  private async playBuffer(entry: SoundEntry, volumeScale = 1) {
    try {
      const ctx = this.ensureContext();
      if (ctx.state === "suspended") await ctx.resume();
      const buffer = await this.decode(entry.file);
      if (!buffer || !this.masterGain) return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const scale = Number.isFinite(volumeScale) ? Math.max(0, volumeScale) : 1;
      gain.gain.value = entry.volume * scale * (this.config?.masterVolume ?? 1);
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(this.masterGain);
      const active: ActiveSfx = { source, gain };
      this.activeSfx.push(active);
      this.pruneSfx();
      source.onended = () => {
        this.activeSfx = this.activeSfx.filter((item) => item !== active);
      };
      source.start(0);
    } catch {
      // ignore decode/play failures
    }
  }

  private ambienceTarget(entry: SoundEntry): number {
    const duck = this.bgmEnabled ? AMBIENCE_BGM_DUCK : 1;
    return entry.volume * (this.config?.masterVolume ?? 1) * duck;
  }

  private applyAmbience() {
    if (!this.config) {
      void this.init().then(() => this.applyAmbience());
      return;
    }
    const roomId = this.ambienceRoom;
    const canPlay = Boolean(roomId && this.ambienceOn && this.unlocked && !this.adMuted && !this.pageHidden);
    if (!canPlay || !roomId) {
      this.fadeOutAmbience(roomId ? 400 : AMBIENCE_FADE_MS);
      return;
    }
    void this.startAmbience(roomId);
  }

  private refreshAmbienceGain() {
    if (!this.ambSlots || !this.ctx || !this.config || !this.ambienceRoom || !this.ambienceOn) return;
    const entry = this.config.ambience?.[this.ambienceRoom];
    const slot = this.ambSlots[this.ambActive];
    if (!entry || !slot?.source) return;
    const now = this.ctx.currentTime;
    const target = this.ambienceTarget(entry);
    slot.gain.gain.cancelScheduledValues(now);
    slot.gain.gain.setValueAtTime(slot.gain.gain.value, now);
    slot.gain.gain.linearRampToValueAtTime(target, now + 0.2);
  }

  private fadeOutAmbience(ms: number) {
    const gen = ++this.ambGen;
    if (!this.ambSlots || !this.ctx) return;
    const playing = this.ambSlots.some((slot) => slot.source);
    if (!playing) return;
    const now = this.ctx.currentTime;
    for (const slot of this.ambSlots) {
      slot.gain.gain.cancelScheduledValues(now);
      slot.gain.gain.setValueAtTime(slot.gain.gain.value, now);
      slot.gain.gain.linearRampToValueAtTime(0, now + ms / 1000);
    }
    window.setTimeout(() => {
      if (gen !== this.ambGen || !this.ambSlots) return;
      for (const slot of this.ambSlots) this.stopAmbienceSlot(slot);
    }, ms + 40);
  }

  private stopAmbienceSlot(slot: BgmSlot) {
    if (!slot.source) return;
    try {
      slot.source.stop();
    } catch {
      // ignore
    }
    slot.source = null;
    slot.id = null;
  }

  private async startAmbience(roomId: string) {
    const config = this.config;
    const entry = config?.ambience?.[roomId];
    if (!config || !entry) {
      this.fadeOutAmbience(400);
      return;
    }
    const current = this.ambSlots?.[this.ambActive];
    if (current?.id === roomId && current.source) {
      this.refreshAmbienceGain();
      return;
    }
    const gen = ++this.ambGen;
    const ctx = this.ensureContext();
    const buffer = await this.decodeAmbience(entry.file);
    if (gen !== this.ambGen) return;
    if (!buffer || !this.ambSlots) return;
    if (this.ambienceRoom !== roomId || !this.ambienceOn || this.adMuted || this.pageHidden || !this.unlocked) return;

    const nextIndex = this.ambActive ^ 1;
    const next = this.ambSlots[nextIndex];
    const prev = this.ambSlots[this.ambActive];
    this.stopAmbienceSlot(next);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const loopStart = entry.loopStart ?? 0;
    const loopEnd = Math.min(entry.loopEndSec && entry.loopEndSec > 0 ? entry.loopEndSec : buffer.duration, buffer.duration);
    source.loopStart = loopStart;
    if (loopEnd > loopStart + 0.05) source.loopEnd = loopEnd;
    source.connect(next.gain);
    const target = this.ambienceTarget(entry);
    const now = ctx.currentTime;
    next.gain.gain.cancelScheduledValues(now);
    next.gain.gain.setValueAtTime(0, now);
    next.gain.gain.linearRampToValueAtTime(target, now + AMBIENCE_FADE_MS / 1000);
    try {
      source.start(0);
    } catch {
      return;
    }
    next.source = source;
    next.id = roomId;

    if (prev && prev !== next && prev.source) {
      prev.gain.gain.cancelScheduledValues(now);
      prev.gain.gain.setValueAtTime(prev.gain.gain.value, now);
      prev.gain.gain.linearRampToValueAtTime(0, now + AMBIENCE_FADE_MS / 1000);
      const stopping = prev;
      window.setTimeout(() => {
        if (gen !== this.ambGen) return;
        if (this.ambSlots?.[this.ambActive] === stopping) return;
        this.stopAmbienceSlot(stopping);
      }, AMBIENCE_FADE_MS + 40);
    }
    this.ambActive = nextIndex;
  }

  /** Global tap capture for buttons/icons (pointerup). */
  installTapCapture(root: ParentNode = document) {
    root.addEventListener(
      "pointerup",
      (event) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        const hit = target.closest("button, [role='button'], a, .main-nav-btn, .menu-row, .lucky-cell");
        if (!hit) return;
        this.playSfx("tap");
      },
      true,
    );
  }
}

export const AudioManager = new AudioManagerImpl();

export function audioStorageKeys() {
  return { bgm: BGM_KEY, sfx: SFX_KEY } as const;
}
