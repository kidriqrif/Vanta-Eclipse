import React from 'react';
import { useGame } from '../context/GameContext';
import { COSMETICS, ADS } from '../data/definitions';
import { formatNumber } from '../utils/numberFormat';
import { ShoppingBag, Sparkles, Check, Play, Zap, ShieldCheck } from 'lucide-react';

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
    <div className="flex-1 flex flex-col p-3 overflow-y-auto bg-[#08080C] gap-3">
      {/* Header Info */}
      <div className="bg-[#171722] border border-[#4E4E66] p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag size={16} className="text-[#FFD23C]" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#F6F6FC]">THE ASTRAL BAZAAR</span>
            <span className="text-[10px] text-[#8686A2]">
              Permanent conveniences, cosmetics & daily bonuses
            </span>
          </div>
        </div>
      </div>

      {/* Daily Free Ad Bonuses */}
      <div className="bg-[#171722] border border-[#4E4E66] p-2.5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#F6F6FC] flex items-center gap-1.5">
            <Zap size={14} className="text-[#FFD23C]" /> DAILY ENERGY SURGES
          </span>
          {hasRemovedAds && (
            <span className="text-[10px] text-[#6ADC3E] font-bold flex items-center gap-1">
              <ShieldCheck size={12} /> INSTANT (ADS REMOVED)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ADS.map((ad) => {
            const current = adWatchCounts[ad.id] || { date: today, count: 0 };
            const todayCount = current.date === today ? current.count : 0;
            const isCapped = !hasRemovedAds && todayCount >= ad.dailyCap;

            return (
              <div
                key={ad.id}
                className="bg-[#08080C] border border-[#4E4E66] p-2 flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[#F6F6FC]">
                    {ad.displayName}
                  </span>
                  <span className="text-[10px] text-[#8686A2]">
                    {ad.description} ({todayCount}/{hasRemovedAds ? '∞' : ad.dailyCap})
                  </span>
                </div>

                <button
                  onClick={() => watchAd(ad.id)}
                  disabled={isCapped}
                  className={`px-3 py-1 text-xs font-bold border transition-colors flex items-center gap-1 ${
                    !isCapped
                      ? 'bg-[#B01228] border-[#FF3A46] text-[#F6F6FC] hover:bg-[#FF3A46]'
                      : 'bg-[#2C2C3C] border-[#4E4E66] text-[#8686A2] cursor-not-allowed opacity-50'
                  }`}
                >
                  <Play size={11} /> CLAIM
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Permanent Bundles */}
      <div className="bg-[#171722] border border-[#4E4E66] p-2.5 flex flex-col gap-2">
        <span className="text-xs font-bold text-[#F6F6FC]">PERMANENT ENHANCEMENTS</span>

        <div className="flex flex-col gap-2">
          {/* Remove Ads */}
          <div className="bg-[#08080C] border border-[#4E4E66] p-2.5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#F6F6FC]">REMOVE ALL ADS</span>
              <span className="text-[10px] text-[#8686A2]">
                Instant claims for all daily surges, no cooldowns forever.
              </span>
            </div>

            {hasRemovedAds ? (
              <div className="px-3 py-1 bg-[#2C2C3C] text-xs font-bold text-[#6ADC3E] flex items-center gap-1">
                <Check size={14} /> ACTIVE
              </div>
            ) : (
              <button
                onClick={() => buyProduct('remove_ads')}
                className="px-3 py-1 bg-[#B01228] border border-[#FF3A46] text-xs font-bold text-[#F6F6FC] hover:bg-[#FF3A46]"
              >
                $2.99
              </button>
            )}
          </div>

          {/* Starter Pack */}
          <div className="bg-[#08080C] border border-[#FFD23C] p-2.5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#FFD23C]">
                ECLIPSE STARTER PACK
              </span>
              <span className="text-[10px] text-[#C8C8DA]">
                25 Void Crystals + 5 Arcade Tokens + Ember Trail Cosmetic
              </span>
            </div>

            {purchasedProducts.includes('starter_pack') ? (
              <div className="px-3 py-1 bg-[#2C2C3C] text-xs font-bold text-[#8686A2] flex items-center gap-1">
                <Check size={14} /> OWNED
              </div>
            ) : (
              <button
                onClick={() => buyProduct('starter_pack')}
                className="px-3 py-1 bg-[#FFD23C] text-[#08080C] text-xs font-bold hover:bg-[#F6F6FC]"
              >
                $4.99
              </button>
            )}
          </div>

          {/* Shards Pack */}
          <div className="bg-[#08080C] border border-[#4E4E66] p-2.5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#3EDCFA]">
                200 ASTRAL SHARDS
              </span>
              <span className="text-[10px] text-[#8686A2]">
                Unlock any cosmetic tap trail of your choice.
              </span>
            </div>

            <button
              onClick={() => buyProduct('shards_small')}
              className="px-3 py-1 bg-[#2C2C3C] border border-[#3EDCFA] text-xs font-bold text-[#3EDCFA] hover:bg-[#3EDCFA] hover:text-[#08080C]"
            >
              $0.99
            </button>
          </div>
        </div>
      </div>

      {/* Cosmetic Tap Trails */}
      <div className="bg-[#171722] border border-[#4E4E66] p-2.5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#F6F6FC] flex items-center gap-1.5">
            <Sparkles size={14} className="text-[#FF6EC0]" /> COSMETIC TAP TRAILS
          </span>
          <span className="text-[10px] text-[#FFD23C]">
            {currencies.astral_shards} SHARDS
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {COSMETICS.map((cosmetic) => {
            const isOwned =
              cosmetic.shardPrice === 0 ||
              purchasedProducts.includes(cosmetic.id);
            const isActive = activeCosmeticId === cosmetic.id;
            const canAfford = currencies.astral_shards >= cosmetic.shardPrice;

            return (
              <div
                key={cosmetic.id}
                className={`bg-[#08080C] border p-2 flex flex-col justify-between gap-2 ${
                  isActive ? 'border-[#FF3A46] ring-1 ring-[#FF3A46]' : 'border-[#4E4E66]'
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[#F6F6FC]">
                    {cosmetic.displayName}
                  </span>
                  <span className="text-[10px] text-[#8686A2]">
                    {cosmetic.description}
                  </span>
                </div>

                <div>
                  {isOwned ? (
                    isActive ? (
                      <div className="w-full py-1 bg-[#FF3A46] text-[#08080C] text-[10px] font-bold text-center flex items-center justify-center gap-1">
                        <Check size={11} /> EQUIPPED
                      </div>
                    ) : (
                      <button
                        onClick={() => setActiveCosmetic(cosmetic.id)}
                        className="w-full py-1 bg-[#2C2C3C] border border-[#4E4E66] text-[10px] font-bold text-[#F6F6FC] hover:bg-[#4E4E66]"
                      >
                        EQUIP
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => buyCosmetic(cosmetic.id)}
                      disabled={!canAfford}
                      className={`w-full py-1 text-[10px] font-bold border transition-colors ${
                        canAfford
                          ? 'bg-[#FFD23C] text-[#08080C] border-[#FFD23C] hover:bg-[#F6F6FC]'
                          : 'bg-[#2C2C3C] text-[#8686A2] border-[#4E4E66] cursor-not-allowed opacity-50'
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
