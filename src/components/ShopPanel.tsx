import React from 'react';
import { useGame } from '../context/GameContext';
import { COSMETICS, ADS } from '../data/definitions';
import { ShoppingBag, Check, Play, Zap, ShieldCheck } from 'lucide-react';

export const ShopPanel: React.FC = () => {
  const {
    currencies,
    purchasedProducts,
    activeCosmeticId,
    setActiveCosmetic,
    buyCosmetic,
    buyProduct,
    watchAd,
    hasRemovedAds,
    adWatchCounts,
  } = useGame();

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex-1 flex flex-col p-2.5 overflow-y-auto bg-[#171D35] gap-2 select-none ">
      {/* Header Info */}
      <div className="bg-[#101426] border border-[#36D9FF]/40 p-2 rounded-none flex items-center justify-between hud-corner">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#36D9FF]/10 border border-[#36D9FF] flex items-center justify-center">
            <ShoppingBag size={13} className="text-[#36D9FF]" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase tracking-wider">
              SYS://ASTRAL_BAZAAR
            </span>
            <span className="text-[9px] font-tech text-[#8993B2]">
              TACTICAL POWER SURGES, COSMETIC SIGNATURES & EXPANSIONS
            </span>
          </div>
        </div>
      </div>

      {/* Daily Free Power Surges */}
      <div className="bg-[#101426] border border-white/15 p-2 rounded-none flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase flex items-center gap-1">
            <Zap size={12} className="text-[#36D9FF]" /> DAILY POWER SURGES
          </span>
          {hasRemovedAds && (
            <span className="text-[8px] font-mono-code text-[#36D9FF] font-bold flex items-center gap-1">
              <ShieldCheck size={10} /> INSTANT (OVERRIDE ACTIVE)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {ADS.map((ad) => {
            const current = adWatchCounts[ad.id] || { date: today, count: 0 };
            const todayCount = current.date === today ? current.count : 0;
            const isCapped = !hasRemovedAds && todayCount >= ad.dailyCap;

            return (
              <div
                key={ad.id}
                className="bg-[#171D35] border border-white/15 p-1.5 rounded-none flex items-center justify-between"
              >
                <div className="flex flex-col min-w-0 flex-1 pr-2">
                  <span className="text-[11px] font-display font-bold text-[#FFFFFF] uppercase truncate">
                    {ad.displayName}
                  </span>
                  <span className="text-[9px] font-tech text-[#8993B2] truncate">
                    {ad.description} [{todayCount}/{hasRemovedAds ? '∞' : ad.dailyCap}]
                  </span>
                </div>

                <button
                  onClick={() => watchAd(ad.id)}
                  disabled={isCapped}
                  className={`px-2.5 py-1 text-xs hud-btn flex items-center gap-1 shrink-0 ${
                    !isCapped ? 'border-[#36D9FF]' : ''
                  }`}
                >
                  <Play size={10} />
                  <span>CLAIM</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Permanent Bundles */}
      <div className="bg-[#101426] border border-white/15 p-2 rounded-none flex flex-col gap-1.5">
        <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase">
          PERMANENT PROTOCOL ENHANCEMENTS
        </span>

        <div className="flex flex-col gap-1.5">
          {/* Remove Ads */}
          <div className="bg-[#171D35] border border-white/15 p-2 rounded-none flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase">
                REMOVE ALL AD RESTRICTIONS
              </span>
              <span className="text-[9px] font-tech text-[#8993B2]">
                Instant surge claim execution, no delays forever.
              </span>
            </div>

            {hasRemovedAds ? (
              <div className="px-2.5 py-1 bg-[#171D35] border border-[#36D9FF] text-[9px] font-display font-bold text-[#36D9FF] flex items-center gap-1">
                <Check size={11} /> ACTIVE
              </div>
            ) : (
              <button
                onClick={() => buyProduct('remove_ads')}
                className="px-3 py-1 hud-btn text-xs font-display font-bold"
              >
                $2.99
              </button>
            )}
          </div>

          {/* Starter Pack */}
          <div className="bg-[#171D35] border border-[#FFC857]/40 p-2 rounded-none flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-display font-bold text-[#FFC857] uppercase">
                ECLIPSE STARTER PACK
              </span>
              <span className="text-[9px] font-tech text-[#8993B2]">
                25 Void Crystals + 5 Arcade Tokens + Ember Trail Signature
              </span>
            </div>

            {purchasedProducts.includes('starter_pack') ? (
              <div className="px-2.5 py-1 bg-[#171D35] border border-white/20 text-[9px] font-display font-bold text-[#8993B2] flex items-center gap-1">
                <Check size={11} /> OWNED
              </div>
            ) : (
              <button
                onClick={() => buyProduct('starter_pack')}
                className="px-3 py-1 hud-btn-gold text-xs font-display font-bold"
              >
                $4.99
              </button>
            )}
          </div>

          {/* Shards Pack */}
          <div className="bg-[#171D35] border border-white/15 p-2 rounded-none flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-display font-bold text-[#36D9FF] uppercase">
                200 ASTRAL SHARDS
              </span>
              <span className="text-[9px] font-tech text-[#8993B2]">
                Acquire custom laser cosmetic signatures.
              </span>
            </div>

            <button
              onClick={() => buyProduct('shards_small')}
              className="px-3 py-1 hud-btn text-xs font-display font-bold"
            >
              $0.99
            </button>
          </div>
        </div>
      </div>

      {/* Cosmetic Tap Trails */}
      <div className="bg-[#101426] border border-white/15 p-2 rounded-none flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase flex items-center gap-1">
            <Zap size={12} className="text-[#36D9FF]" /> LASER SIGNATURES
          </span>
          <span className="text-[9px] font-mono-code font-bold text-[#FFC857]">
            {currencies.astral_shards} SHARDS
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {COSMETICS.map((cosmetic) => {
            const isOwned =
              cosmetic.shardPrice === 0 ||
              purchasedProducts.includes(cosmetic.id);
            const isActive = activeCosmeticId === cosmetic.id;
            const canAfford = currencies.astral_shards >= cosmetic.shardPrice;

            return (
              <div
                key={cosmetic.id}
                className={`bg-[#171D35] border p-2 rounded-none flex flex-col justify-between gap-1.5 transition-all ${
                  isActive
                    ? 'border-[#36D9FF] shadow-[0_0_8px_rgba(155,81,111,0.2)]'
                    : 'border-white/15 hover:border-white/40'
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase">
                    {cosmetic.displayName}
                  </span>
                  <span className="text-[9px] font-tech text-[#8993B2] mt-0.5">
                    {cosmetic.description}
                  </span>
                </div>

                <div>
                  {isOwned ? (
                    isActive ? (
                      <div className="w-full py-1 bg-[#36D9FF] text-[#171D35] text-[9px] font-display font-bold text-center rounded-none flex items-center justify-center gap-1">
                        <Check size={10} /> ACTIVE
                      </div>
                    ) : (
                      <button
                        onClick={() => setActiveCosmetic(cosmetic.id)}
                        className="w-full py-1 bg-[#101426] hover:bg-[#36D9FF] hover:text-black border border-white/20 text-[9px] font-display font-bold text-[#FFFFFF] rounded-none transition-all"
                      >
                        EQUIP
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => buyCosmetic(cosmetic.id)}
                      disabled={!canAfford}
                      className={`w-full py-1 text-[9px] font-display font-bold rounded-none ${
                        canAfford ? 'hud-btn-gold' : 'bg-[#171D35] border border-white/10 text-[#8993B2] opacity-40 cursor-not-allowed'
                      }`}
                    >
                      {cosmetic.shardPrice} SHARDS
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
