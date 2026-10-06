import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ADS } from '../data/definitions';
import { selectAdOffer, selectHasRemovedAds } from '../game/selectors';
import type { Action, ActionResult } from '../game/actions';
import { ads } from '../services/ads';
import { billing, type PurchaseOutcome } from '../services/billing';
import { useDispatch, useGameState, useToday, shallowEqual } from './useGame';

/**
 * Grants every paid purchase Google Play holds that the save has not seen yet, then finalizes
 * each one (acknowledge or consume). Safe to run any number of times: grants are idempotent
 * per transaction. Returns how many purchases were newly granted; throws if Play is unreachable.
 */
export async function syncPurchases(dispatch: (a: Action) => ActionResult): Promise<number> {
  const owned = await billing.reconcile();
  let granted = 0;
  for (const p of owned) {
    if (dispatch({ type: 'PURCHASE_GRANTED', productId: p.productId, transactionId: p.transactionId }).ok) granted++;
    await billing.finalize(p);
  }
  return granted;
}

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
  const busyRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const claim = useCallback(async () => {
    if (busyRef.current || !offer.available) return false;
    if (!ADS.some((a) => a.id === placementId)) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      if (!instant) {
        const outcome = await ads.showRewarded();
        if (outcome !== 'rewarded') return false;
      }
      // The reward is granted even if the screen that offered it closed during the video.
      return dispatch({ type: 'AD_REWARD', placementId }).ok;
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [dispatch, instant, offer.available, placementId]);

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
    async (productId: string): Promise<PurchaseOutcome> => {
      const outcome = await billing.purchase(productId);
      if (outcome.status === 'purchased') {
        const p = outcome.purchase;
        // Grant (and save) first, finalize second — see src/services/billing.ts.
        dispatch({ type: 'PURCHASE_GRANTED', productId: p.productId, transactionId: p.transactionId });
        await billing.finalize(p);
      } else if (outcome.status === 'owned') {
        // Already bought on this Google account (e.g. a reinstall): restore it instead.
        await syncPurchases(dispatch).catch(() => 0);
      }
      return outcome;
    },
    [dispatch],
  );
  return { available, priceOf: (id) => billing.getProduct(id)?.price, buy };
}

/** Re-reads purchases from Google Play and grants anything owned but missing. Throws if Play is unreachable. */
export function useRestorePurchases(): () => Promise<number> {
  const dispatch = useDispatch();
  return useCallback(() => syncPurchases(dispatch), [dispatch]);
}

export function useBannerHeight(): number {
  return useSyncExternalStore(subscribeAds, () => ads.getBannerHeight());
}

export function usePrivacyOptionsRequired(): boolean {
  return useSyncExternalStore(subscribeAds, () => ads.isPrivacyOptionsRequired());
}
