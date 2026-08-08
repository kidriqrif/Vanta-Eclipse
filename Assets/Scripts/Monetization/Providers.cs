// Ported from scripts/monetization/{ad,billing,stub_ad,stub_billing}_provider.gd
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using VantaEclipse.Core;

namespace VantaEclipse.Monetization
{
    /// <summary>Shows a rewarded ad and reports whether it was watched to
    /// completion.</summary>
    public interface IAdProvider
    {
        /// <summary>Callback receives true only if the reward was earned.</summary>
        IEnumerator RequestRewarded(string placementId, Action<bool> onComplete);
    }

    /// <summary>Runs a store purchase and restores non-consumables.</summary>
    public interface IBillingProvider
    {
        IEnumerator Purchase(string productId, Action<bool> onComplete);
        IEnumerator RestorePurchases(Action<List<string>> onComplete);
    }

    /// <summary>
    /// A three-second timer standing in for an ad network.
    ///
    /// Its "watch an ad" button is a button that lies, which is exactly why
    /// MonetizationManager.PaidSurfacesAvailable gates every surface that could
    /// present it. Shipping this visible would show players an offer the game
    /// cannot honour.
    /// </summary>
    public sealed class StubAdProvider : IAdProvider
    {
        public const float FakeWatchSeconds = 3f;

        public IEnumerator RequestRewarded(string placementId, Action<bool> onComplete)
        {
            yield return new WaitForSecondsRealtime(FakeWatchSeconds);
            onComplete?.Invoke(true);
        }
    }

    /// <summary>
    /// Grants every purchase without charging anything.
    ///
    /// This is the reason USE_STUB_PROVIDERS is a shipping safeguard rather
    /// than a debug convenience: a released stub build would hand out
    /// remove_ads and shard packs free to anyone who tapped BUY.
    /// </summary>
    public sealed class StubBillingProvider : IBillingProvider
    {
        public IEnumerator Purchase(string productId, Action<bool> onComplete)
        {
            yield return null;
            onComplete?.Invoke(true);
        }

        /// <summary>The stub owns nothing, so restore is a no-op until real
        /// billing lands.</summary>
        public IEnumerator RestorePurchases(Action<List<string>> onComplete)
        {
            yield return null;
            onComplete?.Invoke(new List<string>());
        }
    }

    /// <summary>
    /// Where Unity Ads goes.
    ///
    /// TODO(pre-release, BLOCKING): implement against com.unity.ads, then flip
    /// MonetizationManager.UseStubProviders to false. Both need Play Console
    /// setup that does not exist yet.
    /// </summary>
    public sealed class UnityAdProvider : IAdProvider
    {
        public IEnumerator RequestRewarded(string placementId, Action<bool> onComplete)
        {
            Debug.LogError("UnityAdProvider is not implemented — refusing to claim a watch.");
            yield return null;
            onComplete?.Invoke(false);
        }
    }

    /// <summary>
    /// Where Unity IAP goes.
    ///
    /// TODO(pre-release, BLOCKING): implement against com.unity.purchasing.
    /// Returning false is deliberate: an unimplemented provider must refuse a
    /// purchase, never silently succeed the way the stub does.
    /// </summary>
    public sealed class UnityBillingProvider : IBillingProvider
    {
        public IEnumerator Purchase(string productId, Action<bool> onComplete)
        {
            Debug.LogError("UnityBillingProvider is not implemented — refusing the purchase.");
            yield return null;
            onComplete?.Invoke(false);
        }

        public IEnumerator RestorePurchases(Action<List<string>> onComplete)
        {
            yield return null;
            onComplete?.Invoke(new List<string>());
        }
    }
}
