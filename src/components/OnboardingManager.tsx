import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { Shield, Sword, ShoppingBag, Layers, Zap, Info } from 'lucide-react';

export const OnboardingManager: React.FC = () => {
  const { enemyLevel } = useGame();
  
  // Track seen tutorials in localStorage
  const [seenTutorials, setSeenTutorials] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('vanta_eclipse_tutorials');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [activeTutorial, setActiveTutorial] = useState<{ id: string, title: string, desc: string, icon: React.ReactNode } | null>(null);

  useEffect(() => {
    localStorage.setItem('vanta_eclipse_tutorials', JSON.stringify(seenTutorials));
  }, [seenTutorials]);

  const triggerTutorial = (id: string, title: string, desc: string, icon: React.ReactNode) => {
    if (!seenTutorials[id]) {
      setActiveTutorial({ id, title, desc, icon });
    }
  };

  useEffect(() => {
    // Level 1: Welcome
    if (enemyLevel >= 1) {
      triggerTutorial('welcome', 'SYSTEM INITIALIZED', 'Welcome to Vanta Eclipse. Tap the enemy in the center to deal damage. Defeat enemies to earn credits and advance levels.', <Sword size={24} />);
    }
    
    // Level 5: Forge (Upgrades)
    if (enemyLevel >= 5) {
      triggerTutorial('forge', 'FORGE UNLOCKED', 'Use Credits to buy passive Upgrades in the FORGE tab. These increase your tap damage and critical hits.', <Zap size={24} />);
    }

    // Level 10: Boss & Gear
    if (enemyLevel >= 10) {
      triggerTutorial('gear', 'ARMOR UNLOCKED', 'Bosses drop GEAR! Equip items in the ARMOR tab to boost your stats. Gear has rarities and can significantly boost your power.', <Shield size={24} />);
    }

    // Level 25: Cards
    if (enemyLevel >= 25) {
      triggerTutorial('cards', 'CARDS UNLOCKED', 'Bosses now have a chance to drop HOLOGRAPHIC CARDS. Collect them to earn massive permanent multipliers!', <Layers size={24} />);
    }

  }, [enemyLevel, seenTutorials]);

  if (!activeTutorial) return null;

  const handleClose = () => {
    setSeenTutorials(prev => ({ ...prev, [activeTutorial.id]: true }));
    setActiveTutorial(null);
  };

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pointer-events-auto">
      <div className="w-full max-w-sm bg-[#101426] border border-[#36D9FF] p-6 text-center shadow-[0_0_30px_rgba(155,81,111,0.3)]">
        <div className="mx-auto w-12 h-12 bg-[#36D9FF]/10 border border-[#36D9FF]/50 rounded flex items-center justify-center text-[#36D9FF] mb-4">
          {activeTutorial.icon}
        </div>
        <h2 className="font-display font-bold text-xl text-[#36D9FF] mb-2 uppercase tracking-widest">{activeTutorial.title}</h2>
        <p className="font-tech text-sm text-[#D0D4DC] leading-relaxed mb-6">
          {activeTutorial.desc}
        </p>
        <button
          onClick={handleClose}
          className="w-full py-3 bg-[#36D9FF] text-black font-display font-bold text-sm tracking-widest hover:bg-[#FFC857] transition-colors"
        >
          ACKNOWLEDGE
        </button>
      </div>
    </div>
  );
};
