import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Anchor, ChevronsUp, CirclePause, Gem, Ghost, Skull, Swords, Timer, Undo2 } from 'lucide-react';
import { ENEMIES, RELICS } from '../data/definitions';
import { comboBonus } from '../game/reducer';
import { rgbaFromUnit, selectActiveCosmetic } from '../game/selectors';
import { AUTO_ATTACK_UNLOCK_LEVEL, BOSS_FIGHT_SECONDS } from '../game/state';
import { petDisplayName, petLevel, petSprite, worldForLevel } from '../game/stats';
import { useDispatch, useFx, useGameState, useNow, useStats } from '../hooks/useGame';
import { formatDuration, formatNumber, formatPercent } from '../utils/numberFormat';
import { Button, TwoTapButton } from './ui';

/** Damage numbers on screen at once; the oldest goes first. */
const MAX_NUMBERS = 24;
const MAX_RIPPLES = 12;
/** Long enough for the longest hit keyframes in index.css (crit, 0.22s). */
const HIT_FLASH_MS = 240;
const HP_GHOST_DELAY_MS = 150;
const URGENT_SECONDS = 10;
const COMBO_MIN = 3;
const WORLD_BOSS_EVERY = 50;

interface DamageNumber {
  id: number;
  amount: number;
  crit: boolean;
  auto: boolean;
  x: number;
  y: number;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
}

type HitKind = 'hit' | 'crit';

const clampPct = (v: number) => Math.max(0, Math.min(100, v));

/** Keeps controls from registering as taps on the arena underneath. */
const stopTap = (e: React.PointerEvent) => e.stopPropagation();

function spriteClass(isBoss: boolean, hit: HitKind | null): string {
  if (isBoss) return hit ? 'anim-boss-hit' : 'anim-boss-idle';
  if (hit === 'crit') return 'anim-enemy-crit';
  return hit ? 'anim-enemy-hit' : 'anim-enemy-idle';
}

/** Replays the element's current CSS animation from the start. */
function restartAnimation(el: HTMLElement | null) {
  if (!el) return;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.removeProperty('animation');
}

/** True from now until `until` (wall-clock ms); flips back on its own with a cleaned-up timeout. */
function useActiveUntil(until: number): boolean {
  const [active, setActive] = useState(() => until > Date.now());
  useEffect(() => {
    const ms = until - Date.now();
    setActive(ms > 0);
    if (ms <= 0) return;
    const t = setTimeout(() => setActive(false), ms);
    return () => clearTimeout(t);
  }, [until]);
  return active;
}

/** Shown only while manual taps are locked out, so its 250ms clock never runs otherwise. */
const TapLockOverlay: React.FC<{ until: number }> = ({ until }) => {
  const now = useNow(250);
  const seconds = Math.max(1, Math.ceil((until - now) / 1000));
  return (
    <div className="absolute inset-0 z-30 bg-void/85 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1.5 px-6 text-center">
      <div role="status" className="flex flex-col items-center gap-1.5">
        <CirclePause size={26} className="text-gold" aria-hidden />
        <h3 className="font-display font-bold text-sm text-gold tracking-wider">TAPPING PAUSED</h3>
        <p className="font-tech text-[11px] text-dim leading-snug max-w-[260px]">
          Machine-like tapping was detected, so manual taps are paused. Auto-attack keeps running.
        </p>
      </div>
      <p className="font-mono-code text-xs text-ink">
        Taps resume in <span className="font-bold text-gold">{formatDuration(seconds)}</span>
      </p>
    </div>
  );
};

