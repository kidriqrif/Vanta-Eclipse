import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { SLOTS, AFFIXES } from '../data/definitions';
import { Item, ItemRarity } from '../types/game';
import { formatNumber } from '../utils/numberFormat';
import {
  Shield,
  Trash2,
  Hammer,
  Layers,
  X,
  Check,
  Zap,
} from 'lucide-react';

import weaponImg from '../assets/images/gear_weapon_1788270086273.jpg';
import helmetImg from '../assets/images/gear_helmet_1788270118067.jpg';
import armorImg from '../assets/images/gear_armor_1788270133056.jpg';
import bootsImg from '../assets/images/gear_boots_1788270145701.jpg';
import glovesImg from '../assets/images/gear_gloves_1788270173273.jpg';
import ringImg from '../assets/images/gear_ring_1788270193874.jpg';

const GEAR_IMAGES: Record<string, string> = {
  weapon: weaponImg,
  helmet: helmetImg,
  armor: armorImg,
  boots: bootsImg,
  gloves: glovesImg,
  ring: ringImg,
};

const RARITY_NAMES: Record<ItemRarity, string> = {
  0: 'COMMON',
  1: 'ENHANCED',
  2: 'OVERCHARGED',
  3: 'LEGENDARY',
  4: 'MYTHIC',
};

const RARITY_COLORS: Record<ItemRarity, { text: string; bg: string; border: string }> = {
  0: { text: '#D0D4DC', bg: 'bg-[#171D35]', border: 'border-white/20' },
  1: { text: '#36D9FF', bg: 'bg-[#171D35]', border: 'border-[#36D9FF]' },
  2: { text: '#36D9FF', bg: 'bg-[#171D35]', border: 'border-[#36D9FF]' },
  3: { text: '#FFC857', bg: 'bg-[#171D35]', border: 'border-[#FFC857]' },
  4: { text: '#FF4268', bg: 'bg-[#171D35]', border: 'border-[#FF4268]' },
};

