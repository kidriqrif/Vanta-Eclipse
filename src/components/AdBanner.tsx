import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { AdMob, BannerAdPosition, BannerAdSize, BannerAdOptions } from '@capacitor-community/admob';
import { useGame } from '../context/GameContext';
import { ExternalLink, X } from 'lucide-react';

interface SponsorCreative {
  id: string;
  tag: string;
  headline: string;
  subtext: string;
  ctaText: string;
  accentColor: string;
  rewardHint?: string;
}

const SPONSOR_CREATIVES: SponsorCreative[] = [
  {
    id: 'astral_surge',
    tag: 'SPONSOR',
    headline: 'ASTRAL SURGE • FREE BOUNTY',
    subtext: 'Acquire daily free Crystals and Shards in the Bazaar terminal.',
    ctaText: 'ACQUIRE',
    accentColor: '#FFC857',
    rewardHint: '+25 CRYSTALS',
  },
  {
    id: 'cyber_forge',
    tag: 'ARMORY',
    headline: 'QUANTUM FORGE • GEAR REFINEMENT',
    subtext: 'Enhance weapon damage and unlock relic synergies in the armory.',
    ctaText: 'UPGRADE',
    accentColor: '#36D9FF',
    rewardHint: '+ATTACK MATRIX',
  },
  {
    id: 'void_chronicles',
    tag: 'TERMINAL',
    headline: 'TACTICAL MATRIX 1.3',
    subtext: 'Complete all 15 Combat Bounties and conquer Floor 12.',
    ctaText: 'LOGS',
    accentColor: '#E8EDF7',
  },
];

export const AdBanner: React.FC<{ 
  onNavigateToShop?: () => void; 
  onNavigateToJournal?: () => void;
  onNavigateToGear?: () => void;
}> = ({
  onNavigateToShop,
  onNavigateToJournal,
  onNavigateToGear,
}) => {
  const { hasRemovedAds } = useGame();
  const [creativeIndex, setCreativeIndex] = useState(0);
  const [isBannerVisible, setIsBannerVisible] = useState(true);
  const [nativeBannerActive, setNativeBannerActive] = useState(false);

  // Handle native AdMob banner when running on Android/iOS Capacitor
  useEffect(() => {
    let isMounted = true;

    const setupNativeBanner = async () => {
      if (Capacitor.isNativePlatform()) {
        if (hasRemovedAds) {
          try {
            await AdMob.hideBanner();
            await AdMob.removeBanner();
          } catch {
            // ignore
          }
          if (isMounted) setNativeBannerActive(false);
          return;
        }

        try {
          const options: BannerAdOptions = {
            adId: 'ca-app-pub-3940256099942544/6300978111',
            adSize: BannerAdSize.BANNER,
            position: BannerAdPosition.BOTTOM_CENTER,
            margin: 0,
            isTesting: true,
          };
          await AdMob.showBanner(options);
          if (isMounted) setNativeBannerActive(true);
        } catch (err) {
          console.warn('Native AdMob banner fallback:', err);
        }
      }
    };

    setupNativeBanner();

    return () => {
      isMounted = false;
      if (Capacitor.isNativePlatform()) {
        AdMob.hideBanner().catch(() => {});
        AdMob.removeBanner().catch(() => {});
      }
    };
  }, [hasRemovedAds]);

  // Rotate web sponsor creative
  useEffect(() => {
    if (hasRemovedAds) return;
    const timer = setInterval(() => {
      setCreativeIndex((prev) => (prev + 1) % SPONSOR_CREATIVES.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [hasRemovedAds]);

  // Pro users: Banner is completely eradicated
  if (hasRemovedAds || !isBannerVisible) {
    return null;
  }

  if (nativeBannerActive) {
    return (
      <div 
        id="native-admob-placeholder" 
        className="w-full h-[45px] bg-[#171D35] border-t border-white/10 flex items-center justify-center shrink-0 select-none"
      >
        <span className="text-[8px] font-mono-code text-[#8993B2] tracking-widest uppercase">
          [ ADMOB NATIVE ACTIVE ]
        </span>
      </div>
    );
  }

  const creative = SPONSOR_CREATIVES[creativeIndex];

  const handleCtaClick = () => {
    if (creative.id === 'astral_surge') {
      if (onNavigateToShop) onNavigateToShop();
    } else if (creative.id === 'cyber_forge') {
      if (onNavigateToGear) onNavigateToGear();
      else if (onNavigateToShop) onNavigateToShop();
    } else if (creative.id === 'void_chronicles') {
      if (onNavigateToJournal) onNavigateToJournal();
    }
  };

  return (
    <div 
      id="game-ad-banner-container"
      className="w-full shrink-0 px-2 py-1 bg-[#080A12] border-t border-[#30395C] relative z-10 select-none"
    >
      <div className="w-full h-[42px] bg-[#101426] border border-[#30395C] px-2 py-1 flex items-center justify-between gap-2 rounded-none">
        {/* Left Badge + Text */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Ad Tag */}
          <div className="flex flex-col items-center justify-center shrink-0">
            <span className="text-[7px] font-mono-code font-bold bg-[#171D35] border border-[#30395C] text-[#8993B2] px-1 py-0.5 rounded-none">
              AD
            </span>
          </div>

          {/* Text Content */}
          <div className="flex flex-col min-w-0 justify-center">
            <div className="flex items-center gap-1.5 truncate">
              <span 
                className="text-[10px] font-display font-bold uppercase truncate"
                style={{ color: creative.accentColor }}
              >
                {creative.headline}
              </span>
              {creative.rewardHint && (
                <span className="text-[8px] font-mono-code font-bold bg-[#171D35] text-[#FFC857] px-1 border border-[#FFC857]/40 hidden xs:inline-block">
                  {creative.rewardHint}
                </span>
              )}
            </div>
            <p className="text-[9px] font-tech text-[#8993B2] truncate leading-none">
              {creative.subtext}
            </p>
          </div>
        </div>

        {/* Action Button & Close */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCtaClick}
            className="px-2 py-1 bg-[#171D35] hover:bg-[#36D9FF] hover:text-[#080A12] border border-[#36D9FF]/60 text-[9px] font-display font-bold text-[#36D9FF] rounded-none flex items-center gap-1 transition-all"
          >
            <span>{creative.ctaText}</span>
            <ExternalLink size={9} />
          </button>

          <button
            onClick={() => setIsBannerVisible(false)}
            title="Dismiss banner"
            className="p-1 text-[#8993B2] hover:text-[#E8EDF7] hover:bg-white/10 rounded-none transition-colors"
          >
            <X size={11} />
          </button>
        </div>
      </div>
    </div>
  );
};
