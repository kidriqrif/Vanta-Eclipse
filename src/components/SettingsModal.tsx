import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { formatNumber } from '../utils/numberFormat';
import { Settings, Volume2, ShieldAlert, Download, Upload, Trash2, X, BarChart2 } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 bg-[#08080C]/80 flex items-center justify-center p-4">
      <div className="bg-[#171722] border-2 border-[#4E4E66] max-w-sm w-full flex flex-col overflow-hidden max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-3 border-b border-[#4E4E66] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-[#FF3A46]" />
            <span className="text-xs font-bold text-[#F6F6FC]">OPTIONS & ARCHIVE</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#8686A2] hover:text-[#F6F6FC]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 border-b border-[#4E4E66] bg-[#08080C]">
          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`py-1.5 text-xs font-bold ${
              activeTab === 'SETTINGS'
                ? 'bg-[#171722] text-[#F6F6FC] border-b-2 border-[#FF3A46]'
                : 'text-[#8686A2] hover:text-[#F6F6FC]'
            }`}
          >
            PREFERENCES
          </button>
          <button
            onClick={() => setActiveTab('STATS')}
            className={`py-1.5 text-xs font-bold ${
              activeTab === 'STATS'
                ? 'bg-[#171722] text-[#F6F6FC] border-b-2 border-[#FF3A46]'
                : 'text-[#8686A2] hover:text-[#F6F6FC]'
            }`}
          >
            LIFETIME STATS
          </button>
        </div>

        <div className="p-3 overflow-y-auto flex flex-col gap-3">
          {activeTab === 'SETTINGS' ? (
            <>
              {/* Volume Sliders */}
              <div className="flex flex-col gap-2 bg-[#08080C] border border-[#4E4E66] p-2.5">
                <span className="text-xs font-bold text-[#F6F6FC] flex items-center gap-1.5">
                  <Volume2 size={14} className="text-[#3EDCFA]" /> AUDIO CONTROLS
                </span>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-[#8686A2]">
                    <span>SOUND EFFECTS</span>
                    <span>{Math.round(settings.sfxVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.sfxVolume}
                    onChange={(e) =>
                      updateSettings({ sfxVolume: parseFloat(e.target.value) })
                    }
                    className="accent-[#FF3A46] cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex justify-between text-[10px] text-[#8686A2]">
                    <span>AMBIENT BGM</span>
                    <span>{Math.round(settings.bgmVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.bgmVolume}
                    onChange={(e) =>
                      updateSettings({ bgmVolume: parseFloat(e.target.value) })
                    }
                    className="accent-[#3EDCFA] cursor-pointer"
                  />
                </div>
              </div>

              {/* Visual Toggles */}
              <div className="flex flex-col gap-2 bg-[#08080C] border border-[#4E4E66] p-2.5">
                <span className="text-xs font-bold text-[#F6F6FC]">GAMEPLAY FEEDBACK</span>

                <label className="flex items-center justify-between text-xs text-[#C8C8DA] cursor-pointer">
                  <span>Floating Damage Numbers</span>
                  <input
                    type="checkbox"
                    checked={settings.damageNumbers}
                    onChange={(e) =>
                      updateSettings({ damageNumbers: e.target.checked })
                    }
                    className="accent-[#FF3A46] w-4 h-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-[#C8C8DA] cursor-pointer">
                  <span>Screen Shake Effects</span>
                  <input
                    type="checkbox"
                    checked={settings.screenShake}
                    onChange={(e) =>
                      updateSettings({ screenShake: e.target.checked })
                    }
                    className="accent-[#FF3A46] w-4 h-4 cursor-pointer"
                  />
                </label>
              </div>

              {/* Save Export / Import */}
              <div className="flex flex-col gap-2 bg-[#08080C] border border-[#4E4E66] p-2.5">
                <span className="text-xs font-bold text-[#F6F6FC]">SAVE MANAGEMENT</span>

                <div className="flex gap-2">
                  <button
                    onClick={handleExport}
                    className="flex-1 py-1 bg-[#2C2C3C] border border-[#4E4E66] text-xs font-bold text-[#F6F6FC] hover:bg-[#4E4E66] flex items-center justify-center gap-1"
                  >
                    <Download size={13} /> {copied ? 'COPIED!' : 'EXPORT SAVE'}
                  </button>
                </div>

                <div className="flex flex-col gap-1 mt-1">
                  <input
                    type="text"
                    placeholder="Paste save string here..."
                    value={importStr}
                    onChange={(e) => setImportStr(e.target.value)}
                    className="bg-[#171722] border border-[#4E4E66] text-xs text-[#F6F6FC] px-2 py-1 outline-none font-mono"
                  />
                  <button
                    onClick={handleImport}
                    disabled={!importStr.trim()}
                    className="py-1 bg-[#2C2C3C] border border-[#4E4E66] text-xs font-bold text-[#3EDCFA] hover:bg-[#3EDCFA] hover:text-[#08080C] flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    <Upload size={13} /> RESTORE IMPORT
                  </button>
                </div>
              </div>

              {/* Hard Reset */}
              <div className="flex flex-col gap-1.5 bg-[#08080C] border border-[#B01228] p-2.5">
                <span className="text-xs font-bold text-[#FF3A46] flex items-center gap-1">
                  <ShieldAlert size={14} /> DANGER ZONE
                </span>
                <span className="text-[10px] text-[#8686A2]">
                  Permanently erase all progress, gear, cards, and prestige stats.
                </span>

                {confirmReset ? (
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={resetGameSave}
                      className="flex-1 py-1 bg-[#FF3A46] text-[#08080C] text-xs font-bold hover:bg-[#F6F6FC]"
                    >
                      CONFIRM WIPE
                    </button>
                    <button
                      onClick={() => setConfirmReset(false)}
                      className="flex-1 py-1 bg-[#2C2C3C] text-xs font-bold text-[#F6F6FC]"
                    >
                      CANCEL
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmReset(true)}
                    className="py-1 bg-[#2C2C3C] border border-[#FF3A46] text-xs font-bold text-[#FF3A46] hover:bg-[#FF3A46] hover:text-[#08080C] flex items-center justify-center gap-1"
                  >
                    <Trash2 size={13} /> WIPE SAVE DATA
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Stats Screen */
            <div className="flex flex-col gap-2">
              <div className="bg-[#08080C] border border-[#4E4E66] p-2.5 flex flex-col gap-2">
                <span className="text-xs font-bold text-[#F6F6FC] flex items-center gap-1.5">
                  <BarChart2 size={14} className="text-[#6ADC3E]" /> COMBAT RECORDS
                </span>

                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="flex justify-between text-[#C8C8DA]">
                    <span>Lifetime Peak Floor:</span>
                    <span className="font-bold text-[#FF3A46]">LV.{lifetimePeakLevel}</span>
                  </div>
                  <div className="flex justify-between text-[#C8C8DA]">
                    <span>Total Enemies Slain:</span>
                    <span className="font-bold text-[#F6F6FC]">
                      {formatNumber(questCounters.kills || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#C8C8DA]">
                    <span>Boss Gates Vanquished:</span>
                    <span className="font-bold text-[#FFD23C]">
                      {formatNumber(questCounters.boss_wins || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#C8C8DA]">
                    <span>Eclipses Performed:</span>
                    <span className="font-bold text-[#3EDCFA]">{eclipseCount}</span>
                  </div>
                  <div className="flex justify-between text-[#C8C8DA]">
                    <span>Upgrades Purchased:</span>
                    <span className="font-bold text-[#F6F6FC]">
                      {formatNumber(questCounters.upgrades_bought || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#C8C8DA]">
                    <span>Arcade Trials Completed:</span>
                    <span className="font-bold text-[#A85CFF]">
                      {questCounters.minigame_played || 0} ({questCounters.minigame_wins || 0} Wins)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
