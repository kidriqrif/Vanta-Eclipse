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
  private canRequestAds = false;
  private privacyOptionsRequired = false;
  private rewardedBusy = false;
  private bannerVisible = false;
  private bannerHeight = 0;
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

  init(): Promise<void> {
    if (!this.initPromise) this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit() {
    if (!this.isNative) return;
    try {
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
      await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => {
        this.bannerHeight = size.height || 0;
        this.notify();
      });
    } catch (err) {
      console.warn('AdMob init failed; ads disabled for this session', err);
      this.canRequestAds = false;
    }
    this.notify();
  }

  /** Lets the player revisit their consent choice (required by UMP where it applies). */
  async showPrivacyOptions(): Promise<void> {
    if (!this.isNative) return;
    try {
      await AdMob.showPrivacyOptionsForm();
      const info = await AdMob.requestConsentInfo();
      this.canRequestAds = info.canRequestAds;
      this.notify();
    } catch (err) {
      console.warn('Privacy options form failed', err);
    }
  }

  async showBanner(): Promise<void> {
    await this.init();
    if (!this.isNative || !this.canRequestAds || this.bannerVisible) return;
    try {
      await AdMob.showBanner({
        adId: ADMOB.bannerAdUnitId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: ADMOB.isTesting,
      });
      this.bannerVisible = true;
      if (!this.bannerHeight) this.bannerHeight = 50;
    } catch (err) {
      console.warn('Banner failed to show', err);
    }
    this.notify();
  }

  async hideBanner(): Promise<void> {
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
        const settle = (o: RewardedOutcome) => {
          if (!settled) {
            settled = true;
            resolve(o);
          }
        };
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
        // Never leave the offer button spinning forever.
        setTimeout(() => settle(rewarded ? 'rewarded' : 'failed'), 120_000);
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
