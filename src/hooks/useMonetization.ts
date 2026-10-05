import { useCallback, useState, useSyncExternalStore } from 'react';
import { ADS } from '../data/definitions';
import { selectAdOffer, selectHasRemovedAds } from '../game/selectors';
import { ads } from '../services/ads';
import { billing, type PurchaseOutcome } from '../services/billing';
import { useDispatch, useGameState, useToday, shallowEqual } from './useGame';

const subscribeAds = (l: () => void) => ads.subscribe(l);
const subscribeBilling = (l: () => void) => billing.subscribe(l);

export interface AdOffer {
  /** Today's offers remaining (the cap applies with or without Remove Ads). */
  remaining: number;
  cap: number;
  /** True when Remove Ads makes the offer instant, with no video. */
  instant: boolean;
  /** False when this platform cannot show an ad right now (and Remove Ads is not owned). */
  canWatch: boolean;
  busy: boolean;
  /** Runs the offer. Resolves true when the reward was granted. */
  claim: () => Promise<boolean>;
}

/** One opt-in rewarded offer: video (or instant with Remove Ads) → reward → counted. */
export function useAdOffer(placementId: string): AdOffer {
  const dispatch = useDispatch();
  const today = useToday();
  const offer = useGameState((s) => selectAdOffer(s, placementId, today), shallowEqual);
  const instant = useGameState(selectHasRemovedAds);
  useSyncExternalStore(subscribeAds, () => ads.canOfferRewarded());
  const [busy, setBusy] = useState(false);

  const claim = useCallback(async () => {
    if (busy || !offer.available) return false;
    if (!ADS.some((a) => a.id === placementId)) return false;
    setBusy(true);
    try {
      if (!instant) {
        const outcome = await ads.showRewarded();
        if (outcome !== 'rewarded') return false;
      }
      return dispatch({ type: 'AD_REWARD', placementId }).ok;
    } finally {
      setBusy(false);
    }
  }, [busy, dispatch, instant, offer.available, placementId]);

  return {
    remaining: offer.remaining,
    cap: offer.cap,
    instant,
    canWatch: offer.available && (instant || ads.canOfferRewarded()),
    busy,
    claim,
  };
}

export interface StoreState {
  available: boolean;
  priceOf: (productId: string) => string | undefined;
  buy: (productId: string) => Promise<PurchaseOutcome>;
}

/** Play Billing for the shop. `available` is false while BILLING_ENABLED is off. */
export function useStore(): StoreState {
  const dispatch = useDispatch();
  const available = useSyncExternalStore(subscribeBilling, () => billing.isAvailable());
  const buy = useCallback(
    async (productId: string) => {
      const outcome = await billing.purchase(productId);
      if (outcome.status === 'purchased') dispatch({ type: 'PURCHASE_GRANTED', productId: outcome.productId });
      return outcome;
    },
    [dispatch],
  );
  return { available, priceOf: (id) => billing.getProduct(id)?.price, buy };
}

/** Re-reads purchases from Google Play and re-grants owned entitlements. */
export function useRestorePurchases(): () => Promise<number> {
  const dispatch = useDispatch();
  return useCallback(async () => {
    const owned = await billing.ownedEntitlements();
    if (owned.length === 0) return 0;
    return dispatch({ type: 'RESTORE_ENTITLEMENTS', productIds: owned }).value ?? 0;
  }, [dispatch]);
}

export function useBannerHeight(): number {
  return useSyncExternalStore(subscribeAds, () => ads.getBannerHeight());
}

export function usePrivacyOptionsRequired(): boolean {
  return useSyncExternalStore(subscribeAds, () => ads.isPrivacyOptionsRequired());
}
