import React, { useEffect } from 'react';
import { selectHasRemovedAds } from '../game/selectors';
import { useGameState } from '../hooks/useGame';
import { useBannerHeight } from '../hooks/useMonetization';
import { ads } from '../services/ads';

/**
 * Reserves the strip the native AdMob banner covers at the bottom of the screen, so no game UI
 * sits underneath it. There is no banner on the web, and none once Remove Ads is owned.
 */
export const BannerSlot: React.FC = () => {
  const removed = useGameState(selectHasRemovedAds);
  const height = useBannerHeight();
  useEffect(() => {
    if (removed) void ads.hideBanner();
    else void ads.showBanner();
  }, [removed]);
  if (removed || height <= 0) return null;
  return <div className="w-full shrink-0 bg-abyss border-t border-line" style={{ height }} aria-hidden="true" />;
};
