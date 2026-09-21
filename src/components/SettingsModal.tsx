import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { sound } from '../utils/audio';
import { formatNumber } from '../utils/numberFormat';
import { Settings, Volume2, VolumeX, Music, ShieldAlert, Download, Upload, Trash2, X, BarChart2, Trophy } from 'lucide-react';
import { PlayGamesAchievementsModal } from './PlayGamesAchievementsModal';
import { playGamesService, PlayGamesAuthStatus } from '../services/playGamesService';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const {
    settings,
    updateSettings,
    questCounters,
    lifetimePeakLevel,
    eclipseCount,
    resetGameSave,
    exportSave,
    importSave,
  } = useGame();

  const [importStr, setImportStr] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'SETTINGS' | 'STATS'>('SETTINGS');
  const [showAchievements, setShowAchievements] = useState<boolean>(false);
  const [gpgsStatus, setGpgsStatus] = useState<PlayGamesAuthStatus>(playGamesService.getStatus());

  useEffect(() => {
    const unsub = playGamesService.subscribe((status) => {
      setGpgsStatus(status);
    });
    return unsub;
  }, []);

  const handleExport = () => {
    const data = exportSave();
    navigator.clipboard.writeText(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = () => {
    if (importStr.trim()) {
      importSave(importStr.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="bg-[#101426] border-2 border-[#30395C] max-w-sm w-full rounded-none flex flex-col overflow-hidden max-h-[90vh] shadow-[0_0_30px_rgba(0,0,0,0.9)]">
        {/* Modal Header */}
        <div className="p-3 border-b border-[#30395C] flex items-center justify-between bg-[#171D35]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#101426] border border-[#36D9FF] flex items-center justify-center shadow-[0_0_6px_rgba(54,217,255,0.3)]">
              <Settings size={12} className="text-[#36D9FF]" />
            </div>
            <span className="text-xs font-display font-bold text-[#E8EDF7] uppercase tracking-wider">
              SYS://CONFIGURATION_HUB
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-5 h-5 bg-[#101426] hover:bg-[#FF4268] hover:text-[#080A12] text-[#8993B2] border border-[#30395C] flex items-center justify-center transition-all"
          >
            <X size={12} />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 border-b border-[#30395C] bg-[#171D35]">
          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`py-2 text-xs font-display font-bold tracking-wider transition-all rounded-none ${
              activeTab === 'SETTINGS'
                ? 'bg-[#36D9FF] text-[#080A12] shadow-[0_0_8px_rgba(54,217,255,0.4)]'
                : 'text-[#8993B2] hover:text-[#E8EDF7]'
            }`}
          >
            PREFERENCES
          </button>
          <button
            onClick={() => setActiveTab('STATS')}
            className={`py-2 text-xs font-display font-bold tracking-wider transition-all rounded-none ${
              activeTab === 'STATS'
                ? 'bg-[#36D9FF] text-[#080A12] shadow-[0_0_8px_rgba(54,217,255,0.4)]'
                : 'text-[#8993B2] hover:text-[#E8EDF7]'
            }`}
          >
            LIFETIME STATS
          </button>
        </div>

        <div className="p-3 overflow-y-auto flex flex-col gap-2.5 bg-[#101426]">
          {activeTab === 'SETTINGS' ? (
            <>
              {/* Volume Sliders & Master Control */}
              <div className="flex flex-col gap-2.5 bg-[#171D35] border border-[#30395C] p-2.5 rounded-none">
                {/* Audio Matrix Header & Master Switch */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-display font-bold text-[#E8EDF7] uppercase flex items-center gap-1.5">
                    <Volume2 size={13} className="text-[#36D9FF]" /> AUDIO MATRIX
                  </span>

                  {/* Master Mute / Active Button */}
                  <button
                    id="btn-settings-master-mute"
                    onClick={() => {
                      const isAllMuted = settings.sfxMuted && settings.bgmMuted;
                      updateSettings({ sfxMuted: !isAllMuted, bgmMuted: !isAllMuted });
                    }}
                    className={`px-2 py-0.5 text-[9px] font-mono-code font-bold uppercase border transition-all flex items-center gap-1 cursor-pointer select-none ${
                      settings.sfxMuted && settings.bgmMuted
                        ? 'bg-[#101426] border-[#FF4268] text-[#FF4268] hover:bg-[#FF4268] hover:text-[#080A12]'
                        : 'bg-[#101426] border-[#36D9FF]/60 text-[#36D9FF] hover:border-[#36D9FF]'
                    }`}
                    title={settings.sfxMuted && settings.bgmMuted ? 'Unmute Master Audio' : 'Mute All Audio'}
                  >
                    {settings.sfxMuted && settings.bgmMuted ? (
                      <>
                        <VolumeX size={11} className="text-[#FF4268]" />
                        <span>MASTER MUTED</span>
                      </>
                    ) : (
                      <>
                        <Volume2 size={11} className="text-[#36D9FF]" />
                        <span>MASTER ONLINE</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Tactical SFX Channel */}
                <div className="flex flex-col gap-1 bg-[#101426] border border-[#30395C]/60 p-2">
                  <div className="flex items-center justify-between text-[9px] font-mono-code">
                    <span className="text-[#8993B2] font-bold">SOUND EFFECTS (SFX)</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => sound.play('crit_hit')}
                        disabled={settings.sfxMuted || settings.sfxVolume <= 0}
                        className="px-1.5 py-0.5 bg-[#171D35] hover:bg-[#36D9FF] hover:text-[#080A12] border border-[#30395C] text-[#8993B2] text-[8px] font-bold uppercase transition-all disabled:opacity-30 disabled:pointer-events-none"
                        title="Test Sound Effect"
                      >
                        TEST
                      </button>
                      <button
                        onClick={() => updateSettings({ sfxMuted: !settings.sfxMuted })}
                        className={`flex items-center gap-1 font-bold ${
                          settings.sfxMuted ? 'text-[#FF4268]' : 'text-[#36D9FF]'
                        }`}
                        title={settings.sfxMuted ? 'Enable Sound Effects' : 'Mute Sound Effects'}
                      >
                        {settings.sfxMuted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                        <span>{settings.sfxMuted ? 'MUTED' : `${Math.round(settings.sfxVolume * 100)}%`}</span>
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.sfxVolume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateSettings({ sfxVolume: val, sfxMuted: val === 0 ? true : settings.sfxMuted && val > 0 ? false : settings.sfxMuted });
                    }}
                    className="accent-[#36D9FF] cursor-pointer w-full"
                  />
                </div>

                {/* Ambient BGM Channel */}
                <div className="flex flex-col gap-1 bg-[#101426] border border-[#30395C]/60 p-2">
                  <div className="flex items-center justify-between text-[9px] font-mono-code">
                    <span className="text-[#8993B2] font-bold">BACKGROUND MUSIC (BGM)</span>
                    <button
                      onClick={() => updateSettings({ bgmMuted: !settings.bgmMuted })}
                      className={`flex items-center gap-1 font-bold ${
                        settings.bgmMuted ? 'text-[#FF4268]' : 'text-[#36D9FF]'
                      }`}
                      title={settings.bgmMuted ? 'Enable Background Music' : 'Mute Background Music'}
                    >
                      {settings.bgmMuted ? <VolumeX size={11} /> : <Music size={11} />}
                      <span>{settings.bgmMuted ? 'MUTED' : `${Math.round(settings.bgmVolume * 100)}%`}</span>
                    </button>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.bgmVolume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateSettings({ bgmVolume: val, bgmMuted: val === 0 ? true : settings.bgmMuted && val > 0 ? false : settings.bgmMuted });
                    }}
                    className="accent-[#36D9FF] cursor-pointer w-full"
                  />
                </div>
              </div>

              {/* Visual Toggles */}
              <div className="flex flex-col gap-1.5 bg-[#171D35] border border-[#30395C] p-2.5 rounded-none">
                <span className="text-xs font-display font-bold text-[#E8EDF7] uppercase">
                  FEEDBACK TELEMETRY
                </span>

                <label className="flex items-center justify-between text-xs text-[#E8EDF7] font-tech cursor-pointer py-0.5">
                  <span>FLOATING DAMAGE NUMBERS</span>
                  <input
                    type="checkbox"
                    checked={settings.damageNumbers}
                    onChange={(e) =>
                      updateSettings({ damageNumbers: e.target.checked })
                    }
                    className="accent-[#36D9FF] w-4 h-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-[#E8EDF7] font-tech cursor-pointer py-0.5">
                  <span>IMPACT CAMERA SHAKE</span>
                  <input
                    type="checkbox"
                    checked={settings.screenShake}
                    onChange={(e) =>
                      updateSettings({ screenShake: e.target.checked })
                    }
                    className="accent-[#36D9FF] w-4 h-4 cursor-pointer"
                  />
                </label>
              </div>

              {/* Google Play Games Services */}
              <div className="flex flex-col gap-2 bg-[#171D35] border border-[#30395C] p-2.5 rounded-none">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-display font-bold text-[#E8EDF7] uppercase flex items-center gap-1.5">
                    <Trophy size={13} className="text-[#FFC857]" /> GOOGLE PLAY GAMES
                  </span>
                  {gpgsStatus.isConnected ? (
                    <span className="text-[8px] font-mono-code text-[#36D9FF] bg-[#17283A] border border-[#36D9FF]/40 px-1.5 py-0.5 font-bold">
                      {gpgsStatus.isSandboxMode ? 'SANDBOX' : 'CONNECTED'}
                    </span>
                  ) : (
                    <span className="text-[8px] font-mono-code text-[#8993B2]">
                      DISCONNECTED
                    </span>
                  )}
                </div>

                <p className="text-[10px] font-tech text-[#8993B2] leading-tight">
                  Synchronize milestones, earn official Play Games XP, and view global game achievements.
                </p>

                <button
                  id="btn-settings-achievements"
                  onClick={() => setShowAchievements(true)}
                  className="w-full py-2 bg-[#101426] hover:bg-[#36D9FF] hover:text-[#080A12] border border-[#36D9FF] text-xs font-display font-bold text-[#36D9FF] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_12px_rgba(54,217,255,0.25)] active:scale-98"
                >
                  <Trophy size={14} className="text-[#FFC857]" />
                  <span>ACHIEVEMENTS</span>
                </button>
              </div>

              {/* Save Export / Import */}
              <div className="flex flex-col gap-2 bg-[#171D35] border border-[#30395C] p-2.5 rounded-none">
                <span className="text-xs font-display font-bold text-[#E8EDF7] uppercase">
                  ARCHIVE PERSISTENCE
                </span>

                <button
                  onClick={handleExport}
                  className="w-full py-1.5 bg-[#101426] hover:bg-[#17283A] border border-[#30395C] text-[#E8EDF7] text-xs font-display font-bold flex items-center justify-center gap-1 transition-all"
                >
                  <Download size={12} className="text-[#36D9FF]" /> {copied ? 'ENCRYPTED SAVE COPIED' : 'EXPORT SAVE STRING'}
                </button>

                <div className="flex flex-col gap-1 mt-0.5">
                  <input
                    type="text"
                    placeholder="PASTE SAVE STRING..."
                    value={importStr}
                    onChange={(e) => setImportStr(e.target.value)}
                    className="bg-[#101426] border border-[#30395C] text-xs text-[#E8EDF7] px-2 py-1 outline-none font-mono-code focus:border-[#36D9FF]"
                  />
                  <button
                    onClick={handleImport}
                    disabled={!importStr.trim()}
                    className="py-1 bg-[#101426] hover:bg-[#17283A] border border-[#30395C] text-[#E8EDF7] text-xs font-display font-bold flex items-center justify-center gap-1 disabled:opacity-40 transition-all"
                  >
                    <Upload size={12} className="text-[#FFC857]" /> RESTORE ARCHIVE
                  </button>
                </div>
              </div>

              {/* Hard Reset */}
              <div className="flex flex-col gap-1.5 bg-[#171D35] border border-[#FF4268]/50 p-2.5 rounded-none">
                <span className="text-xs font-display font-bold text-[#FF4268] uppercase flex items-center gap-1">
                  <ShieldAlert size={12} /> DANGER PROTOCOL
                </span>
                <span className="text-[9px] font-tech text-[#8993B2]">
                  Permanently wipe all progress, unlocked gear, cards, and prestige matrix.
                </span>

                {confirmReset ? (
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={resetGameSave}
                      className="flex-1 py-1 bg-[#FF4268] text-[#080A12] text-xs font-display font-bold hover:brightness-110"
                    >
                      CONFIRM PURGE
                    </button>
                    <button
                      onClick={() => setConfirmReset(false)}
                      className="flex-1 py-1 bg-[#101426] border border-[#30395C] text-xs font-display font-bold text-[#E8EDF7]"
                    >
                      CANCEL
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmReset(true)}
                    className="py-1 bg-[#101426] hover:bg-[#FF4268] hover:text-[#080A12] border border-[#FF4268] text-xs font-display font-bold text-[#FF4268] flex items-center justify-center gap-1 mt-0.5 transition-all"
                  >
                    <Trash2 size={12} /> PURGE SAVE DATA
                  </button>
                )}
              </div>

              {/* Legal Links */}
              <div className="flex justify-center pt-0.5">
                <a
                  href="/privacy-policy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-tech text-[#8993B2] hover:text-[#36D9FF] transition-colors underline"
                >
                  PRIVACY POLICY & TERMS
                </a>
              </div>
            </>
          ) : (
            /* Stats Screen */
            <div className="flex flex-col gap-2">
              <div className="bg-[#171D35] border border-[#30395C] p-2.5 rounded-none flex flex-col gap-2">
                <span className="text-xs font-display font-bold text-[#E8EDF7] uppercase flex items-center gap-1">
                  <BarChart2 size={12} className="text-[#36D9FF]" /> LIFETIME COMBAT TELEMETRY
                </span>

                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="flex justify-between items-center text-[#E8EDF7] border-b border-[#30395C]/40 pb-1">
                    <span className="text-[10px] font-tech text-[#8993B2]">PEAK FLOOR LEVEL:</span>
                    <span className="font-mono-code font-bold text-[#36D9FF]">FLOOR {lifetimePeakLevel}</span>
                  </div>
                  <div className="flex justify-between items-center text-[#E8EDF7] border-b border-[#30395C]/40 pb-1">
                    <span className="text-[10px] font-tech text-[#8993B2]">TARGETS VAPORIZED:</span>
                    <span className="font-mono-code font-bold text-[#E8EDF7]">
                      {formatNumber(questCounters.kills || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[#E8EDF7] border-b border-[#30395C]/40 pb-1">
                    <span className="text-[10px] font-tech text-[#8993B2]">BOSS GATES BREACHED:</span>
                    <span className="font-mono-code font-bold text-[#FFC857]">
                      {formatNumber(questCounters.boss_wins || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[#E8EDF7] border-b border-[#30395C]/40 pb-1">
                    <span className="text-[10px] font-tech text-[#8993B2]">ECLIPSES EXECUTED:</span>
                    <span className="font-mono-code font-bold text-[#36D9FF]">{eclipseCount}</span>
                  </div>
                  <div className="flex justify-between items-center text-[#E8EDF7] border-b border-[#30395C]/40 pb-1">
                    <span className="text-[10px] font-tech text-[#8993B2]">SUBSYSTEM UPGRADES:</span>
                    <span className="font-mono-code font-bold text-[#E8EDF7]">
                      {formatNumber(questCounters.upgrades_bought || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[#E8EDF7]">
                    <span className="text-[10px] font-tech text-[#8993B2]">ARCADE TRIALS:</span>
                    <span className="font-mono-code font-bold text-[#FFC857]">
                      {questCounters.minigame_played || 0} ({questCounters.minigame_wins || 0} WINS)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Google Play Games Achievements Modal */}
      {showAchievements && (
        <PlayGamesAchievementsModal onClose={() => setShowAchievements(false)} />
      )}
    </div>
  );
};
