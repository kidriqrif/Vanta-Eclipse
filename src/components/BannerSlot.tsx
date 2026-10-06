import React, { useEffect } from 'react';
import { selectHasRemovedAds } from '../game/selectors';
import { useGameState } from '../hooks/useGame';
import { useBannerHeight } from '../hooks/useMonetization';
import { ads } from '../services/ads';

/** Empty space between the nav bar and the ad, so a low tap on a tab never lands on the ad. */
export const BANNER_GAP_PX = 12;

/**
 * Reserves the strip the native AdMob banner covers at the bottom of the screen, plus a small gap
 * above it, so no game UI sits underneath the ad and nothing tappable touches it. There is no
 * banner on the web, and none once Remove Ads is owned.
 */
export const BannerSlot: React.FC = () => {
  const removed = useGameState(selectHasRemovedAds);
  const height = useBannerHeight();
  useEffect(() => {
    if (removed) void ads.hideBanner();
    else void ads.showBanner();
  }, [removed]);
  if (removed || height <= 0) return null;
  return <div className="w-full shrink-0 bg-abyss border-t border-line" style={{ height: height + BANNER_GAP_PX }} aria-hidden="true" />;
};
