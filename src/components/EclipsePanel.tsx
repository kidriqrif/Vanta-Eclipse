import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { SKILLS } from '../data/definitions';
import { formatNumber } from '../utils/numberFormat';
import { Moon, Lock, Check, ShieldAlert, Zap } from 'lucide-react';

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
    <div className="flex-1 flex flex-col p-2.5 overflow-y-auto bg-[#171D35] gap-2 select-none ">
      {/* Prestige Hero Card */}
      <div className="bg-[#101426] border border-[#FF4268] p-3 rounded-none flex flex-col gap-2.5 shadow-[0_0_15px_rgba(90,59,105,0.2)] hud-corner">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#FF4268]/10 border border-[#FF4268] flex items-center justify-center">
              <Moon size={16} className="text-[#FF4268]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase tracking-wider">
                SYS://ECLIPSE_OVERRIDE
              </span>
              <span className="text-[9px] font-tech text-[#8993B2]">
                COLLAPSES: <span className="text-[#36D9FF] font-bold">{eclipseCount}</span> | RECORD: <span className="text-[#FF4268] font-bold">FLR {lifetimePeakLevel}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[8px] font-tech text-[#8993B2] uppercase">CURRENT PEAK</span>
            <span className="text-xs font-mono-code font-bold text-[#FF4268]">FLR {peakRunLevel}</span>
          </div>
        </div>

        {/* Payout & Action Bar */}
        <div className="bg-[#171D35] border border-white/15 p-2 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[8px] font-tech text-[#8993B2] uppercase">PRESTIGE HARVEST</span>
            <span className="text-xs font-mono-code font-bold text-[#36D9FF] flex items-center gap-1">
              +{formatNumber(payout)} VOID CRYSTALS
            </span>
          </div>

          <button
            onClick={handleEclipseClick}
            disabled={!canEclipse}
            className={`px-3 py-1.5 text-xs ${
              canEclipse
                ? confirmPrestige
                  ? 'hud-btn-alert bg-[#FF4268] text-black animate-pulse'
                  : 'hud-btn-alert'
                : 'bg-[#171D35] border border-white/10 text-[#8993B2] cursor-not-allowed opacity-40'
            }`}
          >
            {canEclipse
              ? confirmPrestige
                ? 'CONFIRM COLLAPSE?'
                : 'COMMENCE ECLIPSE'
              : 'UNLOCKS FLR 50'}
          </button>
        </div>

        {confirmPrestige && (
          <div className="text-[10px] text-[#FFC857] bg-[#171D35] border border-[#FFC857] p-1.5 flex items-start gap-1">
            <ShieldAlert size={12} className="shrink-0 mt-0.5" />
            <span>WARNING: Collapsing current floor resets Essence. All Void Crystals, Relics, Pets, Hardware, and Ascendant Powers persist permanently.</span>
          </div>
        )}
      </div>

      {/* Ascendant Matrix Header */}
      <div className="flex items-center justify-between bg-[#101426] border border-[#36D9FF]/40 p-2 rounded-none shrink-0">
        <div className="flex items-center gap-1.5">
          <Zap size={13} className="text-[#36D9FF]" />
          <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase tracking-wide">
            ASCENDANT MATRIX
          </span>
        </div>

        {/* Branch Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setSelectedBranch('ALL')}
            className={`px-1.5 py-0.5 text-[8px] font-mono-code font-bold rounded-none ${
              selectedBranch === 'ALL'
                ? 'bg-[#36D9FF] text-[#171D35]'
                : 'bg-[#171D35] text-[#8993B2] border border-white/10 hover:text-[#FFFFFF]'
            }`}
          >
            ALL
          </button>
          {branches.map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBranch(b)}
              className={`px-1.5 py-0.5 text-[8px] font-mono-code font-bold rounded-none ${
                selectedBranch === b
                  ? 'bg-[#36D9FF] text-[#171D35]'
                  : 'bg-[#171D35] text-[#8993B2] border border-white/10 hover:text-[#FFFFFF]'
              }`}
            >
              {b.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Skills Grid */}
      <div className="flex flex-col gap-1.5">
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
              className={`p-2 border transition-all flex items-center justify-between gap-2.5 rounded-none ${
                isMaxed
                  ? 'bg-[#040406] border-[#36D9FF]/40'
                  : isLocked
                  ? 'bg-[#040406] border-white/10 opacity-40'
                  : 'bg-[#101426] border-white/15 hover:border-[#36D9FF]/50'
              }`}
            >
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase">
                    {skill.displayName}
                  </span>
                  <span className="text-[9px] font-mono-code font-bold text-[#36D9FF] bg-[#36D9FF]/10 px-1 border border-[#36D9FF]/30">
                    LV.{curLevel}/{skill.maxLevel}
                  </span>
                  <span className="text-[7px] font-mono-code bg-[#171D35] border border-white/20 text-[#8993B2] px-1 uppercase">
                    {skill.branch}
                  </span>
                </div>

                <span className="text-[10px] font-tech text-[#8993B2] mt-0.5">
                  {skill.description}
                </span>

                {isLocked && prereqSkill && (
                  <span className="text-[9px] font-mono-code text-[#FFC857] mt-0.5 flex items-center gap-1">
                    <Lock size={9} /> REQUIRES {prereqSkill.displayName.toUpperCase()} LV.{skill.prereqLevel || 1}
                  </span>
                )}
              </div>

              {/* Action Button */}
              <div className="shrink-0">
                {isMaxed ? (
                  <div className="px-2.5 py-1 bg-[#171D35] border border-[#36D9FF] text-[9px] font-display font-bold text-[#36D9FF] flex items-center gap-1">
                    <Check size={10} /> MAX
                  </div>
                ) : isLocked ? (
                  <div className="px-2.5 py-1 bg-[#171D35] border border-white/10 text-[9px] font-display font-bold text-[#8993B2] flex items-center gap-1">
                    <Lock size={10} /> LOCKED
                  </div>
                ) : (
                  <button
                    onClick={() => buySkill(skill.id)}
                    disabled={!canAfford}
                    className={`px-3 py-1 text-xs hud-btn flex flex-col items-center min-w-[76px] ${
                      canAfford ? 'border-[#36D9FF]' : ''
                    }`}
                  >
                    <span>UPGRADE</span>
                    <span className="text-[8px] font-mono-code opacity-80">
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
