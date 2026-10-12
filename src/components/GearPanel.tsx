import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Hammer, Lock, Package, Shield } from 'lucide-react';
import { AFFIXES, LOOT_TABLES, RARITIES, SLOTS } from '../data/definitions';
import type { AffixDefinition, Item, RarityDefinition, SlotDefinition } from '../types/game';
import type { GameState } from '../game/state';
import { selectForgeCost } from '../game/selectors';
import { useDispatch, useGameState } from '../hooks/useGame';
import { formatNumber } from '../utils/numberFormat';
import { Button, Modal, Panel, PanelHeader, TabBody, TwoTapButton } from './ui';

import weaponImg from '../assets/gear/weapon.webp';
import helmetImg from '../assets/gear/helmet.webp';
import armorImg from '../assets/gear/armor.webp';
import bootsImg from '../assets/gear/boots.webp';
import glovesImg from '../assets/gear/gloves.webp';
import ringImg from '../assets/gear/ring.webp';

const GEAR_IMAGES: Record<string, string> = {
  weapon: weaponImg,
  helmet: helmetImg,
  armor: armorImg,
  boots: bootsImg,
  gloves: glovesImg,
  ring: ringImg,
};

const ORDERED_SLOTS = [...SLOTS].sort((a, b) => a.sortOrder - b.sortOrder);
const FORGE_SLOTS = ORDERED_SLOTS.filter((s) => !s.sealed);
const AFFIX_BY_STAT: Record<string, AffixDefinition> = Object.fromEntries(AFFIXES.map((a) => [a.stat, a]));
/** Short labels for the one-line key stat on tiles and rows ("+14 TAP", "+9.0% CRIT"). */
const SHORT_LABEL: Record<string, string> = {
  tap_flat: 'TAP',
  tap_pct: 'TAP',
  crit_chance: 'CRIT',
  crit_damage: 'CRIT DMG',
  essence: 'ESSENCE',
  boss: 'BOSS',
};
const PIP_COUNT = RARITIES.length;
const COMMON_YIELD = RARITIES[0].salvageYield;
const FORGE_BEAT_MS = 600;
const NOTICE_MS = 2500;
const FORGE_ODDS = LOOT_TABLES.forge.map((w, r) => `${RARITIES[r]?.displayName ?? r} ${formatNumber(Math.round(w * 1000) / 10)}%`).join(' · ');

/** The last slot forged, preselected next time this session. */
let lastForgeSlot = FORGE_SLOTS[0]?.id ?? 'weapon';

const selectEquipped = (s: GameState) => s.equipped;
const selectInventory = (s: GameState) => s.inventory;
const selectScraps = (s: GameState) => s.currencies.void_scraps;
const selectLevel = (s: GameState) => s.combat.level;

// ------------------------------------------------------------------ formatting

function rarityOf(r: number): RarityDefinition {
  return RARITIES[r] ?? RARITIES[0];
}

function slotName(id: string): string {
  return SLOTS.find((s) => s.id === id)?.displayName ?? id;
}

/** "EPIC GLOVES": the rarity word is always in the name, so colour never carries it alone. */
function itemName(item: Item): string {
  return `${rarityOf(item.rarity).displayName} ${slotName(item.slot)}`.toUpperCase();
}

function affixValue(stat: string, v: number): string {
  return AFFIX_BY_STAT[stat]?.isPercent ? `${(v * 100).toFixed(1)}%` : formatNumber(v);
}

/** "Tap Damage" from "Tap Damage +{value}". */
function affixLabel(stat: string): string {
  const def = AFFIX_BY_STAT[stat];
  return def ? def.displayTemplate.replace(/\s*\+?\{value\}/, '').trim() : stat;
}

function affixLine(stat: string, v: number): string {
  const def = AFFIX_BY_STAT[stat];
  return def ? def.displayTemplate.replace('{value}', affixValue(stat, v)) : `${stat} +${affixValue(stat, v)}`;
}

