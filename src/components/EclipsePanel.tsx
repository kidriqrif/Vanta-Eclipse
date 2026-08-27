import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { SKILLS } from '../data/definitions';
import { formatNumber } from '../utils/numberFormat';
import { Sparkles, Moon, ArrowUpRight, Lock, Check } from 'lucide-react';

export const EclipsePanel: React.FC = () => {
  const {
    currencies,
    peakRunLevel,
    lifetimePeakLevel,
    eclipseCount,
    calculateEclipsePayout,
    performEclipse,
    skillLevels,
    getSkillCost,
    buySkill,
    canBuySkill,
  } = useGame();

  const [confirmPrestige, setConfirmPrestige] = useState<boolean>(false);
  const [selectedBranch, setSelectedBranch] = useState<'ALL' | 'Fortune' | 'Ascendance' | 'Automation' | 'Might'>('ALL');

  const payout = calculateEclipsePayout();
  const canEclipse = peakRunLevel >= 50;

  const branches = ['Fortune', 'Ascendance', 'Automation', 'Might'] as const;

  const filteredSkills = SKILLS.filter((s) => {
    if (selectedBranch === 'ALL') return true;
    return s.branch === selectedBranch;
  });

  const handleEclipseClick = () => {
    if (!confirmPrestige) {
      setConfirmPrestige(true);
      return;
    }
    performEclipse();
    setConfirmPrestige(false);
  };

  return (
    <div className="flex-1 flex flex-col p-3 overflow-y-auto bg-[#08080C] gap-3">
      {/* Prestige Hero Card */}
      <div className="bg-[#171722] border-2 border-[#FF3A46] p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#B01228] border border-[#FF3A46] flex items-center justify-center">
              <Moon size={18} className="text-[#F6F6FC]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#F6F6FC]">THE ECLIPSE</span>
              <span className="text-[10px] text-[#8686A2]">
                Eclipses performed: {eclipseCount} | Lifetime Peak: Lv.{lifetimePeakLevel}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#8686A2]">RUN PEAK</span>
            <span className="text-sm font-bold text-[#FF3A46]">LV.{peakRunLevel}</span>
          </div>
        </div>

        <div className="bg-[#08080C] border border-[#4E4E66] p-2.5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-[#8686A2]">ECLIPSE REWARD</span>
            <span className="text-sm font-bold text-[#3EDCFA] flex items-center gap-1">
              +{formatNumber(payout)} VOID CRYSTALS
            </span>
          </div>

          <button
            onClick={handleEclipseClick}
            disabled={!canEclipse}
            className={`px-4 py-2 text-xs font-bold border transition-all ${
              canEclipse
                ? confirmPrestige
                  ? 'bg-[#FF3A46] text-[#08080C] border-[#F6F6FC] animate-pulse'
                  : 'bg-[#B01228] border-[#FF3A46] text-[#F6F6FC] hover:bg-[#FF3A46]'
                : 'bg-[#2C2C3C] border-[#4E4E66] text-[#8686A2] cursor-not-allowed opacity-50'
            }`}
          >
            {canEclipse
              ? confirmPrestige
                ? 'CONFIRM COLLAPSE?'
                : 'ENTER ECLIPSE'
              : 'UNLOCKS AT LV.50'}
          </button>
        </div>

        {confirmPrestige && (
          <div className="text-[11px] text-[#FFD23C] bg-[#08080C] border border-[#FFD23C] p-2">
            ⚠️ Entering the Eclipse will reset current run levels and Essence. You keep all Void Crystals, Relics, Pets, Equipment, Ascendant Powers, and records!
          </div>
        )}
      </div>

      {/* Ascendant Powers Skill Tree */}
      <div className="flex items-center justify-between bg-[#171722] border border-[#4E4E66] p-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-[#3EDCFA]" />
          <span className="text-xs font-bold text-[#F6F6FC]">ASCENDANT POWERS</span>
        </div>

        {/* Branch Filter Tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSelectedBranch('ALL')}
            className={`px-2 py-0.5 text-[10px] font-bold border ${
              selectedBranch === 'ALL'
                ? 'bg-[#3EDCFA] text-[#08080C] border-[#3EDCFA]'
                : 'bg-[#2C2C3C] text-[#8686A2] border-[#4E4E66]'
            }`}
          >
            ALL
          </button>
          {branches.map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBranch(b)}
              className={`px-2 py-0.5 text-[10px] font-bold border ${
                selectedBranch === b
                  ? 'bg-[#3EDCFA] text-[#08080C] border-[#3EDCFA]'
                  : 'bg-[#2C2C3C] text-[#8686A2] border-[#4E4E66]'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Skills Grid */}
      <div className="flex flex-col gap-2">
        {filteredSkills.map((skill) => {
          const curLevel = skillLevels[skill.id] || 0;
          const isMaxed = curLevel >= skill.maxLevel;
          const cost = getSkillCost(skill.id);
          const canAfford = canBuySkill(skill.id);

          const prereqSkill = skill.prereqId ? SKILLS.find((s) => s.id === skill.prereqId) : null;
          const isLocked =
            skill.prereqId &&
            (skillLevels[skill.prereqId] || 0) < (skill.prereqLevel || 1);

          return (
            <div
              key={skill.id}
              className={`bg-[#171722] border p-2.5 flex items-center justify-between gap-2 transition-all ${
                isMaxed
                  ? 'border-[#3EDCFA]/60 bg-[#171722]/80'
                  : isLocked
                  ? 'border-[#4E4E66] opacity-60'
                  : 'border-[#4E4E66]'
              }`}
            >
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#F6F6FC]">
                    {skill.displayName}
                  </span>
                  <span className="text-[10px] text-[#3EDCFA] font-mono font-bold">
                    LV.{curLevel}/{skill.maxLevel}
                  </span>
                  <span className="text-[9px] bg-[#2C2C3C] text-[#8686A2] px-1 py-0.2 uppercase">
                    {skill.branch}
                  </span>
                </div>

                <span className="text-[11px] text-[#C8C8DA] mt-0.5">
                  {skill.description}
                </span>

                {isLocked && prereqSkill && (
                  <span className="text-[10px] text-[#FF8A28] mt-0.5 flex items-center gap-1">
                    <Lock size={10} /> Requires {prereqSkill.displayName} Lv.
                    {skill.prereqLevel || 1}
                  </span>
                )}
              </div>

              {/* Action Button */}
              <div className="shrink-0">
                {isMaxed ? (
                  <div className="px-3 py-1.5 bg-[#2C2C3C] border border-[#3EDCFA] text-[11px] font-bold text-[#3EDCFA] flex items-center gap-1">
                    <Check size={12} /> MAX
                  </div>
                ) : isLocked ? (
                  <div className="px-3 py-1.5 bg-[#2C2C3C] border border-[#4E4E66] text-[11px] font-bold text-[#8686A2] flex items-center gap-1">
                    <Lock size={12} /> LOCKED
                  </div>
                ) : (
                  <button
                    onClick={() => buySkill(skill.id)}
                    disabled={!canAfford}
                    className={`px-3 py-1.5 text-xs font-bold border transition-colors flex flex-col items-center min-w-[75px] ${
                      canAfford
                        ? 'bg-[#3EDCFA] text-[#08080C] border-[#F6F6FC] hover:bg-[#F6F6FC]'
                        : 'bg-[#2C2C3C] border-[#4E4E66] text-[#8686A2] cursor-not-allowed opacity-50'
                    }`}
                  >
                    <span>UPGRADE</span>
                    <span className="text-[10px] font-normal">
                      {formatNumber(cost)} CRY
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
