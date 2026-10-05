import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Layers } from 'lucide-react';
import { CARD_RARITIES, PETS } from '../data/definitions';
import type { Card } from '../types/game';
import type { GameState } from '../game/state';
import { CARD_COLLECTION_CAP, WORLD_TWO_FIRST_LEVEL } from '../game/state';
import { PET_ABSORB_CAP, petBonusValue, petDisplayName, petLevelFromXp, petSprite } from '../game/stats';
import { VIGOR_TO_BONUS } from '../game/reducer';
import { useDispatch, useGameState, useGameStore } from '../hooks/useGame';
import { formatNumber, formatPercent } from '../utils/numberFormat';
import { Button, PanelHeader, TabBody } from './ui';

const NOTICE_MS = 3500;

const BONUS_NOUN: Record<string, string> = {
  essence: 'essence',
  tap_pct: 'tap damage',
};

const REFUSALS: Record<string, string> = {
  no_pet: `Choose an active companion first (they awaken at level ${WORLD_TWO_FIRST_LEVEL})`,
  no_gain: 'Your companion is maxed out — this card would be wasted',
  missing: 'That card is no longer in your collection',
};

type Block = 'no_pet' | 'no_gain' | null;

const selectCards = (s: GameState) => s.cards;
const selectAwakened = (s: GameState) => s.relicsAwakened;
const selectActivePetId = (s: GameState) => s.activePetId;
const selectActivePet = (s: GameState) => (s.activePetId ? s.pets[s.activePetId] ?? null : null);

/** Why ABSORB would be refused right now, matching the reducer's ABSORB_CARD rules. */
function selectBlock(s: GameState): Block {
  const id = s.activePetId;
  const pet = id ? s.pets[id] : undefined;
  if (!id || !pet) return 'no_pet';
  const def = PETS.find((p) => p.id === id);
  const atMax = !!def && petLevelFromXp(id, pet.xp) >= def.maxLevel;
  return atMax && (pet.absorbed || 0) >= PET_ABSORB_CAP ? 'no_gain' : null;
}

const pct = (v: number) => formatPercent(v, 1);

const CardRow: React.FC<{ card: Card; block: Block; noun: string; onAbsorb: (card: Card) => void }> = React.memo(
  ({ card, block, noun, onAbsorb }) => {
    const rarity = CARD_RARITIES.find((r) => r.id === card.rarity);
    const color = rarity?.tierColor;
    const rarityName = rarity?.displayName ?? card.rarity;
    return (
      <div className="bg-panel border border-line border-l-4 p-2 flex items-center gap-2" style={color ? { borderLeftColor: color } : undefined}>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="shrink-0 text-[9px] font-mono-code font-black uppercase border px-1 leading-4"
              style={color ? { color, borderColor: color } : undefined}
            >
              {rarityName}
            </span>
            <span className="text-[11px] font-display font-bold text-ink truncate">{card.bossName}</span>
          </div>
          <span className="text-[10px] font-mono-code text-dim leading-tight">
            Boss Lv {formatNumber(card.level)} · Power {formatNumber(card.power)} · Vigor {formatNumber(card.vigor)}
          </span>
          <span className="text-[10px] font-tech text-ink leading-tight">
            <span className="text-gold">+{formatNumber(card.power)} XP</span>
            {' · '}
            <span className="text-neon">
              {pct(card.vigor * VIGOR_TO_BONUS)} {noun}
            </span>{' '}
            <span className="text-dim">permanent</span>
          </span>
        </div>
        <div className="shrink-0 w-[84px]">
          <Button
            variant={block ? 'ghost' : 'primary'}
            size="md"
            block
            disabled={block !== null}
            onClick={() => onAbsorb(card)}
            aria-label={`Absorb ${rarityName} ${card.bossName} card${block ? `, unavailable: ${REFUSALS[block]}` : ''}`}
          >
            {block === 'no_gain' ? 'MAXED' : block === 'no_pet' ? 'NO PET' : 'ABSORB'}
          </Button>
        </div>
      </div>
    );
  },
);
CardRow.displayName = 'CardRow';

