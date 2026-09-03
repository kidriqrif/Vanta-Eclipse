import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import {
  playGamesService,
  DEFAULT_GPGS_ACHIEVEMENTS,
  PlayGamesAuthStatus,
} from '../services/playGamesService';
import { QUESTS } from '../data/definitions';
import { formatNumber } from '../utils/numberFormat';
import {
  Trophy,
  X,
  RefreshCw,
  LogIn,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Award,
  Zap,
} from 'lucide-react';

interface PlayGamesAchievementsModalProps {
  onClose: () => void;
}

export const PlayGamesAchievementsModal: React.FC<PlayGamesAchievementsModalProps> = ({
  onClose,
}) => {
  const {
    completedQuests,
    questCounters,
    enemyLevel,
    ownedRelics,
    ownedPets,
    skillLevels,
  } = useGame();

  const [authStatus, setAuthStatus] = useState<PlayGamesAuthStatus>(
    playGamesService.getStatus()
  );
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNLOCKED' | 'LOCKED'>('ALL');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [customClientId, setCustomClientId] = useState<string>(
    authStatus.clientId || ''
  );
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = playGamesService.subscribe((status) => {
      setAuthStatus(status);
    });
    return unsubscribe;
  }, []);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const skillsCount = Object.values(skillLevels).reduce((a, b) => a + b, 0);
      const res = await playGamesService.syncAll(
        completedQuests,
        questCounters,
        enemyLevel,
        ownedRelics.length,
        Object.keys(ownedPets).length,
        skillsCount
      );
      setSyncFeedback(
        res.errors === 0
          ? `Synced ${res.syncedCount} achievements to Google Play Games!`
          : `Synced ${res.syncedCount} items (${res.errors} queued offline).`
      );
    } catch {
      setSyncFeedback('Sync complete (offline queue updated).');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 3500);
    }
  };

  const handleSignIn = async () => {
    setIsConnecting(true);
    const res = await playGamesService.signIn(customClientId);
    setIsConnecting(false);
    if (res.success) {
      handleSyncAll();
    }
  };

  const handleSandboxConnect = () => {
    playGamesService.enableSandboxMode('VoidWalker#7741');
    handleSyncAll();
  };

  const handleSaveClientId = () => {
    playGamesService.setClientId(customClientId);
    setShowConfig(false);
  };

  // Helper to compute progress for each achievement
  const getAchievementData = (def: typeof DEFAULT_GPGS_ACHIEVEMENTS[0]) => {
    const isCompleted = completedQuests.includes(def.gameQuestId);
    let currentVal = 0;
    const qDef = QUESTS.find((q) => q.id === def.gameQuestId);

    if (qDef) {
      if (qDef.metric === 'enemy_level') currentVal = enemyLevel;
      else if (qDef.metric === 'relics_owned') currentVal = ownedRelics.length;
      else if (qDef.metric === 'pets_owned') currentVal = Object.keys(ownedPets).length;
      else if (qDef.metric === 'skills_bought') {
        currentVal = Object.values(skillLevels).reduce((a, b) => a + b, 0);
      } else {
        currentVal = questCounters[qDef.metric] || 0;
      }
    }

    const progress = Math.min(def.totalSteps, Math.max(0, currentVal));
    const percent = Math.min(100, (progress / def.totalSteps) * 100);

    return {
      isCompleted,
      progress,
      percent,
    };
  };

  // Filtered achievements
  const filteredAchievements = DEFAULT_GPGS_ACHIEVEMENTS.filter((def) => {
    const isCompleted = completedQuests.includes(def.gameQuestId);
    if (activeFilter === 'UNLOCKED') return isCompleted;
    if (activeFilter === 'LOCKED') return !isCompleted;
    return true;
  });

  const totalUnlockedCount = DEFAULT_GPGS_ACHIEVEMENTS.filter((def) =>
    completedQuests.includes(def.gameQuestId)
  ).length;

  const totalXPEarned = DEFAULT_GPGS_ACHIEVEMENTS.filter((def) =>
    completedQuests.includes(def.gameQuestId)
  ).reduce((sum, def) => sum + def.xpFull, 0);

  const totalPossibleXP = DEFAULT_GPGS_ACHIEVEMENTS.reduce(
    (sum, def) => sum + def.xpFull,
    0
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="bg-[#101426] border-2 border-[#30395C] max-w-md w-full rounded-none flex flex-col overflow-hidden max-h-[92vh] shadow-[0_0_35px_rgba(0,0,0,0.95)]">
        {/* Modal Header */}
        <div className="p-3 border-b border-[#30395C] flex items-center justify-between bg-[#171D35]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-[#101426] border border-[#FFC857] flex items-center justify-center shadow-[0_0_8px_rgba(255,200,87,0.3)]">
              <Trophy size={14} className="text-[#FFC857]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-display font-bold text-[#E8EDF7] tracking-wider uppercase">
                GOOGLE PLAY GAMES
              </span>
              <span className="text-[9px] font-mono-code text-[#8993B2]">
                ACHIEVEMENT MATRIX & CLOUD SYNCHRONIZER
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 bg-[#101426] hover:bg-[#FF4268] hover:text-[#080A12] text-[#8993B2] border border-[#30395C] flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Player Status Banner */}
        <div className="p-3 bg-[#171D35] border-b border-[#30395C] flex flex-col gap-2">
          {authStatus.isConnected ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-[#101426] border border-[#36D9FF] flex items-center justify-center text-[#36D9FF] font-display font-bold text-sm shadow-[0_0_10px_rgba(54,217,255,0.25)]">
                    {authStatus.player?.displayName?.charAt(0).toUpperCase() || 'P'}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-display font-bold text-[#E8EDF7]">
                        {authStatus.player?.displayName || 'Play Games Player'}
                      </span>
                      <span className="text-[8px] font-mono-code bg-[#17283A] border border-[#36D9FF]/40 text-[#36D9FF] px-1 py-0.2 font-bold">
                        LVL {authStatus.player?.level || 1}
                      </span>
                      {authStatus.isSandboxMode && (
                        <span className="text-[8px] font-mono-code bg-[#FFC857]/20 border border-[#FFC857]/50 text-[#FFC857] px-1 font-bold">
                          SANDBOX
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] font-mono-code text-[#8993B2]">
                      {authStatus.isSandboxMode
                        ? 'Simulated Google Play Games connection'
                        : 'Authenticated via Google Identity Services'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleSyncAll}
                    disabled={isSyncing}
                    title="Synchronize achievements with Google Play Games"
                    className="px-2.5 py-1 bg-[#101426] hover:bg-[#36D9FF] hover:text-[#080A12] border border-[#36D9FF]/50 text-[10px] font-display font-bold text-[#36D9FF] flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer shadow-[0_0_6px_rgba(54,217,255,0.2)]"
                  >
                    <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
                    <span>{isSyncing ? 'SYNCING...' : 'SYNC ALL'}</span>
                  </button>
                  <button
                    onClick={() => playGamesService.signOut()}
                    title="Sign Out"
                    className="p-1 bg-[#101426] hover:bg-[#FF4268] hover:text-[#080A12] border border-[#30395C] text-[#8993B2] transition-all cursor-pointer"
                  >
                    <LogOut size={12} />
                  </button>
                </div>
              </div>

              {/* XP Progress Bar */}
              <div className="bg-[#101426] border border-[#30395C] p-2 flex flex-col gap-1">
                <div className="flex justify-between text-[9px] font-mono-code text-[#8993B2]">
                  <span className="flex items-center gap-1 text-[#E8EDF7]">
                    <Sparkles size={10} className="text-[#FFC857]" /> PLAY GAMES XP EARNED:
                  </span>
                  <span className="text-[#FFC857] font-bold">
                    {formatNumber(totalXPEarned)} / {formatNumber(totalPossibleXP)} XP
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#080A12] border border-[#30395C] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#171D35] via-[#36D9FF] to-[#FFC857] transition-all duration-300"
                    style={{
                      width: `${(totalXPEarned / Math.max(1, totalPossibleXP)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-[#36D9FF]" />
                  <span className="text-xs font-display font-bold text-[#E8EDF7] uppercase">
                    PLAY GAMES INTEGRATION
                  </span>
                </div>
                <span className="text-[9px] font-mono-code text-[#8993B2]">
                  STATUS: <span className="text-[#FF4268]">DISCONNECTED</span>
                </span>
              </div>

              <p className="text-[10px] font-tech text-[#8993B2] leading-relaxed">
                Connect your Google Play Games account to synchronize achievements, earn
                official Google Play XP, and unlock global gaming milestones.
              </p>

              {authStatus.error && (
                <div className="text-[9px] font-mono-code text-[#FF4268] bg-[#FF4268]/10 border border-[#FF4268]/30 p-1.5">
                  {authStatus.error}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  onClick={handleSignIn}
                  disabled={isConnecting}
                  className="flex-1 py-1.5 bg-[#101426] hover:bg-[#FFC857] hover:text-[#080A12] border border-[#FFC857] text-xs font-display font-bold text-[#FFC857] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-[0_0_8px_rgba(255,200,87,0.2)]"
                >
                  <LogIn size={13} className="text-[#FFC857]" />
                  <span>{isConnecting ? 'CONNECTING...' : 'SIGN IN WITH GOOGLE'}</span>
                </button>
                <button
                  onClick={handleSandboxConnect}
                  className="px-3 py-1.5 bg-[#101426] hover:bg-[#36D9FF] hover:text-[#080A12] border border-[#30395C] text-xs font-display font-bold text-[#E8EDF7] flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Zap size={12} className="text-[#36D9FF]" />
                  <span>SANDBOX TEST</span>
                </button>
              </div>
            </div>
          )}

          {/* Sync notification toast */}
          {syncFeedback && (
            <div className="text-[9px] font-mono-code text-[#FFC857] bg-[#FFC857]/10 border border-[#FFC857]/40 px-2 py-1 flex items-center gap-1.5">
              <CheckCircle2 size={11} />
              <span>{syncFeedback}</span>
            </div>
          )}
        </div>

        {/* Stats & Filters */}
        <div className="px-3 py-2 bg-[#101426] border-b border-[#30395C] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-tech text-[#8993B2]">UNLOCKED:</span>
            <span className="text-xs font-mono-code font-bold text-[#FFC857]">
              {totalUnlockedCount} / {DEFAULT_GPGS_ACHIEVEMENTS.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {(['ALL', 'UNLOCKED', 'LOCKED'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-2 py-0.5 text-[9px] font-mono-code font-bold rounded-none transition-all cursor-pointer ${
                  activeFilter === filter
                    ? 'bg-[#36D9FF] text-[#080A12] shadow-[0_0_6px_rgba(54,217,255,0.3)]'
                    : 'bg-[#171D35] text-[#8993B2] border border-[#30395C] hover:text-[#E8EDF7]'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Achievements List */}
        <div className="p-3 overflow-y-auto flex flex-col gap-2 flex-1 bg-[#101426]">
          {filteredAchievements.map((def) => {
            const { isCompleted, progress, percent } = getAchievementData(def);

            return (
              <div
                key={def.id}
                className={`p-2.5 border transition-all flex flex-col gap-1.5 rounded-none ${
                  isCompleted
                    ? 'bg-[#171D35] border-[#FFC857]/60 shadow-[inset_0_0_8px_rgba(255,200,87,0.08)]'
                    : 'bg-[#101426]/70 border-[#30395C]/50 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 shrink-0 flex items-center justify-center border ${
                        isCompleted
                          ? 'bg-[#101426] border-[#FFC857] text-[#FFC857] shadow-[0_0_8px_rgba(255,200,87,0.3)]'
                          : 'bg-[#101426] border-[#30395C] text-[#8993B2]'
                      }`}
                    >
                      {isCompleted ? <Award size={16} /> : <Lock size={15} />}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-xs font-display font-bold uppercase tracking-wide truncate ${
                            isCompleted ? 'text-[#E8EDF7]' : 'text-[#8993B2]'
                          }`}
                        >
                          {def.name}
                        </span>
                        <span className="text-[8px] font-mono-code bg-[#101426] border border-[#30395C] text-[#FFC857] px-1 font-bold">
                          +{formatNumber(def.xpFull)} XP
                        </span>
                      </div>
                      <span className="text-[10px] font-tech text-[#8993B2] mt-0.5">
                        {def.description}
                      </span>
                    </div>
                  </div>

                  {/* Status Tag */}
                  <div className="shrink-0 flex flex-col items-end">
                    {isCompleted ? (
                      <span className="text-[9px] font-mono-code font-bold text-[#FFC857] flex items-center gap-1">
                        <CheckCircle2 size={11} /> UNLOCKED
                      </span>
                    ) : (
                      <span className="text-[8px] font-mono-code text-[#8993B2]">
                        {percent.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="flex flex-col gap-0.5 mt-0.5">
                  <div className="flex justify-between text-[8px] font-mono-code text-[#8993B2]">
                    <span className="truncate">GPGS ID: {def.id}</span>
                    <span>
                      {formatNumber(progress)} / {formatNumber(def.totalSteps)}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-[#080A12] border border-[#30395C] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${
                        isCompleted ? 'bg-[#FFC857]' : 'bg-[#36D9FF]'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Developer / Configuration Accordion */}
        <div className="border-t border-[#30395C] bg-[#171D35]">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="w-full px-3 py-2 text-[10px] font-mono-code text-[#8993B2] hover:text-[#E8EDF7] flex items-center justify-between transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <span>GOOGLE CLOUD & CONSOLE SETUP</span>
            </span>
            {showConfig ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showConfig && (
            <div className="p-3 border-t border-[#30395C] bg-[#101426] flex flex-col gap-2.5 text-[10px] font-mono-code text-[#8993B2]">
              <div className="flex flex-col gap-1">
                <span className="text-[#E8EDF7] font-bold">OAUTH 2.0 WEB CLIENT ID:</span>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
                    value={customClientId}
                    onChange={(e) => setCustomClientId(e.target.value)}
                    className="flex-1 bg-[#171D35] border border-[#30395C] text-[10px] text-[#E8EDF7] px-2 py-1 outline-none focus:border-[#36D9FF]"
                  />
                  <button
                    onClick={handleSaveClientId}
                    className="px-2.5 py-1 bg-[#36D9FF] text-[#080A12] font-bold hover:brightness-110 cursor-pointer"
                  >
                    SAVE
                  </button>
                </div>
              </div>

              <div className="bg-[#171D35] p-2 border border-[#30395C] flex flex-col gap-1">
                <span className="text-[#E8EDF7] font-bold">PLAY CONSOLE SETUP GUIDE:</span>
                <p className="text-[9px] text-[#8993B2] leading-relaxed">
                  1. Go to Google Play Console &gt; Play Games Services &gt; Setup and Management &gt; Configuration.
                  <br />
                  2. In Google Cloud Console &gt; APIs &amp; Services &gt; Credentials, create an OAuth 2.0 Web Client ID.
                  <br />
                  3. Add authorized JavaScript origins for your domain.
                  <br />
                  4. Paste the Client ID above or declare it as <code className="text-[#36D9FF]">VITE_GOOGLE_CLIENT_ID</code>.
                </p>
                <a
                  href="https://developers.google.com/games/services/web/api/achievements"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#36D9FF] hover:underline flex items-center gap-1 text-[9px] mt-1"
                >
                  <ExternalLink size={10} /> Official Google Play Games Services Web API Documentation
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