/** The item's affixes in definition order, unknown stats (old saves) last. */
function affixEntries(item: Item): [string, number][] {
  const known = AFFIXES.filter((a) => typeof item.affixes[a.stat] === 'number').map(
    (a): [string, number] => [a.stat, item.affixes[a.stat]],
  );
  const unknown = Object.entries(item.affixes).filter(([k, v]) => !AFFIX_BY_STAT[k] && typeof v === 'number');
  return [...known, ...unknown];
}

/** The strongest affix relative to its roll range, in short form. */
function keyStat(item: Item): string {
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const [stat, v] of Object.entries(item.affixes)) {
    const def = AFFIX_BY_STAT[stat];
    if (!def || !Number.isFinite(v)) continue;
    const scale = def.isPercent ? def.maxValue : def.maxValue * Math.max(1, item.itemLevel);
    const score = v / scale;
    if (score > bestScore) {
      bestScore = score;
      best = stat;
    }
  }
  if (!best) return '—';
  return `+${affixValue(best, item.affixes[best])} ${SHORT_LABEL[best] ?? AFFIX_BY_STAT[best].displayName.toUpperCase()}`;
}

// ------------------------------------------------------------------ pieces

/**
 * Rarity as theme tokens (--color-r0 … --color-r4 in src/index.css), by RARITIES index. Written out
 * in full so Tailwind generates every class.
 */
const RARITY_TONE: { border: string; fill: string; tint: string; text: string }[] = [
  { border: 'border-r0', fill: 'bg-r0', tint: 'bg-r0/10', text: 'text-r0' },
  { border: 'border-r1', fill: 'bg-r1', tint: 'bg-r1/15', text: 'text-r1' },
  { border: 'border-r2', fill: 'bg-r2', tint: 'bg-r2/15', text: 'text-r2' },
  { border: 'border-r3', fill: 'bg-r3', tint: 'bg-r3/15', text: 'text-r3' },
  { border: 'border-r4', fill: 'bg-r4', tint: 'bg-r4/20', text: 'text-r4' },
];
const toneOf = (rarity: number) => RARITY_TONE[Math.max(0, Math.min(RARITY_TONE.length - 1, rarity))];

const Pips: React.FC<{ rarity: number; className?: string }> = ({ rarity, className = '' }) => {
  const tone = toneOf(rarity);
  const filled = Math.min(PIP_COUNT, rarity + 1);
  return (
    <span className={`inline-flex items-center gap-[2px] ${className}`} role="img" aria-label={`${filled} of ${PIP_COUNT} pips`}>
      {Array.from({ length: PIP_COUNT }, (_, i) => (
        <span key={i} className={`w-[5px] h-[5px] border ${i < filled ? `${tone.fill} ${tone.border}` : 'border-faint bg-abyss'}`} />
      ))}
    </span>
  );
};

/** The level, in the top-left corner of every square. */
const LevelTag: React.FC<{ level: number }> = ({ level }) => (
  <span className="absolute left-0 top-0 px-1 bg-abyss/90 text-[9px] font-mono-code font-bold text-ink leading-[14px]">
    {formatNumber(level)}
  </span>
);

