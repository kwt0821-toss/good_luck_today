import Matter from "matter-js";

import { MERGE_SCORE, RADIUS_FRAC } from "./types";

const STEP_MS = 1000 / 120;
const BASE_DELTA = 1000 / 60;
const MAX_STEPS = 6;
const MAX_STEP_PX = 6;
const WALL = 72;
type LiveBody = Matter.Body & {
  positionPrev: Matter.Vector;
  deltaTime: number;
};

const SLOW_PX = 0.72;
const SLOW_RELEASE_PX = 1.35;
const BLINK_PX = 1.2;

type FruitMeta = {
  tier: number;
  radius: number;
  dangerFrom: number;
};

type Sim = {
  engine: Matter.Engine;
  bodies: Map<number, Matter.Body>;
  meta: Map<number, FruitMeta>;
  pending: Set<string>;
  radii: number[];
  width: number;
  height: number;
  dangerY: number;
  dangerHoldMs: number;
  dropCooldownMs: number;
  dropTiersMax: number;
  nextDropAt: number;
  aimX: number;
  score: number;
  merges: number;
  madeWatermelon: boolean;
  danger: boolean;
  over: boolean;
  dead: boolean;
  acc: number;
  onCollision: (event: Matter.IEventCollision<Matter.Engine>) => void;
};

export type SuikaSim = Sim;

export type SuikaFruitView = {
  id: number;
  tier: number;
  x: number;
  y: number;
  r: number;
  angle: number;
};

export type SuikaPop = {
  x: number;
  y: number;
  r: number;
  tier: number;
};

export type SuikaView = {
  fruits: SuikaFruitView[];
  width: number;
  height: number;
  dangerY: number;
  danger: boolean;
  over: boolean;
  score: number;
  merges: number;
  madeWatermelon: boolean;
  aimX: number;
  dropReady: boolean;
};

export type SuikaCreateOptions = {
  width: number;
  height: number;
  dropCooldownMs: number;
  dangerHoldMs: number;
  boxWidthInWatermelons: number;
  dropTiersMax: number;
};

export function createSuika(options: SuikaCreateOptions): SuikaSim {
  const width = Math.max(120, options.width);
  const height = Math.max(180, options.height);
  const ratio = options.boxWidthInWatermelons > 0 ? options.boxWidthInWatermelons : 2.25;
  const watermelonR = width / (ratio * 2);
  const radii = RADIUS_FRAC.map((frac) => frac * watermelonR);
  const engine = Matter.Engine.create({
    enableSleeping: false,
    positionIterations: 10,
    velocityIterations: 8,
    gravity: { x: 0, y: 1, scale: 0.00055 },
  });
  const sim: Sim = {
    engine,
    bodies: new Map(),
    meta: new Map(),
    pending: new Set(),
    radii,
    width,
    height,
    dangerY: height * 0.16,
    dangerHoldMs: options.dangerHoldMs,
    dropCooldownMs: options.dropCooldownMs,
    dropTiersMax: options.dropTiersMax,
    nextDropAt: 0,
    aimX: width / 2,
    score: 0,
    merges: 0,
    madeWatermelon: false,
    danger: false,
    over: false,
    dead: false,
    acc: 0,
    onCollision: () => undefined,
  };
  sim.onCollision = (event) => queueContacts(sim, event);
  Matter.Events.on(engine, "collisionStart", sim.onCollision);
  addWalls(sim);
  return sim;
}

export function aimSuika(sim: SuikaSim, x: number, tier: number) {
  if (sim.dead) return;
  const radius = sim.radii[clampTier(tier)] ?? sim.radii[1];
  const pad = radius + 1;
  sim.aimX = Math.min(sim.width - pad, Math.max(pad, x));
}

export function canDropSuika(sim: SuikaSim, now: number): boolean {
  return !sim.dead && !sim.over && now >= sim.nextDropAt && sim.bodies.size < 40;
}

export function dropSuika(sim: SuikaSim, tier: number, now: number): boolean {
  if (!canDropSuika(sim, now)) return false;
  const safeTier = Math.min(sim.dropTiersMax, Math.max(1, Math.floor(tier)));
  const radius = sim.radii[safeTier] ?? sim.radii[1];
  const body = spawnFruit(sim, safeTier, sim.aimX, -radius * 0.15);
  (body as LiveBody).deltaTime = STEP_MS;
  Matter.Body.setVelocity(body, { x: (Math.random() - 0.5) * 0.2, y: 4.2 });
  sim.nextDropAt = now + sim.dropCooldownMs;
  return true;
}

