import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Gift, Info, Loader2, Palette, Play, ShieldCheck, ShoppingBag, Sparkles, Zap } from 'lucide-react';
import { ADS, COSMETICS, PRODUCTS } from '../data/definitions';
import { rgbaFromUnit, selectHasRemovedAds } from '../game/selectors';
import { useDispatch, useGameState, useStats } from '../hooks/useGame';
import { useAdOffer, useStore } from '../hooks/useMonetization';
import type { AdPlacementDefinition, CosmeticDefinition, ShopProductDefinition } from '../types/game';
import { formatNumber } from '../utils/numberFormat';
import { Button, Panel, PanelHeader, TabBody } from './ui';

/** offline_double is contextual: it only makes sense in the offline modal, which has an amount to double. */
const OFFERS = ADS.filter((a) => !a.contextual).sort((a, b) => a.sortOrder - b.sortOrder);
const SORTED_PRODUCTS = [...PRODUCTS].sort((a, b) => a.sortOrder - b.sortOrder);
const SORTED_COSMETICS = [...COSMETICS].sort((a, b) => a.sortOrder - b.sortOrder);

interface Note {
  text: string;
  tone: 'ok' | 'warn';
}

function useMountedRef() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

/** A one-line status that clears itself. `show` is safe to call after an await (ignored once unmounted). */
function useNote(): [Note | null, (text: string, tone?: Note['tone']) => void] {
  const [note, setNote] = useState<Note | null>(null);
  const mounted = useMountedRef();
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), note.tone === 'warn' ? 5000 : 2500);
    return () => clearTimeout(t);
  }, [note]);
  const show = useCallback(
    (text: string, tone: Note['tone'] = 'ok') => {
      if (mounted.current) setNote({ text, tone });
    },
    [mounted],
  );
  return [note, show];
}

const NoteLine: React.FC<{ note: Note | null }> = ({ note }) => (
  <p role="status" aria-live="polite" className={`text-[10px] font-tech leading-tight ${note?.tone === 'warn' ? 'text-gold' : 'text-toxic'}`}>
    {note && (
      <span className="inline-flex items-center gap-1 pt-0.5">
        {note.tone === 'warn' ? <Info size={11} aria-hidden /> : <Check size={11} aria-hidden />}
        {note.text}
      </span>
    )}
  </p>
);

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; right?: React.ReactNode }> = ({ icon, title, right }) => (
  <div className="flex items-center justify-between gap-2">
    <h3 className="text-[11px] font-display font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
      {icon}
      {title}
    </h3>
    {right}
  </div>
);

/** A state, not an action: shown where a button would be, at the same height. */
const StateBadge: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span
    className={`min-h-[32px] px-2 inline-flex items-center justify-center gap-1 border border-neon/60 bg-void text-neon text-[10px] font-display font-bold uppercase ${className}`}
  >
    {children}
  </span>
);

// ---------------------------------------------------------------- bonus offers

function rewardText(def: AdPlacementDefinition, rewardRate: number): string {
  if (def.rewardKind === 'ESSENCE') return `+${formatNumber(Math.round(rewardRate * def.rewardAmount))} Essence`;
  if (def.rewardKind === 'TOKEN') {
    const n = Math.max(1, Math.round(def.rewardAmount));
    return `+${formatNumber(n)} Arcade Token${n === 1 ? '' : 's'}`;
  }
  return '';
}

const OfferRow: React.FC<{ def: AdPlacementDefinition }> = ({ def }) => {
  const offer = useAdOffer(def.id);
  const { rewardRate } = useStats();
  const [note, show] = useNote();

  const capped = offer.remaining <= 0;
  const blocked = capped || !offer.canWatch;
  const label = offer.busy
    ? offer.instant
      ? 'CLAIMING…'
      : 'VIDEO PLAYING…'
    : capped
      ? 'BACK TOMORROW'
      : !offer.canWatch
        ? 'UNAVAILABLE'
        : offer.instant
          ? 'CLAIM · INSTANT'
          : 'WATCH · CLAIM';

  const onClaim = async () => {
    const ok = await offer.claim();
    if (ok) show('Claimed!');
    else show('Not claimed. No offer was used up.', 'warn');
  };

  return (
    <div className="bg-panel2 border border-line p-2 flex items-center gap-2">
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[11px] font-display font-bold text-ink uppercase truncate">{def.displayName}</span>
        <span className="text-[10px] font-tech text-dim leading-tight">{def.description}</span>
        <span className="text-[11px] font-mono-code font-bold text-neon">{rewardText(def, rewardRate)}</span>
        <span className="text-[10px] font-tech text-dim">
          {formatNumber(offer.remaining)}/{formatNumber(offer.cap)} left today
          {capped ? ' · Back tomorrow' : !offer.canWatch ? ' · Ads unavailable on this device' : ''}
        </span>
        <NoteLine note={note} />
      </div>
      <Button
        size="sm"
        variant={offer.instant ? 'gold' : 'primary'}
        className="shrink-0 min-w-[104px] disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={blocked || offer.busy}
        aria-busy={offer.busy}
        onClick={() => void onClaim()}
      >
        {offer.busy ? (
          <Loader2 size={11} className="animate-spin" aria-hidden />
        ) : offer.instant ? (
          <Zap size={11} aria-hidden />
        ) : (
          <Play size={11} aria-hidden />
        )}
        {label}
      </Button>
    </div>
  );
};