/** One equipped slot: a square, empty-dashed when nothing is worn. */
const EquipSquare: React.FC<{ slot: SlotDefinition; item: Item | undefined; onOpen: (slot: string) => void }> = React.memo(
  ({ slot, item, onOpen }) => {
    const img = GEAR_IMAGES[slot.id];
    if (!item) {
      return (
        <button
          type="button"
          onClick={() => onOpen(slot.id)}
          aria-label={`${slot.displayName} slot, empty`}
          className="relative w-11 h-11 shrink-0 overflow-hidden bg-abyss border border-dashed border-line flex flex-col items-center justify-end pb-0.5 active:translate-y-0.5 active:border-amber-500 active:scale-[0.98]"
        >
          {img && <img src={img} alt="" className="absolute inset-1 w-[calc(100%-8px)] h-[calc(100%-8px)] object-cover opacity-15 grayscale" />}
          <span className="relative text-[7px] font-tech font-bold uppercase text-dim">{slot.displayName}</span>
        </button>
      );
    }
    const tone = toneOf(item.rarity);
    const r = rarityOf(item.rarity);
    return (
      <button
        type="button"
        onClick={() => onOpen(slot.id)}
        aria-label={`${slot.displayName}: ${r.displayName}, item level ${item.itemLevel}, ${keyStat(item)}`}
        className={`relative w-11 h-11 shrink-0 overflow-hidden border-2 ${tone.border} ${tone.tint} shadow-hard flex flex-col items-center justify-end pb-0.5 active:translate-y-0.5 active:border-amber-500 active:scale-[0.98]`}
      >
        {img && <img src={img} alt="" className="absolute inset-0.5 w-[calc(100%-4px)] h-[calc(100%-4px)] object-cover opacity-80" />}
        <LevelTag level={item.itemLevel} />
        <Pips rarity={item.rarity} className="relative" />
      </button>
    );
  },
);
EquipSquare.displayName = 'EquipSquare';

/** One stored item: a square tinted and bordered by its rarity, level top-left, pips at the bottom. */
const ItemSquare: React.FC<{ item: Item; isNew: boolean; onOpen: (itemId: number) => void }> = React.memo(({ item, isNew, onOpen }) => {
  const tone = toneOf(item.rarity);
  const img = GEAR_IMAGES[item.slot];
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      aria-label={`${itemName(item)}, item level ${item.itemLevel}, ${keyStat(item)}${isNew ? ', new' : ''}`}
      className={`relative aspect-square overflow-hidden border-2 ${tone.border} ${tone.tint} shadow-hard flex flex-col items-center justify-end pb-1 active:translate-y-0.5 active:border-amber-500 active:scale-[0.98]`}
    >
      {img && <img src={img} alt="" className="absolute inset-1 w-[calc(100%-8px)] h-[calc(100%-8px)] object-cover" />}
      <LevelTag level={item.itemLevel} />
      {isNew && (
        <span className="absolute right-0 top-0 px-0.5 bg-gold text-abyss text-[8px] font-tech font-black leading-[12px]">NEW</span>
      )}
      <Pips rarity={item.rarity} className="relative bg-abyss/80 px-0.5 py-[2px]" />
    </button>
  );
});
ItemSquare.displayName = 'ItemSquare';

