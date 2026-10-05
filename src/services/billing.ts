import { Capacitor } from '@capacitor/core';
import { PRODUCTS } from '../data/definitions';
import { BILLING_ENABLED } from '../config/monetization';

export interface StoreProduct {
  /** Our product id (remove_ads, starter_pack, shards_small). */
  id: string;
  /** Localized price string straight from Google Play, e.g. "RM 12.90". */
  price: string;
}

export type PurchaseOutcome =
  | { status: 'purchased'; productId: string }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string }
  | { status: 'unavailable' };

/**
 * Google Play Billing behind one switch (`BILLING_ENABLED` in src/config/monetization.ts).
 *
 * While the switch is off — or off-device — the store reports itself unavailable and the shop
 * shows "COMING SOON". Nothing is ever granted without Google confirming a purchase.
 *
 * There is no server-side receipt validation (the game has no server); grants rely on the
 * Play Billing client's verified purchase state.
 */
class BillingService {
  private products = new Map<string, StoreProduct>();
  private loaded: Promise<void> | null = null;
  private available = false;
  private listeners = new Set<() => void>();

  subscribe(l: () => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  isAvailable(): boolean {
    return this.available;
  }

  getProduct(id: string): StoreProduct | undefined {
    return this.products.get(id);
  }

  init(): Promise<void> {
    if (!this.loaded) this.loaded = this.doInit();
    return this.loaded;
  }

  private async doInit() {
    if (!BILLING_ENABLED || !Capacitor.isNativePlatform()) return;
    try {
      const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
      const supported = await NativePurchases.isBillingSupported();
      if (!supported.isBillingSupported) return;
      const { products } = await NativePurchases.getProducts({
        productIdentifiers: PRODUCTS.map((p) => p.storeId),
        productType: PURCHASE_TYPE.INAPP,
      });
      for (const sp of products) {
        const def = PRODUCTS.find((p) => p.storeId === sp.identifier);
        if (def) this.products.set(def.id, { id: def.id, price: sp.priceString });
      }
      this.available = this.products.size > 0;
    } catch (err) {
      console.warn('Billing unavailable', err);
      this.available = false;
    }
    this.notify();
  }

  async purchase(productId: string): Promise<PurchaseOutcome> {
    await this.init();
    const def = PRODUCTS.find((p) => p.id === productId);
    if (!this.available || !def || !this.products.has(productId)) return { status: 'unavailable' };
    try {
      const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
      const tx = await NativePurchases.purchaseProduct({
        productIdentifier: def.storeId,
        productType: PURCHASE_TYPE.INAPP,
        isConsumable: def.consumable,
        autoAcknowledgePurchases: true,
      });
      // purchaseState "1" is PURCHASED on Android; "pending" purchases are granted on restore later.
      if (tx.purchaseState !== undefined && String(tx.purchaseState) !== '1') {
        return { status: 'failed', message: 'Purchase is pending. It will arrive once Google confirms it.' };
      }
      return { status: 'purchased', productId: def.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/cancel/i.test(message)) return { status: 'cancelled' };
      return { status: 'failed', message };
    }
  }

  /** Product ids of non-consumables this Google account owns (Remove Ads, Starter Pack). */
  async ownedEntitlements(): Promise<string[]> {
    await this.init();
    if (!this.available) return [];
    try {
      const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
      const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
      return purchases
        .filter((p) => p.purchaseState === undefined || String(p.purchaseState) === '1')
        .map((p) => PRODUCTS.find((d) => d.storeId === p.productIdentifier && !d.consumable)?.id)
        .filter((id): id is string => !!id);
    } catch (err) {
      console.warn('Restore failed', err);
      return [];
    }
  }
}

export const billing = new BillingService();
