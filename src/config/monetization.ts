/**
 * Every monetization switch in one place. At launch you edit this file and
 * android/app/src/main/AndroidManifest.xml (the AdMob APPLICATION_ID) — nothing else.
 *
 * The IDs below are Google's public SAMPLE IDs: they serve test ads only and earn nothing.
 * Replace them with your own AdMob app's unit IDs before the production release.
 */

/** Google's documented sample ad units. https://developers.google.com/admob/android/test-ads */
const SAMPLE_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
const SAMPLE_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';

export const ADMOB = {
  bannerAdUnitId: SAMPLE_BANNER_ID,
  rewardedAdUnitId: SAMPLE_REWARDED_ID,
  /**
   * Marks requests as test traffic. Keep true until real unit IDs are in place and the app is
   * live; clicking your own live ads gets an AdMob account suspended.
   */
  isTesting: true,
};

/**
 * Google Play Billing. Off until the products exist in Play Console (they can be created and
 * license-tested on the closed testing track before production). While off, paid items read
 * "COMING SOON" and nothing is ever granted without a purchase.
 */
export const BILLING_ENABLED = false;