export function stepSuika(sim: SuikaSim, dtMs: number, now: number): SuikaPop[] {
  if (sim.dead || sim.over) return [];
  sim.acc += Math.max(0, Math.min(48, dtMs));
  const pops: SuikaPop[] = [];
  let steps = 0;
  while (sim.acc >= STEP_MS && steps < MAX_STEPS) {
    sim.acc -= STEP_MS;
    Matter.Engine.update(sim.engine, STEP_MS);
    for (const body of sim.bodies.values()) capMotion(body);
    pops.push(...resolveMerges(sim));
    steps += 1;
  }
  if (steps === MAX_STEPS) sim.acc = 0;
  updateDanger(sim, now);
  return pops;
}

export function readSuika(sim: SuikaSim, now: number): SuikaView {
  const fruits: SuikaFruitView[] = [];
  for (const [id, body] of sim.bodies) {
    const meta = sim.meta.get(id);
    if (!meta) continue;
    fruits.push({
      id,
      tier: meta.tier,
      x: body.position.x,
      y: body.position.y,
      r: meta.radius,
      angle: body.angle,
    });
  }
  return {
    fruits,
    width: sim.width,
    height: sim.height,
    dangerY: sim.dangerY,
    danger: sim.danger,
    over: sim.over,
    score: sim.score,
    merges: sim.merges,
    madeWatermelon: sim.madeWatermelon,
    aimX: sim.aimX,
    dropReady: canDropSuika(sim, now),
  };
}

export function destroySuika(sim: SuikaSim) {
  if (sim.dead) return;
  sim.dead = true;
  sim.over = true;
  Matter.Events.off(sim.engine, "collisionStart", sim.onCollision);
  Matter.Composite.clear(sim.engine.world, false, true);
  Matter.Engine.clear(sim.engine);
  sim.bodies.clear();
  sim.meta.clear();
  sim.pending.clear();
}

function addWalls(sim: Sim) {
  const { width, height } = sim;
  const lip = 220;
  const opts = {
    isStatic: true,
    friction: 0.9,
    frictionStatic: 1,
    restitution: 0.04,
    label: "wall",
  };
  Matter.Composite.add(sim.engine.world, [
    Matter.Bodies.rectangle(-WALL / 2, height / 2, WALL, height + lip * 2, opts),
    Matter.Bodies.rectangle(width + WALL / 2, height / 2, WALL, height + lip * 2, opts),
    Matter.Bodies.rectangle(width / 2, height + WALL / 2, width + WALL * 2, WALL, opts),
  ]);
}

function queueContacts(sim: Sim, event: Matter.IEventCollision<Matter.Engine>) {
  if (sim.dead) return;
  for (const pair of event.pairs) {
    const a = sim.meta.get(pair.bodyA.id);
    const b = sim.meta.get(pair.bodyB.id);
    if (!a || !b || a.tier !== b.tier || a.tier >= 11) continue;
    const left = Math.min(pair.bodyA.id, pair.bodyB.id);
    const right = Math.max(pair.bodyA.id, pair.bodyB.id);
    sim.pending.add(`${left}:${right}`);
  }
}

function resolveMerges(sim: Sim): SuikaPop[] {
  const pops: SuikaPop[] = [];
  for (let pass = 0; pass < 4; pass += 1) {
    if (pass > 0) collectOverlaps(sim);
    if (sim.pending.size === 0) break;
    const keys = [...sim.pending];
    sim.pending.clear();
    const used = new Set<number>();
    for (const key of keys) {
      const [rawA, rawB] = key.split(":");
      const idA = Number(rawA);
      const idB = Number(rawB);
      if (used.has(idA) || used.has(idB)) continue;
      const bodyA = sim.bodies.get(idA);
      const bodyB = sim.bodies.get(idB);
      const metaA = sim.meta.get(idA);
      const metaB = sim.meta.get(idB);
      if (!bodyA || !bodyB || !metaA || !metaB) continue;
      if (metaA.tier !== metaB.tier || metaA.tier >= 11) continue;
      used.add(idA);
      used.add(idB);
      const tier = metaA.tier + 1;
      const radius = sim.radii[tier] ?? metaA.radius;
      let x = (bodyA.position.x + bodyB.position.x) / 2;
      let y = (bodyA.position.y + bodyB.position.y) / 2;
      x = Math.min(sim.width - radius - 1, Math.max(radius + 1, x));
      y = Math.min(sim.height - radius - 1, y);
      removeFruit(sim, idA);
      removeFruit(sim, idB);
      spawnFruit(sim, tier, x, y);
      sim.score += MERGE_SCORE[tier] ?? 0;
      sim.merges += 1;
      if (tier === 11) sim.madeWatermelon = true;
      pops.push({ x, y, r: radius, tier });
    }
  }
  return pops;
}

