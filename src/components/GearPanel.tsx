import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { SLOTS, AFFIXES } from '../data/definitions';
import { Item, ItemRarity } from '../types/game';
import { formatNumber, formatPercent } from '../utils/numberFormat';
import { Shield, Hammer, Trash2, ArrowUpCircle } from 'lucide-react';

const RARITY_NAMES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];
const RARITY_COLORS = ['#C8C8DA', '#3EDCFA', '#A85CFF', '#FFD23C', '#FF6EC0'];
const RARITY_BORDERS = [
  'border-[#4E4E66]',
  'border-[#3EDCFA]',
  'border-[#A85CFF]',
  'border-[#FFD23C]',
  'border-[#FF6EC0]',
];

export const GearPanel: React.FC = () => {
  const {
    currencies,
    equipped,
    inventory,
    equipItem,
    unequipItem,
    salvageItem,
    salvageAllCommons,
    forgeItem,
    enemyLevel,
    markAllItemsSeen,
  } = useGame();

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedSlotForForge, setSelectedSlotForForge] = useState<string>('weapon');

  // Mark unseen items as seen on viewing
  React.useEffect(() => {
    markAllItemsSeen();
  }, [markAllItemsSeen]);

  const openSlots = SLOTS.filter((s) => !s.sealed);

  const formatAffixLine = (affixId: string, val: number) => {
    const def = AFFIXES.find((a) => a.id === affixId);
    if (!def) return `${affixId} +${val}`;
    const displayVal = def.isPercent ? formatPercent(val) : `+${formatNumber(val)}`;
    return def.displayTemplate.replace('{value}', displayVal);
  };

  const commonsCount = inventory.filter((i) => i.rarity === 0).length;

  return (
    <div className="flex-1 flex flex-col p-3 overflow-y-auto bg-[#08080C] gap-3">
      {/* Top Equipped Slots Matrix */}
      <div className="bg-[#171722] border border-[#4E4E66] p-2.5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#F6F6FC] flex items-center gap-1.5">
            <Shield size={14} className="text-[#3EDCFA]" /> EQUIPPED GEAR
          </span>
          <span className="text-[10px] text-[#8686A2]">TAP SLOT TO INSPECT</span>
        </div>

        <div className="grid grid-cols-6 gap-1.5">
          {openSlots.map((slot) => {
            const item = equipped[slot.id];
            const isSelected = selectedItem?.id === item?.id;
            return (
              <div
                key={slot.id}
                onClick={() => item && setSelectedItem(item)}
                className={`relative aspect-square bg-[#08080C] border p-1 flex flex-col items-center justify-between cursor-pointer transition-all ${
                  item
                    ? `${RARITY_BORDERS[item.rarity]} ${isSelected ? 'ring-2 ring-[#F6F6FC]' : ''}`
                    : 'border-[#4E4E66] border-dashed opacity-70 hover:opacity-100'
                }`}
              >
                <span className="text-[8px] text-[#8686A2] uppercase tracking-tighter truncate">
                  {slot.displayName}
                </span>

                {item ? (
                  <>
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: RARITY_COLORS[item.rarity] }}
                    />
                    <span className="text-[9px] font-bold text-[#F6F6FC]">
                      L.{item.itemLevel}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-[#4E4E66] my-auto">EMPTY</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Forge Bar */}
      <div className="bg-[#171722] border border-[#4E4E66] p-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Hammer size={16} className="text-[#FF8A28]" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#F6F6FC]">THE FORGE</span>
            <span className="text-[10px] text-[#8686A2]">Craft Lv.{enemyLevel} gear</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={selectedSlotForForge}
            onChange={(e) => setSelectedSlotForForge(e.target.value)}
            className="bg-[#08080C] border border-[#4E4E66] text-[#F6F6FC] text-xs px-2 py-1 outline-none"
          >
            {openSlots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>

          <button
            onClick={() => forgeItem(selectedSlotForForge)}
            disabled={currencies.void_scraps < 20}
            className={`px-3 py-1 text-xs font-bold border transition-colors ${
              currencies.void_scraps >= 20
                ? 'bg-[#B01228] border-[#FF3A46] text-[#F6F6FC] hover:bg-[#FF3A46]'
                : 'bg-[#2C2C3C] border-[#4E4E66] text-[#8686A2] cursor-not-allowed opacity-50'
            }`}
          >
            FORGE (20 SCRAP)
          </button>
        </div>
      </div>

      {/* Selected Item Inspection Card */}
      {selectedItem && (
        <div
          className={`bg-[#171722] border-2 p-3 flex flex-col gap-2 relative ${
            RARITY_BORDERS[selectedItem.rarity]
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold px-1.5 py-0.5"
                style={{
                  backgroundColor: RARITY_COLORS[selectedItem.rarity],
                  color: '#08080C',
                }}
              >
                {RARITY_NAMES[selectedItem.rarity]}
              </span>
              <span className="text-xs font-bold text-[#F6F6FC] uppercase">
                {selectedItem.slot} (Lv.{selectedItem.itemLevel})
              </span>
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              className="text-xs text-[#8686A2] hover:text-[#F6F6FC]"
            >
              ✕
            </button>
          </div>

          {/* Affixes list */}
          <div className="bg-[#08080C] border border-[#4E4E66] p-2 flex flex-col gap-1">
            {Object.entries(selectedItem.affixes).map(([stat, val]) => (
              <div key={stat} className="text-xs text-[#6ADC3E] font-mono flex items-center gap-1">
                <span>•</span> {formatAffixLine(stat, val)}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 mt-1">
            {equipped[selectedItem.slot]?.id === selectedItem.id ? (
              <button
                onClick={() => {
                  unequipItem(selectedItem.slot);
                  setSelectedItem(null);
                }}
                className="px-3 py-1 bg-[#2C2C3C] border border-[#4E4E66] text-xs font-bold text-[#F6F6FC] hover:bg-[#4E4E66]"
              >
                UNEQUIP
              </button>
            ) : (
              <button
                onClick={() => {
                  equipItem(selectedItem.id);
                  setSelectedItem(null);
                }}
                className="px-3 py-1 bg-[#B01228] border border-[#FF3A46] text-xs font-bold text-[#F6F6FC] hover:bg-[#FF3A46] flex items-center gap-1"
              >
                <ArrowUpCircle size={14} /> EQUIP
              </button>
            )}

            {equipped[selectedItem.slot]?.id !== selectedItem.id && (
              <button
                onClick={() => {
                  salvageItem(selectedItem.id);
                  setSelectedItem(null);
                }}
                className="px-3 py-1 bg-[#2C2C3C] border border-[#4E4E66] text-xs font-bold text-[#FF8A28] hover:bg-[#B01228] hover:text-[#F6F6FC] flex items-center gap-1"
              >
                <Trash2 size={13} /> SALVAGE
              </button>
            )}
          </div>
        </div>
      )}

      {/* Inventory Header with Salvage All Commons */}
      <div className="flex items-center justify-between bg-[#171722] border border-[#4E4E66] p-2 shrink-0">
        <span className="text-xs font-bold text-[#F6F6FC]">
          INVENTORY ({inventory.length} ITEMS)
        </span>
        {commonsCount > 0 && (
          <button
            onClick={salvageAllCommons}
            className="px-2 py-0.5 text-[11px] font-bold bg-[#2C2C3C] border border-[#FF8A28] text-[#FF8A28] hover:bg-[#FF8A28] hover:text-[#08080C] transition-colors flex items-center gap-1"
          >
            <Trash2 size={11} /> SALVAGE {commonsCount} COMMONS
          </button>
        )}
      </div>

      {/* Inventory Grid */}
      {inventory.length === 0 ? (
        <div className="bg-[#171722] border border-[#4E4E66] p-6 text-center text-xs text-[#8686A2]">
          No gear in inventory. Defeat enemies & bosses or visit the Forge to craft equipment!
        </div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {inventory.map((item) => {
            const isSelected = selectedItem?.id === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`aspect-square bg-[#171722] border p-1.5 flex flex-col justify-between cursor-pointer transition-all hover:scale-105 ${
                  RARITY_BORDERS[item.rarity]
                } ${isSelected ? 'ring-2 ring-[#F6F6FC]' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-[#8686A2] uppercase tracking-tighter truncate">
                    {item.slot}
                  </span>
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: RARITY_COLORS[item.rarity] }}
                  />
                </div>

                <div className="text-center">
                  <span
                    className="text-[10px] font-bold block truncate"
                    style={{ color: RARITY_COLORS[item.rarity] }}
                  >
                    {RARITY_NAMES[item.rarity]}
                  </span>
                  <span className="text-[9px] text-[#C8C8DA]">Lv.{item.itemLevel}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
