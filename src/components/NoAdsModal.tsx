import React, { useEffect, useRef, useState } from 'react';
import { Ban, Check, Clock, Info, Loader2, RotateCcw, ShieldCheck, ShoppingBag, Zap } from 'lucide-react';
import { selectHasRemovedAds } from '../game/selectors';
import { useGameState } from '../hooks/useGame';
import { useStore } from '../hooks/useMonetization';
import { Button, Modal } from './ui';

interface NoAdsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenShop: () => void;
}

const PRODUCT_ID = 'remove_ads';

const Perk: React.FC<{ icon: React.ReactNode; title: string; detail: string }> = ({ icon, title, detail }) => (
  <li className="flex items-start gap-2">
    <span className="shrink-0 mt-0.5" aria-hidden>
      {icon}
    </span>
    <span className="flex flex-col">
      <span className="text-[11px] font-tech text-ink font-bold">{title}</span>
      <span className="text-[10px] font-tech text-dim leading-tight">{detail}</span>
    </span>
  </li>
);

/** Mounted only while the dialog is open, so messages and busy state start fresh each time. */
const NoAdsBody: React.FC<{ onOpenShop: () => void }> = ({ onOpenShop }) => {
  const owned = useGameState(selectHasRemovedAds);
  const store = useStore();
  const price = store.available ? store.priceOf(PRODUCT_ID) : undefined;
  const [buying, setBuying] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);
  const buyingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const buy = async () => {
    if (buyingRef.current) return;
    buyingRef.current = true;
    setBuying(true);
    setMessage(null);
    let next: { text: string; tone: 'ok' | 'warn' } | null = null;
    try {
      const outcome = await store.buy(PRODUCT_ID);
      // 'purchased': the owned banner above confirms it.
      if (outcome.status === 'owned') next = { text: 'You already own Remove Ads. It has been restored.', tone: 'ok' };
      else if (outcome.status === 'failed') next = { text: outcome.message, tone: 'warn' };
      else if (outcome.status === 'unavailable') next = { text: 'The store is not available right now.', tone: 'warn' };
      // 'cancelled': the player backed out; say nothing.
    } catch {
      next = { text: 'Something went wrong with the store. Please try again later.', tone: 'warn' };
    } finally {
      buyingRef.current = false;
    }
    if (!mounted.current) return;
    setBuying(false);
    setMessage(next);
  };

  return (
    <>
      {owned ? (
        <div className="bg-active border border-neon/60 p-2 flex items-center gap-2" role="status">
          <Check size={16} className="text-neon shrink-0" aria-hidden />
          <span className="text-[11px] font-tech text-ink leading-tight">
            Ads are removed on this account. Thank you for supporting the game.
          </span>
        </div>
      ) : (
        <p className="text-[11px] font-tech text-dim leading-tight">
          Video ads in Vanta Eclipse are always optional. Remove Ads takes away the banner and skips the videos, and you
          keep every bonus.
        </p>
      )}

      <ul className="bg-panel2 border border-line p-2.5 flex flex-col gap-2">
        <Perk
          icon={<Ban size={13} className="text-neon" />}
          title="No banner ad"
          detail="The banner at the bottom of the screen goes away."
        />
        <Perk
          icon={<Zap size={13} className="text-gold" />}
          title="Bonus offers become instant"
          detail="Tap to claim each bonus straight away, with no video."
        />
        <Perk
          icon={<Clock size={13} className="text-dim" />}
          title="Daily limits still apply"
          detail="You get the same number of bonuses per day as everyone else."
        />
        <Perk
          icon={<RotateCcw size={13} className="text-dim" />}
          title="One-time purchase"
          detail="Tied to your Google Play account. Restore it on a new device from Settings."
        />
      </ul>

      {!owned &&
        (store.available ? (
          <Button
            variant="gold"
            size="lg"
            block
            disabled={!price || buying}
            aria-busy={buying}
            className="disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => void buy()}
          >
            {buying ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden /> WAITING FOR GOOGLE PLAY…
              </>
            ) : price ? (
              <>
                <ShieldCheck size={14} aria-hidden /> BUY · {price}
              </>
            ) : (
              'UNAVAILABLE RIGHT NOW'
            )}
          </Button>
        ) : (
          <div className="flex flex-col gap-1">
            <Button variant="gold" size="lg" block disabled className="disabled:opacity-40 disabled:cursor-not-allowed">
              COMING SOON
            </Button>
            <p className="text-[10px] font-tech text-dim text-center">Purchases open when the game launches.</p>
          </div>
        ))}

      {message && (
        <p
          role="status"
          aria-live="polite"
          className={`text-[10px] font-tech leading-tight flex items-center gap-1 ${message.tone === 'warn' ? 'text-gold' : 'text-toxic'}`}
        >
          {message.tone === 'warn' ? <Info size={11} aria-hidden /> : <Check size={11} aria-hidden />}
          {message.text}
        </p>
      )}

      <Button variant="ghost" size="md" block onClick={onOpenShop}>
        <ShoppingBag size={13} aria-hidden /> SEE BONUS OFFERS
      </Button>
    </>
  );
};

/** What Remove Ads does, stated plainly, with the real store price (or "Coming soon"). */
export const NoAdsModal: React.FC<NoAdsModalProps> = ({ isOpen, onClose, onOpenShop }) => (
  <Modal
    open={isOpen}
    onClose={onClose}
    tone="gold"
    title="Remove Ads"
    icon={<ShieldCheck size={14} className="text-gold" aria-hidden />}
  >
    <NoAdsBody onOpenShop={onOpenShop} />
  </Modal>
);
