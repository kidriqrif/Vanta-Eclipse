import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';
import type { PluginListenerHandle } from '@capacitor/core';
import { ADMOB } from '../config/monetization';

export type RewardedOutcome = 'rewarded' | 'dismissed' | 'failed' | 'unavailable' | 'busy';

type Listener = () => void;

const BANNER_RETRY_MIN_MS = 30_000;
const BANNER_RETRY_MAX_MS = 5 * 60_000;
/** Used until AdMob reports the real adaptive-banner height. */
const BANNER_FALLBACK_HEIGHT = 50;
/** How long a rewarded ad may take to appear before the offer gives up. */
const REWARDED_START_TIMEOUT_MS = 60_000;

/**
 * AdMob, wrapped so the game never talks to the plugin directly.
 *
 * Order on Android: initialize → UMP consent (shows Google's form where the law requires it)
 * → only then request ads. Every offer is opt-in and rewarded; nothing is interstitial.
 * On the web there is no ad network: offers are unavailable, except that a dev build
 * (npm run dev) simulates a watch so the flows can be tested in a browser.
 */
class AdsService {
  private initPromise: Promise<void> | null = null;
  /** True once consent has been answered (even if it denied ads); a failed start-up stays false and is retried. */
  private ready = false;
  private listenersAdded = false;
  private canRequestAds = false;
  private privacyOptionsRequired = false;
  private rewardedBusy = false;
  /** What the game wants (banner on unless Remove Ads); a hide always wins over a show in flight. */
  private bannerWanted = false;
  private bannerShowing: Promise<void> | null = null;
  private bannerVisible = false;
  private bannerHeight = 0;
  private bannerRetry: ReturnType<typeof setTimeout> | null = null;
  private bannerRetryMs = BANNER_RETRY_MIN_MS;
  private listeners = new Set<Listener>();

  readonly isNative = Capacitor.isNativePlatform();

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  /** Height in CSS px the native banner currently covers at the bottom of the screen. */
  getBannerHeight(): number {
    return this.bannerVisible ? this.bannerHeight : 0;
  }

  isPrivacyOptionsRequired(): boolean {
    return this.privacyOptionsRequired;
  }

  /** Whether a rewarded offer can be attempted right now on this platform. */
  canOfferRewarded(): boolean {
    return (this.isNative && this.canRequestAds) || (!this.isNative && import.meta.env.DEV);
  }

  /**
   * Starts AdMob and asks for consent. Safe to call repeatedly: a start-up that failed (for
   * example offline at launch) is retried on the next call, which the provider makes on resume.
   */
  init(): Promise<void> {
    if (this.ready || !this.isNative) return Promise.resolve();
    if (!this.initPromise) {
      this.initPromise = this.doInit().finally(() => {
        if (!this.ready) this.initPromise = null;
      });
    }
    return this.initPromise;
  }