/** The CARDS tab: boss cards, absorbed into the active companion for XP and a permanent bonus. */
export const CardsCollection: React.FC = () => {
  const dispatch = useDispatch();
  const store = useGameStore();
  const cards = useGameState(selectCards);
  const awakened = useGameState(selectAwakened);
  const activePetId = useGameState(selectActivePetId);
  const activePet = useGameState(selectActivePet);
  const block = useGameState(selectBlock);

  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = null;
    },
    [],
  );

  const flash = useCallback((text: string, ok: boolean) => {
    setNotice({ text, ok });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => {
      noticeTimer.current = null;
      setNotice(null);
    }, NOTICE_MS);
  }, []);

  const absorb = useCallback(
    (card: Card) => {
      // Read the companion as it is right before the absorb so the message states the real gain.
      const before = store.getState();
      const petId = before.activePetId;
      const pet = petId ? before.pets[petId] : undefined;
      const result = dispatch({ type: 'ABSORB_CARD', cardId: card.id });
      if (!result.ok) {
        flash(REFUSALS[result.reason ?? ''] ?? 'That card could not be absorbed', false);
        return;
      }
      if (!petId || !pet) return;
      const def = PETS.find((p) => p.id === petId);
      const lvBefore = petLevelFromXp(petId, pet.xp);
      const lvAfter = petLevelFromXp(petId, pet.xp + card.power);
      const bonusGain = Math.max(0, Math.min(PET_ABSORB_CAP - (pet.absorbed || 0), card.vigor * VIGOR_TO_BONUS));
      const parts: string[] = [];
      if (lvAfter > lvBefore) parts.push(`Lv ${formatNumber(lvBefore)} → ${formatNumber(lvAfter)}`);
      else if (!def || lvBefore < def.maxLevel) parts.push(`+${formatNumber(card.power)} XP`);
      if (bonusGain > 0) parts.push(`${pct(bonusGain)} ${def ? BONUS_NOUN[def.bonusStat] ?? def.bonusStat : 'bonus'}`);
      flash(`${petDisplayName(petId, lvAfter)} absorbed the card: ${parts.join(', ')}`, true);
    },
    [store, dispatch, flash],
  );

  // Newest first. The reducer already stores them that way; the stable sort also orders migrated saves
  // and keeps array order for ties (ids are renumbered on load, so they are not a reliable age).
  const sorted = useMemo(() => [...cards].sort((a, b) => b.obtainedAt - a.obtainedAt), [cards]);

  const petDef = activePetId ? PETS.find((p) => p.id === activePetId) : undefined;
  const noun = petDef ? BONUS_NOUN[petDef.bonusStat] ?? petDef.bonusStat : 'companion bonus';
  const petLevel = activePetId && activePet ? petLevelFromXp(activePetId, activePet.xp) : 0;
  const absorbed = Math.min(PET_ABSORB_CAP, activePet?.absorbed || 0);
  const levelMaxed = !!petDef && petLevel >= petDef.maxLevel;
  const bonusCapped = absorbed >= PET_ABSORB_CAP;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PanelHeader
        icon={<Layers size={16} className="text-neon" aria-hidden />}
        title="BOSS CARDS"
        subtitle="Every boss you defeat drops a card."
        right={
          <span className="text-[10px] font-mono-code font-bold text-dim border border-line px-1.5 py-1">
            {formatNumber(cards.length)} / {formatNumber(CARD_COLLECTION_CAP)}
          </span>
        }
      />

      <TabBody>
        {activePetId && activePet && petDef ? (
          <div className="bg-panel border border-neon/50 p-2.5 flex items-center gap-2.5">
            <div className="w-12 h-12 shrink-0 bg-panel2 border border-line flex items-center justify-center p-1">
              <img src={petSprite(activePetId, petLevel)} alt="" className="w-full h-full object-contain pixelated" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-[9px] font-tech text-dim uppercase tracking-wider">Cards go into</span>
              <div className="flex flex-wrap items-center gap-x-1.5">
                <span className="text-xs font-display font-bold text-ink uppercase tracking-wide">
                  {petDisplayName(activePetId, petLevel)}
                </span>
                <span className="text-[10px] font-mono-code font-bold text-dim border border-line px-1 leading-4">
                  LV {formatNumber(petLevel)}/{formatNumber(petDef.maxLevel)}
                </span>
              </div>
              <span className="text-[10px] font-tech text-dim leading-tight">
                Bonus <span className="text-neon font-bold">{pct(petBonusValue(activePetId, activePet))} {noun}</span> · from cards{' '}
                {pct(absorbed)} of {pct(PET_ABSORB_CAP)} max
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-panel border border-gold/60 p-2.5 flex items-start gap-2">
            <AlertTriangle size={14} className="text-gold shrink-0 mt-px" aria-hidden />
            <span className="text-[11px] font-tech text-ink leading-snug">
              {awakened ? 'Choose an active companion in the BEAST tab to absorb cards.' : REFUSALS.no_pet}. Your cards stay
              here until then.
            </span>
          </div>
        )}

        {block === 'no_gain' ? (
          <div className="bg-panel border border-gold/60 p-2 flex items-start gap-2">
            <AlertTriangle size={14} className="text-gold shrink-0 mt-px" aria-hidden />
            <span className="text-[10px] font-tech text-ink leading-snug">
              {REFUSALS.no_gain}. Set another companion active in the BEAST tab.
            </span>
          </div>
        ) : levelMaxed ? (
          <p className="text-[10px] font-tech text-dim px-0.5">Max level reached: cards now only add to the permanent bonus.</p>
        ) : bonusCapped && activePet ? (
          <p className="text-[10px] font-tech text-dim px-0.5">Card bonus is at its {pct(PET_ABSORB_CAP)} cap: cards now only give XP.</p>
        ) : null}

        <div aria-live="polite" className="min-h-0">
          {notice && (
            <div
              className={`animate-fade-in border p-2 text-[11px] font-tech leading-snug flex items-start gap-1.5 ${
                notice.ok ? 'border-neon/60 bg-neon/10 text-ink' : 'border-crimson/60 bg-crimson/10 text-ink'
              }`}
            >
              {notice.ok ? (
                <Check size={13} className="text-neon shrink-0 mt-px" aria-hidden />
              ) : (
                <AlertTriangle size={13} className="text-crimson shrink-0 mt-px" aria-hidden />
              )}
              <span>{notice.text}</span>
            </div>
          )}
        </div>

        <p className="text-[10px] font-tech text-dim leading-snug px-0.5">
          {formatNumber(cards.length)} / {formatNumber(CARD_COLLECTION_CAP)} — the oldest card is discarded when full. Absorbing a
          card gives its power as companion XP and adds vigor × {pct(VIGOR_TO_BONUS).replace(/^\+/, '')} to the active
          companion’s bonus, permanently (up to {pct(PET_ABSORB_CAP)} in total).
        </p>

        {sorted.length === 0 ? (
          <div className="bg-panel border border-line p-6 flex flex-col items-center gap-2 text-center">
            <Layers size={20} className="text-faint" aria-hidden />
            <span className="text-[11px] font-tech text-dim">No cards yet. Every boss you defeat drops one.</span>
          </div>
        ) : (
          sorted.map((card) => <CardRow key={card.id} card={card} block={block} noun={noun} onAbsorb={absorb} />)
        )}
      </TabBody>
    </div>
  );
};