function collectOverlaps(sim: Sim) {
  const list = [...sim.bodies.entries()];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const [idA, bodyA] = list[i];
      const [idB, bodyB] = list[j];
      const metaA = sim.meta.get(idA);
      const metaB = sim.meta.get(idB);
      if (!metaA || !metaB || metaA.tier !== metaB.tier || metaA.tier >= 11) continue;
      const dx = bodyA.position.x - bodyB.position.x;
      const dy = bodyA.position.y - bodyB.position.y;
      const reach = metaA.radius + metaB.radius - 0.5;
      if (dx * dx + dy * dy <= reach * reach) {
        const left = Math.min(idA, idB);
        const right = Math.max(idA, idB);
        sim.pending.add(`${left}:${right}`);
      }
    }
  }
}

function spawnFruit(sim: Sim, tier: number, x: number, y: number): Matter.Body {
  const radius = sim.radii[tier] ?? sim.radii[1];
  const body = Matter.Bodies.circle(x, y, radius, {
    friction: 0.045,
    frictionStatic: 0.18,
    frictionAir: 0.03,
    restitution: 0.2,
    density: 0.0024,
    label: "fruit",
  });
  body.slop = 0.05;
  sim.bodies.set(body.id, body);
  sim.meta.set(body.id, { tier, radius, dangerFrom: 0 });
  Matter.Composite.add(sim.engine.world, body);
  return body;
}

function removeFruit(sim: Sim, id: number) {
  const body = sim.bodies.get(id);
  if (!body) return;
  Matter.Composite.remove(sim.engine.world, body);
  sim.bodies.delete(id);
  sim.meta.delete(id);
}

function capMotion(body: Matter.Body) {
  const live = body as LiveBody;
  const dx = body.position.x - live.positionPrev.x;
  const dy = body.position.y - live.positionPrev.y;
  const speed = Math.hypot(dx, dy);
  if (speed > MAX_STEP_PX) {
    const k = MAX_STEP_PX / speed;
    const nx = live.positionPrev.x + dx * k;
    const ny = live.positionPrev.y + dy * k;
    setPosition(body, nx, ny, false);
    const timeScale = live.deltaTime > 0 ? live.deltaTime / BASE_DELTA : STEP_MS / BASE_DELTA;
    Matter.Body.setVelocity(body, { x: (dx * k) / timeScale, y: (dy * k) / timeScale });
  }
  const spin = Matter.Body.getAngularVelocity(body);
  if (Math.abs(spin) > 0.12) Matter.Body.setAngularVelocity(body, Math.sign(spin) * 0.12);
}

function setPosition(body: Matter.Body, x: number, y: number, updateVelocity: boolean) {
  (
    Matter.Body.setPosition as (
      target: Matter.Body,
      position: Matter.Vector,
      updateVelocity?: boolean,
    ) => void
  )(body, { x, y }, updateVelocity);
}

function updateDanger(sim: Sim, now: number) {
  let blinking = false;
  for (const [id, body] of sim.bodies) {
    const meta = sim.meta.get(id);
    if (!meta) continue;
    const top = body.position.y - meta.radius;
    const bottom = body.position.y + meta.radius;
    const inZone = top < sim.dangerY && bottom > 2;
    const live = body as LiveBody;
    const speed = Math.hypot(body.position.x - live.positionPrev.x, body.position.y - live.positionPrev.y);
    if (inZone && speed < BLINK_PX) blinking = true;
    const watching = meta.dangerFrom > 0;
    const slow = speed < (watching ? SLOW_RELEASE_PX : SLOW_PX);
    if (inZone && slow) {
      if (meta.dangerFrom === 0) meta.dangerFrom = now;
      else if (now - meta.dangerFrom >= sim.dangerHoldMs) sim.over = true;
    } else {
      meta.dangerFrom = 0;
    }
  }
  sim.danger = blinking;
}

function clampTier(tier: number): number {
  if (!Number.isFinite(tier)) return 1;
  return Math.min(11, Math.max(1, Math.floor(tier)));
}