  private async doInit() {
    try {
      if (!this.listenersAdded) {
        this.listenersAdded = true;
        await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => {
          this.bannerHeight = size.height || 0;
          this.notify();
        });
        await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
          this.bannerRetryMs = BANNER_RETRY_MIN_MS;
        });
        // A no-fill destroys the native view; schedule a retry instead of giving up for the session.
        await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => {
          this.bannerVisible = false;
          this.bannerHeight = 0;
          this.notify();
          this.scheduleBannerRetry();
        });
      }
      await AdMob.initialize({ initializeForTesting: ADMOB.isTesting });
      const info = await AdMob.requestConsentInfo();
      let canRequest = info.canRequestAds;
      if (!canRequest && info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
        const after = await AdMob.showConsentForm();
        canRequest = after.canRequestAds;
      }
      this.canRequestAds = canRequest;
      // The enum is not re-exported from the package root; its value is the string 'REQUIRED'.
      this.privacyOptionsRequired = String(info.privacyOptionsRequirementStatus) === 'REQUIRED';
      this.ready = true;
    } catch (err) {
      console.warn('AdMob start-up failed; it will be retried', err);
      this.canRequestAds = false;
    }
    this.notify();
    if (this.ready && this.bannerWanted) void this.showBanner();
  }

  /** Lets the player revisit their consent choice (required by UMP where it applies). */
  async showPrivacyOptions(): Promise<void> {
    if (!this.isNative) return;
    try {
      await AdMob.showPrivacyOptionsForm();
      const info = await AdMob.requestConsentInfo();
      this.canRequestAds = info.canRequestAds;
      this.notify();
      if (this.canRequestAds && this.bannerWanted) void this.showBanner();
    } catch (err) {
      console.warn('Privacy options form failed', err);
    }
  }

  private scheduleBannerRetry() {
    if (!this.bannerWanted || this.bannerRetry) return;
    this.bannerRetry = setTimeout(() => {
      this.bannerRetry = null;
      if (this.bannerWanted) void this.showBanner();
    }, this.bannerRetryMs);
    this.bannerRetryMs = Math.min(this.bannerRetryMs * 2, BANNER_RETRY_MAX_MS);
  }

  showBanner(): Promise<void> {
    this.bannerWanted = true;
    if (!this.bannerShowing) {
      this.bannerShowing = this.doShowBanner().finally(() => {
        this.bannerShowing = null;
      });
    }
    return this.bannerShowing;
  }

  private async doShowBanner() {
    await this.init();
    if (!this.bannerWanted || !this.isNative || !this.canRequestAds || this.bannerVisible) return;
    try {
      await AdMob.showBanner({
        adId: ADMOB.bannerAdUnitId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: ADMOB.isTesting,
      });
      if (!this.bannerWanted) {
        // Remove Ads arrived while the banner was loading: take it straight down again.
        await AdMob.removeBanner().catch(() => undefined);
        return;
      }
      this.bannerVisible = true;
      if (!this.bannerHeight) this.bannerHeight = BANNER_FALLBACK_HEIGHT;
    } catch (err) {
      console.warn('Banner failed to show', err);
      this.scheduleBannerRetry();
    }
    this.notify();
  }

  async hideBanner(): Promise<void> {
    this.bannerWanted = false;
    if (this.bannerRetry) {
      clearTimeout(this.bannerRetry);
      this.bannerRetry = null;
    }
    // Let a show in flight finish first; it sees bannerWanted=false and removes itself.
    if (this.bannerShowing) await this.bannerShowing;
    if (!this.isNative || !this.bannerVisible) return;
    this.bannerVisible = false;
    this.notify();
    try {
      await AdMob.removeBanner();
    } catch {
      // already gone
    }
  }

  /**
   * Shows one rewarded video. Resolves 'rewarded' only when AdMob confirms the reward —
   * the caller grants the bonus then, and never before.
   */
  async showRewarded(): Promise<RewardedOutcome> {
    if (this.rewardedBusy) return 'busy';
    if (!this.isNative) {
      if (!import.meta.env.DEV) return 'unavailable';
      this.rewardedBusy = true;
      await new Promise((r) => setTimeout(r, 1200));
      this.rewardedBusy = false;
      return 'rewarded';
    }
    await this.init();
    if (!this.canRequestAds) return 'unavailable';

    this.rewardedBusy = true;
    const handles: Promise<PluginListenerHandle>[] = [];
    try {
      await AdMob.prepareRewardVideoAd({ adId: ADMOB.rewardedAdUnitId, isTesting: ADMOB.isTesting });
      return await new Promise<RewardedOutcome>((resolve) => {
        let rewarded = false;
        let settled = false;
        // Guards only against a show that never starts. Once the ad is on screen the player may
        // leave to the store and come back minutes later; Dismissed or FailedToShow ends it then.
        const watchdog = setTimeout(() => settle(rewarded ? 'rewarded' : 'failed'), REWARDED_START_TIMEOUT_MS);
        const settle = (o: RewardedOutcome) => {
          if (settled) return;
          settled = true;
          clearTimeout(watchdog);
          resolve(o);
        };
        handles.push(AdMob.addListener(RewardAdPluginEvents.Showed, () => clearTimeout(watchdog)));
        handles.push(AdMob.addListener(RewardAdPluginEvents.Rewarded, () => (rewarded = true)));
        handles.push(
          AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
            // The reward event can land just after the dismiss on some devices.
            setTimeout(() => settle(rewarded ? 'rewarded' : 'dismissed'), 400);
          }),
        );
        handles.push(AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => settle('failed')));
        AdMob.showRewardVideoAd()
          .then(() => (rewarded = true))
          .catch(() => settle(rewarded ? 'rewarded' : 'failed'));
      });
    } catch (err) {
      console.warn('Rewarded ad failed', err);
      return 'failed';
    } finally {
      this.rewardedBusy = false;
      for (const h of handles) h.then((x) => x.remove()).catch(() => undefined);
    }
  }
}

export const ads = new AdsService();