/** THIS vs EQUIPPED, one row per stat either item has. Arrows and words carry the result, not colour. */
const CompareTable: React.FC<{ item: Item; equipped: Item }> = ({ item, equipped }) => {
  const stats = AFFIXES.map((a) => a.stat).filter(
    (s) => typeof item.affixes[s] === 'number' || typeof equipped.affixes[s] === 'number',
  );
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-tech text-dim">
        Compared with your equipped {rarityOf(equipped.rarity).displayName} {slotName(equipped.slot)} (item level{' '}
        {formatNumber(equipped.itemLevel)})
      </span>
      <table className="w-full text-[10px] font-mono-code border border-line">
        <thead className="bg-panel2 text-dim">
          <tr>
            <th className="text-left font-normal px-1.5 py-1">STAT</th>
            <th className="text-right font-normal px-1.5 py-1">THIS</th>
            <th className="text-right font-normal px-1.5 py-1">EQUIPPED</th>
            <th className="text-right font-normal px-1.5 py-1">CHANGE</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((stat) => {
            const tv = item.affixes[stat];
            const ev = equipped.affixes[stat];
            const delta = (tv ?? 0) - (ev ?? 0);
            const shown = affixValue(stat, Math.abs(delta));
            const same = delta === 0 || /^0(\.0)?%?$/.test(shown);
            let change: React.ReactNode;
            if (same) change = <span className="text-dim">= same</span>;
            else if (delta > 0) change = <span className="text-toxic">▲ +{shown}</span>;
            else change = <span className="text-crimson">▼ -{shown}{tv === undefined ? ' lost' : ''}</span>;
            return (
              <tr key={stat} className="border-t border-line">
                <td className="px-1.5 py-1 text-dim">{affixLabel(stat)}</td>
                <td className="px-1.5 py-1 text-right text-ink">{tv === undefined ? '—' : `+${affixValue(stat, tv)}`}</td>
                <td className="px-1.5 py-1 text-right text-ink">{ev === undefined ? '—' : `+${affixValue(stat, ev)}`}</td>
                <td className="px-1.5 py-1 text-right whitespace-nowrap">{change}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

type InspectTarget = { kind: 'item'; itemId: number } | { kind: 'slot'; slot: string };

type InspectView =
  | { kind: 'inventory'; item: Item; equipped: Item | undefined }
  | { kind: 'equipped'; item: Item }
  | { kind: 'empty'; slot: string }
  | { kind: 'sealed'; slot: string };

const Inspector: React.FC<{
  view: InspectView | null;
  isNew: boolean;
  onClose: () => void;
  onEquip: (item: Item) => void;
  onUnequip: (slot: string) => void;
  onSalvage: (item: Item) => void;
}> = ({ view, isNew, onClose, onEquip, onUnequip, onSalvage }) => {
  if (!view) return null;

  if (view.kind === 'empty' || view.kind === 'sealed') {
    const sealed = view.kind === 'sealed';
    return (
      <Modal
        open
        onClose={onClose}
        title={`${slotName(view.slot).toUpperCase()} — ${sealed ? 'SEALED' : 'EMPTY'}`}
        icon={sealed ? <Lock size={14} className="text-dim" aria-hidden /> : <Shield size={14} className="text-neon" aria-hidden />}
      >
        <p className="text-xs font-tech text-dim leading-snug">
          {sealed
            ? 'This slot stays sealed. Relics are not worn as gear; you attune one in the RELICS tab instead.'
            : 'Nothing equipped here. Enemies sometimes drop gear and bosses always do, or forge one below.'}
        </p>
        <Button variant="ghost" block onClick={onClose}>
          CLOSE
        </Button>
      </Modal>
    );
  }

  const { item } = view;
  const r = rarityOf(item.rarity);
  const yieldScraps = r.salvageYield;
  const img = GEAR_IMAGES[item.slot];
  const tone = item.rarity >= 4 ? 'crimson' : item.rarity >= 3 ? 'gold' : 'neon';
  const status = view.kind === 'equipped' ? 'EQUIPPED' : isNew ? 'NEW · IN STORAGE' : 'IN STORAGE';

  return (
    <Modal open onClose={onClose} tone={tone} title={<span className={toneOf(item.rarity).text}>{itemName(item)}</span>}>
      <div className="flex items-center gap-3">
        {img && <img src={img} alt="" className={`w-16 h-16 object-cover border-2 shrink-0 ${toneOf(item.rarity).border}`} />}
        <div className="flex flex-col gap-1 min-w-0">
          <Pips rarity={item.rarity} />
          <span className="text-[10px] font-tech text-dim">
            Item level {formatNumber(item.itemLevel)} · {slotName(item.slot)}
          </span>
          <span className="text-[10px] font-tech font-bold text-ink">{status}</span>
        </div>
      </div>

      <ul className="flex flex-col gap-1 bg-void border border-line p-2">
        {affixEntries(item).map(([stat, v]) => (
          <li key={stat} className="text-xs font-mono-code font-bold text-neon">
            ▸ {affixLine(stat, v)}
          </li>
        ))}
      </ul>

      {view.kind === 'inventory' ? (
        <>
          {view.equipped ? (
            <CompareTable item={item} equipped={view.equipped} />
          ) : (
            <p className="text-[10px] font-tech text-dim">This slot is empty, so equipping this is pure gain.</p>
          )}
          <p className="text-[10px] font-tech text-dim">Salvages for +{formatNumber(yieldScraps)} scraps.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="solid" onClick={() => onEquip(item)}>
              <Check size={14} aria-hidden /> EQUIP
            </Button>
            {item.rarity >= 2 ? (
              <TwoTapButton
                variant="ghost"
                className="text-center leading-tight"
                label={`SALVAGE +${formatNumber(yieldScraps)}`}
                armedLabel={`TAP AGAIN: +${formatNumber(yieldScraps)} SCRAPS`}
                onConfirm={() => onSalvage(item)}
              />
            ) : (
              <Button variant="ghost" onClick={() => onSalvage(item)}>
                SALVAGE +{formatNumber(yieldScraps)}
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-[10px] font-tech text-dim">Equipped gear can't be salvaged. Unequip it first.</p>
          <Button variant="ghost" block onClick={() => onUnequip(item.slot)}>
            UNEQUIP
          </Button>
        </>
      )}

      <Button variant="ghost" block onClick={onClose}>
        CLOSE
      </Button>
    </Modal>
  );
};

/** Pick a slot, pay scraps, get a random item at the level being fought. */
const ForgeSection: React.FC<{ onForged: (item: Item) => void; onNotice: (text: string) => void }> = ({ onForged, onNotice }) => {
  const dispatch = useDispatch();
  const scraps = useGameState(selectScraps);
  const cost = useGameState(selectForgeCost);
  const level = useGameState(selectLevel);
  const [slot, setSlot] = useState(lastForgeSlot);
  const [forging, setForging] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    },
    [],
  );

  const short = Math.max(0, Math.ceil(cost - scraps));
  const canForge = short === 0;

  const pickSlot = (id: string) => {
    lastForgeSlot = id;
    setSlot(id);
  };

  const forge = () => {
    if (timer.current || !canForge) return;
    // Charge now, at the price and level on the button; only the reveal waits for the beat.
    const res = dispatch({ type: 'FORGE_ITEM', slot });
    if (!res.ok || !res.item) {
      onNotice(res.reason === 'not_enough' ? 'Not enough scraps to forge.' : 'That slot cannot be forged.');
      return;
    }
    const item = res.item;
    setForging(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setForging(false);
      onForged(item);
    }, FORGE_BEAT_MS);
  };

  return (
    <Panel tone="gold">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-display font-bold text-gold uppercase tracking-wider">
          <Hammer size={12} aria-hidden /> Gear forge
        </span>
        <span className="text-[10px] font-mono-code text-dim">
          Item level <span className="text-ink font-bold">{formatNumber(level)}</span>
        </span>
      </div>
      <p className="text-[10px] font-tech text-dim leading-snug">
        Pay scraps for a random item in the slot you pick, at the level you are fighting.
      </p>

      <div className="grid grid-cols-3 gap-1" role="group" aria-label="Slot to forge">
        {FORGE_SLOTS.map((s) => {
          const active = s.id === slot;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={active}
              disabled={forging}
              onClick={() => pickSlot(s.id)}
              className={`min-h-[32px] px-1 text-[10px] font-mono-code font-bold uppercase border transition-colors disabled:opacity-50 ${
                active ? 'bg-gold text-void border-gold' : 'bg-panel2 text-dim border-line hover:text-ink'
              }`}
            >
              {active && '✓ '}
              {s.displayName}
            </button>
          );
        })}
      </div>

      <Button variant={canForge ? 'gold' : 'ghost'} size="md" block disabled={!canForge || forging} onClick={forge}>
        <Hammer size={14} aria-hidden className={forging ? 'motion-safe:animate-pulse' : ''} />
        {forging ? 'FORGING…' : `FORGE ${slotName(slot).toUpperCase()} · ${formatNumber(cost)} SCRAPS`}
      </Button>
      {!canForge && (
        <p className="text-[10px] font-tech text-crimson">
          Need {formatNumber(short)} more scraps. Salvage gear you don't need to get scraps.
        </p>
      )}
      <p className="text-[9px] font-tech text-dim">Odds: {FORGE_ODDS}</p>
    </Panel>
  );
};

// ------------------------------------------------------------------ panel

/** The ARMOR tab: equipped gear, storage, salvage and the gear forge. */
export const GearPanel: React.FC = () => {
  const dispatch = useDispatch();
  const equipped = useGameState(selectEquipped);
  const inventory = useGameState(selectInventory);
  const scraps = useGameState(selectScraps);

  const [filter, setFilter] = useState<string>('ALL');
  const [target, setTarget] = useState<InspectTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Items unseen when the tab opened keep their NEW label for the whole visit.
  const [newAtEntry] = useState(() => new Set(inventory.filter((i) => !i.seen).map((i) => i.id)));

  // Leaving the tab marks everything seen, which clears the nav badge.
  useEffect(
    () => () => {
      dispatch({ type: 'MARK_ITEMS_SEEN' });
    },
    [dispatch],
  );

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = null;
    },
    [],
  );

  const flash = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => {
      noticeTimer.current = null;
      setNotice(null);
    }, NOTICE_MS);
  }, []);

  const openSlot = useCallback((slot: string) => setTarget({ kind: 'slot', slot }), []);
  const openItem = useCallback((itemId: number) => setTarget({ kind: 'item', itemId }), []);
  const close = useCallback(() => setTarget(null), []);
  const onForged = useCallback((item: Item) => setTarget({ kind: 'item', itemId: item.id }), []);

  const isNew = (item: Item) => !item.seen || newAtEntry.has(item.id);

  const { slotCounts, commons } = useMemo(() => {
    const counts: Record<string, number> = {};
    let c = 0;
    for (const i of inventory) {
      counts[i.slot] = (counts[i.slot] || 0) + 1;
      if (i.rarity === 0) c++;
    }
    return { slotCounts: counts, commons: c };
  }, [inventory]);
  const shown = useMemo(() => (filter === 'ALL' ? inventory : inventory.filter((i) => i.slot === filter)), [inventory, filter]);

  // The inspector reads live state, so it never shows an item that has moved or gone.
  let view: InspectView | null = null;
  if (target?.kind === 'item') {
    const item = inventory.find((i) => i.id === target.itemId);
    if (item) view = { kind: 'inventory', item, equipped: equipped[item.slot] };
  } else if (target?.kind === 'slot') {
    const def = SLOTS.find((s) => s.id === target.slot);
    const item = equipped[target.slot];
    if (def?.sealed) view = { kind: 'sealed', slot: target.slot };
    else if (item) view = { kind: 'equipped', item };
    else view = { kind: 'empty', slot: target.slot };
  }
  // A new subject remounts the card, so an armed SALVAGE never carries over to another item.
  const viewKey = !view ? 'none' : 'item' in view ? `${view.kind}:${view.item.id}` : `${view.kind}:${view.slot}`;

  const equip = (item: Item) => {
    const res = dispatch({ type: 'EQUIP_ITEM', itemId: item.id });
    setTarget(null);
    flash(res.ok ? `Equipped ${rarityOf(item.rarity).displayName} ${slotName(item.slot)}.` : 'Could not equip that item.');
  };
  const unequip = (slot: string) => {
    const res = dispatch({ type: 'UNEQUIP_ITEM', slot });
    setTarget(null);
    flash(res.ok ? `${slotName(slot)} moved to storage.` : 'Nothing to unequip.');
  };
  const salvage = (item: Item) => {
    const res = dispatch({ type: 'SALVAGE_ITEM', itemId: item.id });
    setTarget(null);
    flash(res.ok ? `Salvaged: +${formatNumber(res.value ?? 0)} scraps.` : 'Could not salvage that item.');
  };
  const salvageCommons = () => {
    const res = dispatch({ type: 'SALVAGE_COMMONS' });
    flash(res.ok ? `Salvaged commons: +${formatNumber(res.value ?? 0)} scraps.` : 'No commons to salvage.');
  };

  // A filter cell: the slot over its count, sized to share one row with the others, never scrolled.
  const chip = (id: string, label: string, count: number) => {
    const active = filter === id;
    return (
      <button
        key={id}
        type="button"
        aria-pressed={active}
        aria-label={`${label} (${formatNumber(count)})`}
        onClick={() => setFilter(id)}
        className={`min-w-0 min-h-[36px] px-0.5 flex flex-col items-center justify-center gap-0.5 border transition-colors active:translate-y-0.5 ${
          active ? 'bg-neon text-abyss border-neon' : 'bg-panel text-dim border-line hover:text-ink'
        }`}
      >
        <span className="max-w-full truncate text-[9px] font-tech font-bold uppercase leading-none">{label}</span>
        <span className="text-[10px] font-mono-code font-bold leading-none">{formatNumber(count)}</span>
      </button>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PanelHeader
        icon={<Shield size={16} className="text-neon" aria-hidden />}
        title="ARMOR"
        subtitle={
          <span aria-live="polite" className={notice ? 'text-ink' : undefined}>
            {notice ?? 'Kept through every Eclipse.'}
          </span>
        }
        right={
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[9px] font-tech text-dim uppercase tracking-wider">Scraps</span>
            <span className="text-xs font-mono-code font-bold text-gold">⬢ {formatNumber(scraps)}</span>
          </div>
        }
      />

      <TabBody className="!gap-1 !p-1.5">
        {/* Worn gear: six small squares in a row. Relics are not worn; they are attuned in RELICS. */}
        <section aria-label="Equipped" className="flex items-center justify-between gap-1">
          {FORGE_SLOTS.map((slot) => (
            <EquipSquare key={slot.id} slot={slot} item={equipped[slot.id]} onOpen={openSlot} />
          ))}
        </section>

        {/* The seven filters share one row with SALVAGE; nothing scrolls sideways or hides behind it. */}
        <div className="flex items-stretch gap-1">
          <div className="flex-1 min-w-0 grid grid-cols-7 gap-1" role="group" aria-label="Filter storage">
            {chip('ALL', 'All', inventory.length)}
            {FORGE_SLOTS.map((s) => chip(s.id, s.displayName, slotCounts[s.id] || 0))}
          </div>
          <TwoTapButton
            variant="ghost"
            size="sm"
            className="shrink-0 min-w-[60px] !px-1.5"
            disabled={commons === 0}
            label={
              <>
                SALVAGE {formatNumber(commons)}
                <span className="sr-only"> commons for {formatNumber(commons * COMMON_YIELD)} scraps</span>
              </>
            }
            armedLabel={
              <>
                +{formatNumber(commons * COMMON_YIELD)} ⬢ ?<span className="sr-only">, tap again to salvage every common</span>
              </>
            }
            onConfirm={salvageCommons}
          />
        </div>

        {/* Storage: a dense five-column grid of squares, newest first. */}
        {shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-5 text-center text-dim border border-dashed border-line">
            <Package size={20} className="opacity-40" aria-hidden />
            <span className="text-[10px] font-tech">
              {inventory.length === 0
                ? 'Storage is empty. Enemies sometimes drop gear and bosses always do.'
                : `No ${slotName(filter).toLowerCase()} gear in storage.`}
            </span>
          </div>
        ) : (
          <section aria-label={`Storage, ${formatNumber(inventory.length)} items, newest first`} className="grid grid-cols-5 gap-1">
            {shown.map((item) => (
              <ItemSquare key={item.id} item={item} isNew={isNew(item)} onOpen={openItem} />
            ))}
          </section>
        )}

        <ForgeSection onForged={onForged} onNotice={flash} />
      </TabBody>

      <Inspector
        key={viewKey}
        view={view}
        isNew={view?.kind === 'inventory' ? isNew(view.item) : false}
        onClose={close}
        onEquip={equip}
        onUnequip={unequip}
        onSalvage={salvage}
      />
    </div>
  );
};
