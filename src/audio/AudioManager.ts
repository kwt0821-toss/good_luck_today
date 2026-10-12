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
};

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
    if (!on) {
      void this.fadeOutAndStopBgm(this.config?.timing.bgmFadeOutMs ?? 400);
      return;
    }
    if (this.unlocked && !this.adMuted && !this.pageHidden) {
      this.setScreen(this.currentScreen, true);
    }
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
    this.stopAllSfx();
  }

  private onPageShow() {
    this.pageHidden = false;
    if (this.bgmEnabled && this.unlocked && !this.adMuted && this.desiredBgmId) {
      void this.crossfadeTo(this.desiredBgmId, true);
    }
  }

  onAdOpen() {
    this.adMuted = true;
    void this.fadeOutAndStopBgm(120);
    this.stopAllSfx();
  }

  onAdClose() {
    this.adMuted = false;
    if (this.bgmEnabled && this.unlocked && !this.pageHidden && this.desiredBgmId) {
      void this.crossfadeTo(this.desiredBgmId, true);
    }
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
