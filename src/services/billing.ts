import { Capacitor } from '@capacitor/core';
import { PRODUCTS } from '../data/definitions';
import { BILLING_ENABLED } from '../config/monetization';

export interface StoreProduct {
  /** Our product id (remove_ads, starter_pack, shards_small). */
  id: string;
  /** Localized price string straight from Google Play, e.g. "RM 12.90". */
  price: string;
}

/** A purchase Google Play reports as paid, which the game must grant and then finalize. */
export interface PaidPurchase {
  productId: string;
  transactionId: string;
  purchaseToken: string;
  consumable: boolean;
  acknowledged: boolean;
}

export type PurchaseOutcome =
  | { status: 'purchased'; purchase: PaidPurchase }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string }
  | { status: 'unavailable' };

const PURCHASED = '1';

/**
 * Google Play Billing behind one switch (`BILLING_ENABLED` in src/config/monetization.ts).
 *
 * While the switch is off — or off-device — the store reports itself unavailable and the shop
 * shows "COMING SOON". Nothing is ever granted without Google confirming a purchase.
 *
 * Order of operations, so a crash can never lose or duplicate a purchase:
 *   1. Google confirms the purchase.
 *   2. The game grants it (idempotent per transaction id) and saves.
 *   3. Only then is it acknowledged (entitlements) or consumed (shard packs).
 * A purchase that cleared later (pending payment) or was never finalized shows up in
 * `reconcile()` on the next launch and goes through steps 2–3 then. Google refunds anything
 * left unacknowledged for three days.
 *
 * There is no server-side receipt validation (the game has no server).
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

  private async plugin() {
    return import('@capgo/native-purchases');
  }

  private async doInit() {
    if (!BILLING_ENABLED || !Capacitor.isNativePlatform()) return;
    try {
      const { NativePurchases, PURCHASE_TYPE } = await this.plugin();
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
      const { NativePurchases, PURCHASE_TYPE } = await this.plugin();
      const tx = await NativePurchases.purchaseProduct({
        productIdentifier: def.storeId,
        productType: PURCHASE_TYPE.INAPP,
        isConsumable: false,
        autoAcknowledgePurchases: false,
      });
      if (tx.purchaseState !== undefined && String(tx.purchaseState) !== PURCHASED) {
        return { status: 'failed', message: 'Payment is pending. Your item arrives automatically once Google confirms it.' };
      }
      if (!tx.purchaseToken) return { status: 'failed', message: 'Google Play did not return a purchase token.' };
      return {
        status: 'purchased',
        purchase: {
          productId: def.id,
          transactionId: tx.transactionId || tx.purchaseToken,
          purchaseToken: tx.purchaseToken,
          consumable: def.consumable,
          acknowledged: tx.isAcknowledged === true,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/cancel/i.test(message)) return { status: 'cancelled' };
      return { status: 'failed', message };
    }
  }

  /**
   * Every paid purchase Google Play still holds for this account: entitlements, plus any
   * shard pack that was paid but not yet consumed. Throws when Play cannot be reached, so
   * "nothing to restore" is never shown for a network error.
   */
  async reconcile(): Promise<PaidPurchase[]> {
    await this.init();
    if (!this.available) return [];
    const { NativePurchases, PURCHASE_TYPE } = await this.plugin();
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
    const out: PaidPurchase[] = [];
    for (const p of purchases) {
      if (p.purchaseState !== undefined && String(p.purchaseState) !== PURCHASED) continue;
      const def = PRODUCTS.find((d) => d.storeId === p.productIdentifier);
      if (!def || !p.purchaseToken) continue;
      out.push({
        productId: def.id,
        transactionId: p.transactionId || p.purchaseToken,
        purchaseToken: p.purchaseToken,
        consumable: def.consumable,
        acknowledged: p.isAcknowledged === true,
      });
    }
    return out;
  }

  /** Step 3: call only after the purchase has been granted and saved. */
  async finalize(p: PaidPurchase): Promise<void> {
    try {
      const { NativePurchases } = await this.plugin();
      if (p.consumable) await NativePurchases.consumePurchase({ purchaseToken: p.purchaseToken });
      else if (!p.acknowledged) await NativePurchases.acknowledgePurchase({ purchaseToken: p.purchaseToken });
    } catch (err) {
      // Not fatal: the purchase stays un-finalized and reconcile() retries on the next launch.
      console.warn('Could not finalize purchase', err);
    }
  }
}

export const billing = new BillingService();