const BossTimer: React.FC<{ seconds: number }> = ({ seconds }) => {
  const pct = clampPct((seconds / BOSS_FIGHT_SECONDS) * 100);
  const urgent = seconds < URGENT_SECONDS;
  return (
    <div className={`flex-1 min-w-0 flex flex-col gap-0.5 ${urgent ? 'animate-pulse motion-reduce:animate-none' : ''}`}>
      <div className="flex items-center justify-between gap-2 font-tech">
        <span className={`flex items-center gap-1 text-[9px] uppercase tracking-wider ${urgent ? 'text-crimson font-bold' : 'text-dim'}`}>
          <Timer size={10} aria-hidden />
          {urgent ? 'Time running out' : 'Boss timer'}
        </span>
        <span className={`font-mono-code text-[11px] font-bold ${urgent ? 'text-crimson' : 'text-gold'}`}>
          {seconds.toFixed(1)}s
        </span>
      </div>
      <div className={`h-2 bg-void border overflow-hidden ${urgent ? 'border-crimson' : 'border-gold/50'}`}>
        <div
          className={`h-full transition-[width] duration-100 ease-linear ${urgent ? 'bg-crimson' : 'bg-gold'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

/**
 * The fight: enemy, HP, the boss timer and the climb controls. Every pointerdown on the arena is
 * a tap (multi-touch included); the reducer decides whether it lands.
 */
export const CombatArena: React.FC = () => {
  const dispatch = useDispatch();
  const stats = useStats();
  const mode = useGameState((s) => s.combat.mode);
  const level = useGameState((s) => s.combat.level);
  const enemy = useGameState((s) => s.combat.enemy);
  const bossTimeLeft = useGameState((s) => s.combat.bossTimeLeft);
  const combo = useGameState((s) => s.ui.combo.count);
  const lockedUntil = useGameState((s) => s.ui.tapGuard.lockedUntil);
  const showNumbers = useGameState((s) => s.settings.damageNumbers);
  const cosmetic = useGameState(selectActiveCosmetic);
  const petId = useGameState((s) => s.activePetId);
  const petLvl = useGameState((s) => (s.activePetId ? petLevel(s, s.activePetId) : 0));
  const relicId = useGameState((s) => s.activeRelicId);
  const locked = useActiveUntil(lockedUntil);

  const arenaRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const spriteBoxRef = useRef<HTMLDivElement>(null);
  const spriteImgRef = useRef<HTMLImageElement>(null);
  const nextId = useRef(1);
  /** The hit class currently on the sprite, so a repeat hit can restart it. */
  const hitClassRef = useRef<string | null>(null);

  const [numbers, setNumbers] = useState<DamageNumber[]>([]);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [hit, setHit] = useState<{ kind: HitKind | null; n: number }>({ kind: null, n: 0 });
  const [brokenTexture, setBrokenTexture] = useState<string | null>(null);

  const hpPct = enemy.maxHp > 0 ? clampPct((enemy.hp / enemy.maxHp) * 100) : 0;
  const [ghostPct, setGhostPct] = useState(hpPct);

  // The ghost trail catches up after a short pause; a fresh enemy refills it at once (max below).
  useEffect(() => {
    const t = setTimeout(() => setGhostPct(hpPct), HP_GHOST_DELAY_MS);
    return () => clearTimeout(t);
  }, [hpPct]);

  // Back to idle once the hit animation has played.
  useEffect(() => {
    if (!hit.kind) return;
    const t = setTimeout(() => {
      hitClassRef.current = null;
      setHit((h) => ({ kind: null, n: h.n }));
    }, HIT_FLASH_MS);
    return () => clearTimeout(t);
  }, [hit]);

  /** A random point around the enemy sprite, in arena coordinates, for auto-attack numbers. */
  const spotNearEnemy = (): { x: number; y: number } => {
    const arena = arenaRef.current;
    if (!arena) return { x: 0, y: 0 };
    const a = arena.getBoundingClientRect();
    const box = spriteBoxRef.current?.getBoundingClientRect();
    const cx = box ? box.left - a.left + box.width / 2 : a.width / 2;
    const cy = box ? box.top - a.top + box.height / 2 : a.height / 2;
    const spread = box ? box.width * 0.45 : 40;
    return { x: cx + (Math.random() * 2 - 1) * spread, y: cy + (Math.random() * 2 - 1) * spread * 0.6 };
  };

  useFx((fx) => {
    if (fx.type === 'shake') {
      // Restart the class so back-to-back crits each shake. The layer's className prop is
      // static, so React never rewrites it underneath this.
      const el = shakeRef.current;
      if (!el) return;
      el.classList.remove('anim-shake');
      void el.offsetWidth;
      el.classList.add('anim-shake');
      return;
    }
    if (fx.type !== 'hit') return;

    const kind: HitKind = fx.crit ? 'crit' : 'hit';
    const cls = spriteClass(enemy.isBoss, kind);
    if (hitClassRef.current === cls) restartAnimation(spriteImgRef.current);
    hitClassRef.current = cls;
    setHit((h) => ({ kind, n: h.n + 1 }));

    if (!showNumbers) return;
    const width = arenaRef.current?.clientWidth ?? 0;
    const pos = fx.auto || fx.x === undefined || fx.y === undefined ? spotNearEnemy() : { x: fx.x, y: fx.y };
    const x = width > 64 ? Math.min(width - 32, Math.max(32, pos.x)) : pos.x;
    const entry: DamageNumber = { id: nextId.current++, amount: fx.amount, crit: fx.crit, auto: fx.auto, x, y: pos.y };
    setNumbers((prev) => [...prev.slice(Math.max(0, prev.length - (MAX_NUMBERS - 1))), entry]);
  });

  const removeNumber = useCallback((id: number) => setNumbers((prev) => prev.filter((n) => n.id !== id)), []);
  const removeRipple = useCallback((id: number) => setRipples((prev) => prev.filter((r) => r.id !== id)), []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const result = dispatch({ type: 'TAP', x, y, touch: e.pointerType === 'touch' });
    if (!result.ok) return;
    const ripple: Ripple = { id: nextId.current++, x, y };
    setRipples((prev) => [...prev.slice(Math.max(0, prev.length - (MAX_RIPPLES - 1))), ripple]);
  };

  const onShakeEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('anim-shake');
  };

  const def = ENEMIES[enemy.defId];
  const texture = def?.texture ?? '';
  const enemyName = def?.displayName ?? enemy.defId;
  const viewScale = def?.viewScale ?? 1;
  const isBossFight = mode === 'BOSS_FIGHT';
  const isBoss = enemy.isBoss;
  const world = worldForLevel(level);
  const lv = formatNumber(level);
  const stageLabel = isBossFight ? `${level % WORLD_BOSS_EVERY === 0 ? 'WORLD BOSS' : 'BOSS'} · Lv. ${lv}` : `Lv. ${lv}`;
  const gateNext = (level + 1) % 10 === 0;
  const nextLv = formatNumber(level + 1);

  const numberColor = rgbaFromUnit(cosmetic.numberColor);
  const trailColor = rgbaFromUnit(cosmetic.trailColor);
  const trailGlow = rgbaFromUnit(cosmetic.trailColor, 0.6);

  const relic = relicId ? RELICS.find((r) => r.id === relicId) : undefined;
  const petName = petId ? petDisplayName(petId, petLvl) : '';
  const petImg = petId ? petSprite(petId, petLvl) : '';

  return (
    <div
      ref={arenaRef}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => e.preventDefault()}
      role="region"
      aria-label="Combat. Tap anywhere to attack."
      data-testid="combat-arena"
      className="relative w-full h-[300px] sm:h-[310px] shrink-0 overflow-hidden bg-void border-b border-line select-none touch-none cursor-crosshair"
    >
      {/* Everything shakes together; the outer box stays still so tap coordinates never jitter. */}
      <div ref={shakeRef} onAnimationEnd={onShakeEnd} className="absolute inset-0 isolate">
        <div className="absolute inset-0 bg-grid-pattern opacity-60 pointer-events-none" />

        <div className="absolute inset-0 p-3 flex flex-col gap-1.5">
          {/* Stage and telemetry */}
          <div className="flex items-start justify-between gap-2 pointer-events-none">
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-tech text-dim uppercase tracking-[0.2em] truncate">{world.displayName}</span>
              <span
                className={`flex items-center gap-1 font-display font-bold text-xs tracking-wider whitespace-nowrap ${
                  isBossFight ? 'text-crimson' : 'text-ink'
                }`}
              >
                {isBossFight && <Skull size={12} aria-hidden />}
                {stageLabel}
              </span>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-2 bg-void/80 border border-line px-2 py-0.5">
                <span className="flex items-baseline gap-1">
                  <span className="text-[9px] font-tech text-neon">DPS</span>
                  {stats.autoAttackUnlocked ? (
                    <span className="text-[11px] font-mono-code font-bold text-ink">{formatNumber(stats.dps)}</span>
                  ) : (
                    <span className="text-[9px] font-tech text-dim">AUTO Lv {formatNumber(AUTO_ATTACK_UNLOCK_LEVEL)}</span>
                  )}
                </span>
                <span className="text-faint" aria-hidden>
                  |
                </span>
                <span className="flex items-baseline gap-1">
                  <span className="text-[9px] font-tech text-neon">TAP</span>
                  <span className="text-[11px] font-mono-code font-bold text-ink">{formatNumber(stats.tapDamage)}</span>
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 bg-void/80 border border-crimson/40 px-2 py-0.5">
                <span className="text-[9px] font-tech text-gold">CRIT</span>
                <span className="text-[11px] font-mono-code font-bold text-gold">{formatNumber(stats.critChance * 100)}%</span>
                <span className="text-[11px] font-mono-code font-bold text-crimson">×{formatNumber(stats.critDamage)}</span>
              </div>
            </div>
          </div>

          {/* Active pet and relic */}
          {(petId || relic) && (
            <div className="absolute left-3 top-[52px] flex flex-col items-start gap-1 pointer-events-none">
              {petId && (
                <div className="flex items-center gap-1 bg-panel/90 border border-line pl-0.5 pr-1.5 py-0.5">
                  {petImg && <img src={petImg} alt="" draggable={false} className="w-5 h-5 object-contain pixelated" />}
                  <span className="text-[9px] font-tech text-dim">PET</span>
                  <span className="text-[10px] font-mono-code font-bold text-neon truncate max-w-[76px]">{petName}</span>
                </div>
              )}
              {relic && (
                <div className="flex items-center gap-1 bg-panel/90 border border-line px-1.5 py-0.5">
                  <Gem size={10} className="text-gold shrink-0" aria-hidden />
                  <span className="text-[9px] font-tech text-dim">RELIC</span>
                  <span className="text-[10px] font-mono-code font-bold text-gold truncate max-w-[76px]">{relic.displayName}</span>
                </div>
              )}
            </div>
          )}

          {/* Combo */}
          {combo >= COMBO_MIN && (
            <div className="absolute right-3 top-[70px] pointer-events-none bg-panel border border-gold px-2 py-0.5 shadow-[0_0_8px] shadow-gold/30">
              <span className="text-[10px] font-display font-black text-gold uppercase tracking-wider whitespace-nowrap">
                {formatNumber(combo)} STRIKES · {formatPercent(comboBonus(combo), 0)} DMG
              </span>
            </div>
          )}

          {/* Enemy */}
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
            <div ref={spriteBoxRef} className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <div
                className={`absolute inset-0 rounded-full blur-md opacity-30 ${
                  isBoss
                    ? 'bg-[radial-gradient(circle,var(--color-crimson)_0%,transparent_70%)]'
                    : 'bg-[radial-gradient(circle,var(--color-neon)_0%,transparent_70%)]'
                }`}
              />
              <div
                className={`absolute w-[130%] h-[130%] rounded-full border-[1.5px] border-dashed animate-[spin_20s_linear_infinite] motion-reduce:animate-none ${
                  isBoss ? 'border-crimson/70' : 'border-crimson/40'
                }`}
              />
              <div className="absolute w-[110%] h-[110%] rounded-full border border-neon/40" />
              <div className="relative flex items-center justify-center" style={{ transform: `scale(${viewScale})` }}>
                {texture && brokenTexture !== texture ? (
                  <img
                    ref={spriteImgRef}
                    src={texture}
                    alt={enemyName}
                    draggable={false}
                    onError={() => setBrokenTexture(texture)}
                    className={`w-20 h-20 object-contain pixelated ${spriteClass(isBoss, hit.kind)}`}
                  />
                ) : (
                  <span role="img" aria-label={enemyName}>
                    <Ghost size={48} className={isBoss ? 'text-crimson' : 'text-neon'} aria-hidden />
                  </span>
                )}
              </div>
            </div>
            <span
              className={`shrink-0 max-w-full truncate leading-tight text-sm sm:text-base font-display font-bold uppercase tracking-[0.12em] text-ink text-shadow-[0_0_10px] ${
                isBoss ? 'text-shadow-crimson/60' : 'text-shadow-neon/50'
              }`}
            >
              {enemyName}
            </span>
          </div>

          {/* HP */}
          <div className="flex flex-col gap-1 pointer-events-none">
            <div className="flex items-end justify-between px-0.5">
              <span className={`text-[10px] font-tech tracking-widest uppercase ${isBoss ? 'text-crimson' : 'text-neon'}`}>
                {isBoss ? 'Boss HP' : 'HP'}
              </span>
              <span className="text-[10px] font-mono-code text-ink">
                <span className="font-bold text-neon">{formatNumber(enemy.hp)}</span> / {formatNumber(enemy.maxHp)}{' '}
                <span className="text-dim">({formatNumber(Math.ceil(hpPct))}%)</span>
              </span>
            </div>
            <div
              className={`relative w-full bg-void border ${isBoss ? 'h-4 border-crimson/70' : 'h-3 border-line'}`}
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)' }}
            >
              <div
                className="absolute left-0 top-0 bottom-0 bg-ink/20 transition-[width] duration-300"
                style={{ width: `${Math.max(ghostPct, hpPct)}%` }}
              />
              <div
                className="absolute left-0 top-0 bottom-0 bg-linear-to-r from-neon via-purple to-crimson transition-[width] duration-75"
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>

          {/* Controls: above the tap-lock overlay, and never counted as taps. */}
          <div className="relative z-40 flex items-center gap-2 min-h-8">
            {mode === 'BOSS_FIGHT' && (
              <>
                <BossTimer seconds={bossTimeLeft} />
                <TwoTapButton
                  size="sm"
                  variant="ghost"
                  armedVariant="danger"
                  className="shrink-0"
                  onPointerDown={stopTap}
                  label={
                    <>
                      <Undo2 size={12} aria-hidden />
                      RETREAT
                    </>
                  }
                  armedLabel="CONFIRM RETREAT"
                  onConfirm={() => dispatch({ type: 'LEAVE_BOSS' })}
                />
              </>
            )}

            {mode === 'FARM_MODE' && (
              <>
                <div className="flex-1 min-w-0 flex flex-col leading-tight pointer-events-none">
                  <span className="flex items-center gap-1 text-[10px] font-tech font-bold text-neon uppercase tracking-wider">
                    <Anchor size={10} aria-hidden />
                    Farming Lv. {lv}
                  </span>
                  <span className="text-[9px] font-tech text-dim uppercase truncate">
                    {gateNext ? `Boss at Lv. ${nextLv}` : 'Kills repeat this level'}
                  </span>
                </div>
                {gateNext ? (
                  <Button
                    size="sm"
                    variant="primary"
                    className="shrink-0 shadow-[0_0_14px] shadow-neon/50"
                    onPointerDown={stopTap}
                    onClick={() => dispatch({ type: 'CHALLENGE_BOSS' })}
                  >
                    <Swords size={12} aria-hidden />
                    CHALLENGE BOSS
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    onPointerDown={stopTap}
                    onClick={() => dispatch({ type: 'SET_FARM', on: false })}
                  >
                    <ChevronsUp size={12} aria-hidden />
                    RESUME CLIMB
                  </Button>
                )}
              </>
            )}

            {mode === 'NORMAL' && (
              <>
                <div className="flex-1 min-w-0 flex flex-col leading-tight pointer-events-none">
                  <span className="text-[10px] font-tech font-bold text-dim uppercase tracking-wider">Climbing</span>
                  <span className="text-[9px] font-tech text-dim uppercase truncate">
                    {gateNext ? `Next kill: boss at Lv. ${nextLv}` : 'Each kill goes up a level'}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  onPointerDown={stopTap}
                  onClick={() => dispatch({ type: 'SET_FARM', on: true })}
                >
                  <Anchor size={12} aria-hidden />
                  HOLD LEVEL
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Tap trail and damage numbers; each removes itself when its animation ends. */}
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
          {ripples.map((r) => (
            <span
              key={r.id}
              className="absolute w-14 h-14 rounded-full border-2 anim-ripple"
              style={{ left: r.x, top: r.y, borderColor: trailColor, boxShadow: `0 0 12px ${trailGlow}` }}
              onAnimationEnd={() => removeRipple(r.id)}
            />
          ))}
          {numbers.map((n) => (
            <span
              key={n.id}
              className={`absolute anim-damage font-display font-bold whitespace-nowrap ${
                n.crit
                  ? 'text-lg text-gold text-shadow-[0_0_10px] text-shadow-gold/70'
                  : n.auto
                    ? 'text-xs opacity-85'
                    : 'text-base'
              }`}
              style={{
                left: n.x,
                top: n.y - 14,
                ...(n.crit ? null : { color: numberColor, textShadow: `0 0 8px ${trailGlow}` }),
              }}
              onAnimationEnd={() => removeNumber(n.id)}
            >
              {n.crit ? `CRIT ${formatNumber(n.amount)}` : formatNumber(n.amount)}
            </span>
          ))}
        </div>

        {locked && <TapLockOverlay until={lockedUntil} />}
      </div>
    </div>
  );
};