export const GearPanel: React.FC = () => {
  const {
    equipped,
    inventory,
    currencies,
    equipItem,
    unequipItem,
    salvageItem,
    salvageAllCommons,
    forgeItem,
  } = useGame();

  const [selectedSlotFilter, setSelectedSlotFilter] = useState<string>('ALL');
  const [inspectingItem, setInspectingItem] = useState<Item | null>(null);
  const [isForgingSlot, setIsForgingSlot] = useState<string>('weapon');

  const forgeCost = 50;
  const canForge = (currencies.void_scraps || 0) >= forgeCost;

  const filteredInventory = inventory.filter((item) => {
    if (selectedSlotFilter === 'ALL') return true;
    return item.slot === selectedSlotFilter;
  });

  const getSlotDef = (slotId: string) => SLOTS.find((s) => s.id === slotId);

  const getAffixText = (affixKey: string, value: number) => {
    const def = AFFIXES.find((a) => a.id === affixKey || a.stat === affixKey);
    if (!def) return `${affixKey}: +${value}`;
    if (def.isPercent) {
      return def.displayTemplate.replace('{value}', `${(value * 100).toFixed(1)}%`);
    }
    return def.displayTemplate.replace('{value}', `${value.toFixed(1)}`);
  };

  const handleForge = () => {
    const created = forgeItem(isForgingSlot);
    if (created) {
      setInspectingItem(created);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-2.5 overflow-y-auto bg-[#171D35] gap-2 select-none ">
      {/* Item Inspection Modal */}
      {inspectingItem && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-[#101426] border-2 border-[#36D9FF] max-w-xs w-full rounded-none flex flex-col overflow-hidden shadow-[0_0_20px_rgba(155,81,111,0.2)]">
            {/* Modal Header */}
            <div
              className="p-2.5 border-b flex items-center justify-between bg-[#171D35]"
              style={{ borderColor: RARITY_COLORS[inspectingItem.rarity].border }}
            >
              <div className="flex flex-col">
                <span
                  className="text-xs font-display font-black uppercase tracking-wider"
                  style={{ color: RARITY_COLORS[inspectingItem.rarity].text }}
                >
                  {RARITY_NAMES[inspectingItem.rarity]} {getSlotDef(inspectingItem.slot)?.displayName || inspectingItem.slot}
                </span>
                <span className="text-[9px] font-mono-code text-[#8993B2]">
                  POWER TIER {inspectingItem.itemLevel}
                </span>
              </div>

              <button
                onClick={() => setInspectingItem(null)}
                className="w-5 h-5 bg-[#171D35] hover:bg-[#FF4268] hover:text-black text-[#8993B2] border border-white/20 flex items-center justify-center rounded-none"
              >
                <X size={12} />
              </button>
            </div>

            {/* Item Image */}
            {GEAR_IMAGES[inspectingItem.slot] && (
              <div className="w-full aspect-square border-b border-white/10 relative">
                <img src={GEAR_IMAGES[inspectingItem.slot]} alt={inspectingItem.slot} className="w-full h-full object-cover" />
                <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] mix-blend-overlay"></div>
              </div>
            )}

            {/* Affixes Body */}
            <div className="p-2.5 flex flex-col gap-1.5 bg-[#101426]">
              <span className="text-[9px] font-tech text-[#8993B2] uppercase">
                ENCHANTMENT ATTRIBUTES
              </span>
              <div className="flex flex-col gap-1 bg-[#171D35] border border-white/15 p-2 rounded-none">
                {Object.entries(inspectingItem.affixes).map(([key, val]) => (
                  <div
                    key={key}
                    className="text-xs font-mono-code font-bold text-[#36D9FF] flex items-center gap-1.5"
                  >
                    <Zap size={11} className="text-[#36D9FF] shrink-0" />
                    <span>{getAffixText(key, val)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-2 bg-[#171D35] border-t border-white/15 flex gap-1.5">
              {equipped[inspectingItem.slot]?.id === inspectingItem.id ? (
                <button
                  onClick={() => {
                    unequipItem(inspectingItem.slot);
                    setInspectingItem(null);
                  }}
                  className="flex-1 py-1 bg-[#101426] hover:bg-[#36D9FF] hover:text-black border border-white/20 text-xs font-display font-bold text-[#FFFFFF] rounded-none"
                >
                  UNEQUIP
                </button>
              ) : (
                <button
                  onClick={() => {
                    equipItem(inspectingItem.id);
                    setInspectingItem(null);
                  }}
                  className="flex-1 py-1 hud-btn text-xs font-display font-bold flex items-center justify-center gap-1"
                >
                  <Check size={13} /> EQUIP
                </button>
              )}

              <button
                onClick={() => {
                  salvageItem(inspectingItem.id);
                  setInspectingItem(null);
                }}
                className="px-3 py-1 bg-[#101426] hover:bg-[#FF4268] hover:text-black border border-[#FF4268]/40 text-xs font-display font-bold text-[#FF4268] rounded-none flex items-center gap-1"
              >
                <Trash2 size={12} /> SALVAGE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Info & Forge Header */}
      <div className="bg-[#101426] border border-[#36D9FF]/40 p-2 rounded-none flex items-center justify-between hud-corner">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#36D9FF]/10 border border-[#36D9FF] flex items-center justify-center">
            <Shield size={13} className="text-[#36D9FF]" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase tracking-wider">
              SYS://ARMORY_FORGE
            </span>
            <span className="text-[9px] font-tech text-[#8993B2]">
              SCRAPS AVAILABLE: <span className="text-[#FFC857] font-bold">{currencies.void_scraps || 0}</span>
            </span>
          </div>
        </div>

        {/* Forge Controls */}
        <div className="flex items-center gap-1">
          <select
            value={isForgingSlot}
            onChange={(e) => setIsForgingSlot(e.target.value)}
            className="bg-[#171D35] border border-white/20 text-[9px] font-mono-code font-bold text-[#FFFFFF] px-1 py-1 rounded-none outline-none"
          >
            {SLOTS.filter((s) => !s.sealed).map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName.toUpperCase()}
              </option>
            ))}
          </select>

          <button
            onClick={handleForge}
            disabled={!canForge}
            className={`px-2.5 py-1 text-xs hud-btn flex items-center gap-1 ${
              canForge ? 'border-[#36D9FF]' : ''
            }`}
          >
            <Hammer size={11} />
            <span>FORGE ({forgeCost})</span>
          </button>
        </div>
      </div>

      {/* Equipped Loadout Matrix */}
      <div className="bg-[#101426] border border-white/15 p-2 rounded-none flex flex-col gap-1.5">
        <span className="text-[9px] font-tech text-[#8993B2] uppercase tracking-wider">
          ACTIVE EQUIPMENT LOADOUT
        </span>

        <div className="grid grid-cols-3 gap-1.5">
          {SLOTS.filter((s) => !s.sealed).map((slot) => {
            const equippedItem = equipped[slot.id];
            const rarityConf = equippedItem ? RARITY_COLORS[equippedItem.rarity] : null;

            return (
              <div
                key={slot.id}
                onClick={() => equippedItem && setInspectingItem(equippedItem)}
                className={`border rounded-none transition-all flex flex-col justify-between min-h-[58px] cursor-pointer overflow-hidden relative ${
                  equippedItem
                    ? `${rarityConf?.bg} ${rarityConf?.border} hover:border-white shadow-sm`
                    : 'bg-[#171D35] border-white/10 border-dashed hover:border-white/30'
                }`}
              >
                {GEAR_IMAGES[slot.id] && (
                  <div className={`w-full h-full object-cover absolute top-0 left-0 pointer-events-none mix-blend-overlay ${equippedItem ? 'opacity-40' : 'opacity-10 grayscale'}`}>
                    <img src={GEAR_IMAGES[slot.id]} alt={slot.id} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-1.5 relative z-10 flex flex-col h-full justify-between">
                  <div className="flex items-center justify-between drop-shadow-md">
                    <span className={`text-[8px] font-display font-bold uppercase ${equippedItem ? 'text-[#FFFFFF]' : 'text-[#8993B2]'}`}>
                      {slot.displayName}
                    </span>
                    {equippedItem && (
                      <span
                        className="text-[8px] font-mono-code font-bold drop-shadow-md"
                        style={{ color: rarityConf?.text }}
                      >
                        TIER {equippedItem.itemLevel}
                      </span>
                    )}
                  </div>

                  {equippedItem ? (
                    <div className="flex flex-col mt-0.5">
                      <span
                        className="text-[10px] font-display font-bold truncate drop-shadow-md"
                        style={{ color: rarityConf?.text }}
                      >
                        {RARITY_NAMES[equippedItem.rarity]}
                      </span>
                    <span className="text-[8px] text-[#8993B2] truncate font-mono-code">
                      {Object.keys(equippedItem.affixes).length} PERKS
                    </span>
                  </div>
                ) : (
                  <span className="text-[9px] text-[#8993B2]/40 font-mono-code mt-1 drop-shadow-md">
                    [EMPTY]
                  </span>
                )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Storage Repository */}
      <div className="bg-[#101426] border border-white/15 p-2 rounded-none flex flex-col gap-1.5 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-tech text-[#8993B2] uppercase tracking-wider">
            STORAGE REPOSITORY [{inventory.length}]
          </span>

          <button
            onClick={() => salvageAllCommons()}
            disabled={!inventory.some((i) => i.rarity === 0)}
            className="px-2 py-0.5 bg-[#171D35] hover:bg-[#FF4268] hover:text-black border border-[#FF4268]/40 text-[9px] font-display font-bold text-[#FF4268] rounded-none transition-all disabled:opacity-30"
          >
            SALVAGE COMMONS
          </button>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          <button
            onClick={() => setSelectedSlotFilter('ALL')}
            className={`px-1.5 py-0.5 text-[8px] font-mono-code font-bold rounded-none ${
              selectedSlotFilter === 'ALL'
                ? 'bg-[#36D9FF] text-[#171D35]'
                : 'bg-[#171D35] text-[#8993B2] border border-white/10 hover:text-[#FFFFFF]'
            }`}
          >
            ALL
          </button>
          {SLOTS.filter((s) => !s.sealed).map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSlotFilter(s.id)}
              className={`px-1.5 py-0.5 text-[8px] font-mono-code font-bold rounded-none ${
                selectedSlotFilter === s.id
                  ? 'bg-[#36D9FF] text-[#171D35]'
                  : 'bg-[#171D35] text-[#8993B2] border border-white/10 hover:text-[#FFFFFF]'
              }`}
            >
              {s.displayName.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Inventory Grid */}
        {filteredInventory.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#8993B2]">
            <Layers size={20} className="opacity-30 mb-1" />
            <span className="text-xs font-display">NO HARDWARE IN STORAGE</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 overflow-y-auto max-h-56">
            {filteredInventory.map((item, index) => {
              const rarityConf = RARITY_COLORS[item.rarity];
              const slotDef = getSlotDef(item.slot);
              const isEquipped = equipped[item.slot]?.id === item.id;

              return (
                <div
                  key={`gear_item_${item.id}_${index}`}
                  onClick={() => setInspectingItem(item)}
                  className={`border cursor-pointer transition-all flex flex-col justify-between rounded-none overflow-hidden ${rarityConf.bg} ${rarityConf.border} hover:border-white relative`}
                >
                  {GEAR_IMAGES[item.slot] && (
                    <div className="w-full h-16 opacity-30 object-cover absolute top-0 left-0 pointer-events-none mix-blend-overlay">
                      <img src={GEAR_IMAGES[item.slot]} alt={item.slot} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-1.5 relative z-10 flex flex-col h-full justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-mono-code text-[#FFFFFF] uppercase drop-shadow-md">
                        {slotDef?.displayName || item.slot}
                      </span>
                      <span
                        className="text-[8px] font-mono-code font-bold drop-shadow-md"
                        style={{ color: rarityConf.text }}
                      >
                        TIER {item.itemLevel}
                      </span>
                    </div>

                    <span
                      className="text-[10px] font-display font-bold truncate mt-0.5 drop-shadow-md"
                      style={{ color: rarityConf.text }}
                    >
                      {RARITY_NAMES[item.rarity]}
                    </span>

                    <div className="flex items-center justify-between mt-0.5 text-[8px] drop-shadow-md">
                      <span className="text-[#FFFFFF] font-mono-code">
                        {Object.keys(item.affixes).length} AFFIXES
                      </span>
                      {isEquipped && (
                        <span className="text-[#36D9FF] font-bold">EQUIPPED</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