const OffersSection: React.FC = () => {
  const adsRemoved = useGameState(selectHasRemovedAds);
  return (
    <Panel tone="neon">
      <SectionTitle
        icon={<Gift size={13} className="text-neon" aria-hidden />}
        title="Bonus offers"
        right={
          adsRemoved ? (
            <span className="text-[9px] font-display font-bold text-neon flex items-center gap-1 uppercase">
              <ShieldCheck size={11} aria-hidden /> Ads removed
            </span>
          ) : undefined
        }
      />
      <p className="text-[10px] font-tech text-dim leading-tight">
        {adsRemoved
          ? 'Every offer is instant, with no video. Daily limits still apply.'
          : 'Optional: watch a short video for a bonus. Skipping costs you nothing.'}
      </p>
      {OFFERS.map((def) => (
        <OfferRow key={def.id} def={def} />
      ))}
    </Panel>
  );
};

// ---------------------------------------------------------------- paid products

const ProductRow: React.FC<{
  def: ShopProductDefinition;
  available: boolean;
  price: string | undefined;
  owned: boolean;
  buying: boolean;
  locked: boolean;
  onBuy: () => void;
}> = ({ def, available, price, owned, buying, locked, onBuy }) => {
  let label: React.ReactNode;
  if (!available) {
    label = 'COMING SOON';
  } else if (!price) {
    label = 'UNAVAILABLE';
  } else if (buying) {
    label = (
      <>
        <Loader2 size={11} className="animate-spin" aria-hidden /> BUYING…
      </>
    );
  } else {
    label = `BUY · ${price}`;
  }
  return (
    <div className={`bg-panel2 border p-2 flex items-center gap-2 ${owned ? 'border-neon/40' : 'border-line'}`}>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[11px] font-display font-bold text-ink uppercase truncate">{def.displayName}</span>
        <span className="text-[10px] font-tech text-dim leading-tight">{def.description}</span>
        {def.consumable && available && <span className="text-[9px] font-tech text-faint">Can be bought more than once.</span>}
      </div>
      {owned ? (
        <StateBadge className="shrink-0 min-w-[104px]">
          <Check size={11} aria-hidden /> OWNED
        </StateBadge>
      ) : (
        <Button
          size="sm"
          variant="gold"
          className="shrink-0 min-w-[104px] disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!available || !price || locked}
          aria-busy={buying}
          onClick={onBuy}
        >
          {label}
        </Button>
      )}
    </div>
  );
};

const ProductsSection: React.FC = () => {
  const store = useStore();
  const entitlements = useGameState((s) => s.shop.entitlements);
  const [buying, setBuying] = useState<string | null>(null);
  const buyingRef = useRef(false);
  const mounted = useMountedRef();
  const [note, show] = useNote();

  const buy = async (def: ShopProductDefinition) => {
    if (buyingRef.current) return;
    buyingRef.current = true;
    setBuying(def.id);
    try {
      const outcome = await store.buy(def.id);
      if (outcome.status === 'purchased') show(`${def.displayName}: purchased. Thank you!`);
      else if (outcome.status === 'failed') show(outcome.message, 'warn');
      else if (outcome.status === 'unavailable') show('The store is not available right now.', 'warn');
      // 'cancelled': the player backed out; say nothing.
    } catch {
      show('Something went wrong with the store. Please try again later.', 'warn');
    } finally {
      buyingRef.current = false;
      if (mounted.current) setBuying(null);
    }
  };

  return (
    <Panel tone="gold">
      <SectionTitle icon={<ShoppingBag size={13} className="text-gold" aria-hidden />} title="Store" />
      {!store.available && <p className="text-[10px] font-tech text-gold leading-tight">Purchases open when the game launches.</p>}
      {SORTED_PRODUCTS.map((def) => (
        <ProductRow
          key={def.id}
          def={def}
          available={store.available}
          price={store.available ? store.priceOf(def.id) : undefined}
          owned={!def.consumable && entitlements.includes(def.id)}
          buying={buying === def.id}
          locked={buying !== null}
          onBuy={() => void buy(def)}
        />
      ))}
      <NoteLine note={note} />
    </Panel>
  );
};

// ---------------------------------------------------------------- cosmetics

const CosmeticCard: React.FC<{
  def: CosmeticDefinition;
  owned: boolean;
  equipped: boolean;
  shards: number;
  onBuy: () => void;
  onEquip: () => void;
}> = ({ def, owned, equipped, shards, onBuy, onEquip }) => {
  const trail = rgbaFromUnit(def.trailColor);
  const short = Math.max(0, def.shardPrice - shards);
  return (
    <div className={`bg-panel2 border p-2 flex flex-col gap-1.5 ${equipped ? 'border-neon' : 'border-line'}`}>
      <div
        className="h-8 border border-line flex items-center justify-end px-2 bg-void"
        style={{ backgroundImage: `linear-gradient(90deg, transparent, ${rgbaFromUnit(def.trailColor, 0.55)})` }}
        aria-hidden
      >
        <span
          className="text-xs font-mono-code font-bold"
          style={{ color: rgbaFromUnit(def.numberColor), textShadow: `0 0 6px ${trail}` }}
        >
          128
        </span>
      </div>
      <div className="flex items-center justify-between gap-1 min-w-0">
        <span className="text-[10px] font-display font-bold text-ink uppercase truncate">{def.displayName}</span>
        <span className="text-[9px] font-tech text-dim uppercase shrink-0">{equipped ? 'Equipped' : owned ? 'Owned' : 'Locked'}</span>
      </div>
      {equipped ? (
        <StateBadge className="w-full">
          <Check size={11} aria-hidden /> EQUIPPED
        </StateBadge>
      ) : owned ? (
        <Button size="sm" variant="primary" block onClick={onEquip}>
          EQUIP
        </Button>
      ) : (
        <Button
          size="sm"
          variant="gold"
          block
          disabled={short > 0}
          className="disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={onBuy}
          aria-label={short > 0 ? `${def.displayName}: costs ${formatNumber(def.shardPrice)} shards, need ${formatNumber(short)} more` : undefined}
        >
          {short > 0 ? `NEED ${formatNumber(short)} MORE` : `BUY · ${formatNumber(def.shardPrice)} SHARDS`}
        </Button>
      )}
      {!owned && short > 0 && <span className="text-[9px] font-tech text-dim">Costs {formatNumber(def.shardPrice)} shards</span>}
    </div>
  );
};

const CosmeticsSection: React.FC = () => {
  const dispatch = useDispatch();
  const ownedIds = useGameState((s) => s.shop.ownedCosmetics);
  const activeId = useGameState((s) => s.shop.activeCosmeticId);
  const shards = useGameState((s) => s.currencies.astral_shards);
  const [note, show] = useNote();

  const buy = (def: CosmeticDefinition) => {
    const r = dispatch({ type: 'BUY_COSMETIC', id: def.id });
    if (r.ok) show(`${def.displayName} bought and equipped.`);
    else show(r.reason === 'not_enough' ? 'Not enough Astral Shards.' : 'Could not buy that trail.', 'warn');
  };

  const equip = (def: CosmeticDefinition) => {
    const r = dispatch({ type: 'SET_COSMETIC', id: def.id });
    if (r.ok) show(`${def.displayName} equipped.`);
    else show('You do not own that trail yet.', 'warn');
  };

  return (
    <Panel>
      <SectionTitle
        icon={<Palette size={13} className="text-purple" aria-hidden />}
        title="Tap trails"
        right={
          <span className="text-[10px] font-mono-code font-bold text-gold flex items-center gap-1">
            <Sparkles size={11} aria-hidden />
            {formatNumber(shards)} <span className="font-tech font-normal text-dim">shards</span>
          </span>
        }
      />
      <p className="text-[10px] font-tech text-dim leading-tight">
        Colours your tap trail and damage numbers. Looks only: no effect on stats. Earn Astral Shards from Journal quests.
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {SORTED_COSMETICS.map((def) => (
          <CosmeticCard
            key={def.id}
            def={def}
            owned={def.shardPrice <= 0 || ownedIds.includes(def.id)}
            equipped={activeId === def.id}
            shards={shards}
            onBuy={() => buy(def)}
            onEquip={() => equip(def)}
          />
        ))}
      </div>
      <NoteLine note={note} />
    </Panel>
  );
};

// ---------------------------------------------------------------- the tab

/** BAZAAR: opt-in bonus offers, the (future) Play store, and cosmetic tap trails. */
export const ShopPanel: React.FC = () => (
  <div className="flex-1 min-h-0 flex flex-col">
    <PanelHeader
      icon={<ShoppingBag size={16} className="text-neon" aria-hidden />}
      title="BAZAAR"
      subtitle="Optional bonuses, the store, and tap trails."
    />
    <TabBody>
      <OffersSection />
      <ProductsSection />
      <CosmeticsSection />
    </TabBody>
  </div>
);
