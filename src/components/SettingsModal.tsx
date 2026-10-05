import React, { useEffect, useId, useRef, useState } from 'react';
import {
  BarChart2,
  Check,
  Download,
  ExternalLink,
  Info,
  Loader2,
  Music,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useControls, useDispatch, useGameState } from '../hooks/useGame';
import { usePrivacyOptionsRequired, useRestorePurchases, useStore } from '../hooks/useMonetization';
import { ads } from '../services/ads';
import { audio } from '../services/audio';
import type { GameSettings } from '../types/game';
import { formatNumber } from '../utils/numberFormat';
import { Button, Modal, TwoTapButton } from './ui';

const PRIVACY_URL = 'https://kidriqrif.github.io/Vanta-Eclipse/privacy-policy.html';

type Tab = 'SETTINGS' | 'STATS';
type Message = { text: string; tone: 'ok' | 'warn' };

function useMountedRef() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

const Section: React.FC<{ title: string; icon: React.ReactNode; danger?: boolean; children: React.ReactNode }> = ({
  title,
  icon,
  danger,
  children,
}) => (
  <section className={`bg-panel2 border p-2.5 flex flex-col gap-2 ${danger ? 'border-crimson/60' : 'border-line'}`}>
    <h3
      className={`text-[11px] font-display font-bold uppercase tracking-wider flex items-center gap-1.5 ${danger ? 'text-crimson' : 'text-ink'}`}
    >
      {icon}
      {title}
    </h3>
    {children}
  </section>
);

const Hint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] font-tech text-dim leading-tight">{children}</p>
);

const StatusLine: React.FC<{ message: Message | null }> = ({ message }) =>
  message ? (
    <p
      role="status"
      aria-live="polite"
      className={`text-[10px] font-tech leading-tight flex items-start gap-1 ${message.tone === 'warn' ? 'text-gold' : 'text-toxic'}`}
    >
      {message.tone === 'warn' ? (
        <Info size={11} className="shrink-0 mt-px" aria-hidden />
      ) : (
        <Check size={11} className="shrink-0 mt-px" aria-hidden />
      )}
      {message.text}
    </p>
  ) : null;

// ---------------------------------------------------------------- audio & feedback

const VolumeRow: React.FC<{
  label: string;
  icon: React.ReactNode;
  volume: number;
  muted: boolean;
  onVolume: (v: number) => void;
  onToggleMute: () => void;
  extra?: React.ReactNode;
}> = ({ label, icon, volume, muted, onVolume, onToggleMute, extra }) => {
  const id = useId();
  const pct = `${formatNumber(Math.round(volume * 100))}%`;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[11px] font-tech text-ink flex items-center gap-1.5">
          {icon}
          {label}
        </label>
        <span className={`text-[10px] font-mono-code font-bold ${muted ? 'text-crimson' : 'text-dim'}`}>{muted ? `MUTED · ${pct}` : pct}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          aria-valuetext={muted ? `${pct}, muted` : pct}
          onChange={(e) => onVolume(Number(e.target.value))}
          className="flex-1 min-w-0 h-8 accent-neon cursor-pointer"
        />
        {extra}
        <Button size="sm" variant={muted ? 'danger' : 'ghost'} className="min-w-[84px]" onClick={onToggleMute}>
          {muted ? <VolumeX size={11} aria-hidden /> : <Volume2 size={11} aria-hidden />}
          {muted ? 'UNMUTE' : 'MUTE'}
        </Button>
      </div>
    </div>
  );
};

const ToggleRow: React.FC<{ label: string; detail: string; on: boolean; onToggle: () => void }> = ({ label, detail, on, onToggle }) => (
  <div className="flex items-center justify-between gap-2">
    <div className="flex flex-col min-w-0">
      <span className="text-[11px] font-tech text-ink">{label}</span>
      <span className="text-[10px] font-tech text-dim leading-tight">{detail}</span>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`shrink-0 min-h-[32px] min-w-[64px] px-2 border text-[10px] font-display font-bold uppercase flex items-center justify-center gap-1 transition-colors ${
        on ? 'bg-active border-neon text-neon' : 'bg-void border-line text-dim hover:text-ink'
      }`}
    >
      {on && <Check size={11} aria-hidden />}
      {on ? 'ON' : 'OFF'}
    </button>
  </div>
);

const AudioSection: React.FC = () => {
  const dispatch = useDispatch();
  const settings = useGameState((s) => s.settings);
  const update = (partial: Partial<GameSettings>) => dispatch({ type: 'UPDATE_SETTINGS', partial });
  const sfxSilent = settings.sfxMuted || settings.sfxVolume <= 0;

  return (
    <>
      <Section title="Sound" icon={<Volume2 size={13} className="text-neon" aria-hidden />}>
        <VolumeRow
          label="Sound effects"
          icon={<Volume2 size={12} className="text-dim" aria-hidden />}
          volume={settings.sfxVolume}
          muted={settings.sfxMuted}
          // Dragging the slider up while muted means "I want to hear this": unmute too.
          onVolume={(v) => update(settings.sfxMuted && v > 0 ? { sfxVolume: v, sfxMuted: false } : { sfxVolume: v })}
          onToggleMute={() => update({ sfxMuted: !settings.sfxMuted })}
          extra={
            <Button
              size="sm"
              variant="ghost"
              disabled={sfxSilent}
              aria-label="Test sound effects"
              onClick={() => {
                audio.unlock();
                audio.play('crit_hit');
              }}
            >
              TEST
            </Button>
          }
        />
        <VolumeRow
          label="Music"
          icon={<Music size={12} className="text-dim" aria-hidden />}
          volume={settings.bgmVolume}
          muted={settings.bgmMuted}
          onVolume={(v) => update(settings.bgmMuted && v > 0 ? { bgmVolume: v, bgmMuted: false } : { bgmVolume: v })}
          onToggleMute={() => update({ bgmMuted: !settings.bgmMuted })}
        />
      </Section>

      <Section title="Feedback" icon={<SlidersHorizontal size={13} className="text-neon" aria-hidden />}>
        <ToggleRow
          label="Damage numbers"
          detail="Floating numbers when you hit."
          on={settings.damageNumbers}
          onToggle={() => update({ damageNumbers: !settings.damageNumbers })}
        />
        <ToggleRow
          label="Screen shake"
          detail="A short shake on your critical hits."
          on={settings.screenShake}
          onToggle={() => update({ screenShake: !settings.screenShake })}
        />
        <ToggleRow
          label="Vibration"
          detail="A buzz on critical hits, bosses and rare drops."
          on={settings.hapticsEnabled}
          onToggle={() => update({ hapticsEnabled: !settings.hapticsEnabled })}
        />
      </Section>
    </>
  );
};

// ---------------------------------------------------------------- ads privacy & purchases

const PrivacySection: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useMountedRef();
  const open = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await ads.showPrivacyOptions();
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <Section title="Ad privacy" icon={<ShieldCheck size={13} className="text-neon" aria-hidden />}>
      <Hint>Review or change the choices you made about ads and your data.</Hint>
      <Button size="md" variant="primary" block disabled={busy} aria-busy={busy} onClick={() => void open()}>
        {busy && <Loader2 size={12} className="animate-spin" aria-hidden />}
        AD PRIVACY OPTIONS
      </Button>
    </Section>
  );
};

const PurchasesSection: React.FC = () => {
  const restorePurchases = useRestorePurchases();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const busyRef = useRef(false);
  const mounted = useMountedRef();

  const restore = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    let next: Message;
    try {
      const n = await restorePurchases();
      next =
        n > 0
          ? { text: `Restored ${formatNumber(n)} purchase${n === 1 ? '' : 's'}`, tone: 'ok' }
          : { text: 'Nothing to restore', tone: 'warn' };
    } catch {
      next = { text: 'Could not reach Google Play. Please try again later.', tone: 'warn' };
    } finally {
      busyRef.current = false;
    }
    if (!mounted.current) return;
    setBusy(false);
    setMessage(next);
  };

  return (
    <Section title="Purchases" icon={<RotateCcw size={13} className="text-gold" aria-hidden />}>
      <Hint>New phone, or reinstalled? Restore what you bought with this Google Play account.</Hint>
      <Button size="md" variant="gold" block disabled={busy} aria-busy={busy} className="disabled:opacity-40" onClick={() => void restore()}>
        {busy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <RotateCcw size={12} aria-hidden />}
        {busy ? 'CHECKING…' : 'RESTORE PURCHASES'}
      </Button>
      <StatusLine message={message} />
    </Section>
  );
};

// ---------------------------------------------------------------- save data

const SaveSection: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const controls = useControls();
  const mounted = useMountedRef();
  const [manualExport, setManualExport] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState<Message | null>(null);
  const importId = useId();

  const exportSave = async () => {
    const text = controls.exportSave();
    let copied = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!mounted.current) return;
    if (copied) {
      setManualExport(null);
      setMessage({ text: 'Save copied to the clipboard. Paste it somewhere safe.', tone: 'ok' });
    } else {
      setManualExport(text);
      setMessage({ text: 'Could not copy automatically. Select the text below and copy it.', tone: 'warn' });
    }
  };

  const importSave = () => {
    const ok = controls.importSave(importText);
    if (ok) {
      setImportText('');
      setManualExport(null);
      setMessage({ text: 'Save loaded.', tone: 'ok' });
    } else {
      setMessage({ text: 'That is not a valid save', tone: 'warn' });
    }
  };

  return (
    <>
      <Section title="Save data" icon={<Save size={13} className="text-neon" aria-hidden />}>
        <Hint>Your progress is saved on this device. Export it to keep a copy, or to move it to another device.</Hint>
        <Button size="md" variant="primary" block onClick={() => void exportSave()}>
          <Download size={12} aria-hidden /> EXPORT SAVE
        </Button>
        {manualExport !== null && (
          <textarea
            readOnly
            value={manualExport}
            rows={3}
            aria-label="Your save. Select all and copy it."
            onFocus={(e) => e.currentTarget.select()}
            className="w-full bg-void border border-line text-[10px] font-mono-code text-ink p-1.5 break-all resize-none select-text outline-none focus:border-neon"
          />
        )}

        <label htmlFor={importId} className="text-[11px] font-tech text-ink pt-1">
          Load a save
        </label>
        <textarea
          id={importId}
          value={importText}
          rows={3}
          placeholder="Paste an exported save here"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => setImportText(e.target.value)}
          className="w-full bg-void border border-line text-[10px] font-mono-code text-ink p-1.5 break-all resize-none select-text outline-none placeholder:text-faint focus:border-neon"
        />
        <TwoTapButton
          size="md"
          block
          variant="primary"
          armedVariant="danger"
          disabled={!importText.trim()}
          label={
            <>
              <Upload size={12} aria-hidden /> LOAD SAVE
            </>
          }
          armedLabel="TAP AGAIN: REPLACES CURRENT PROGRESS"
          onConfirm={importSave}
        />
        <StatusLine message={message} />
      </Section>

      <Section title="Reset" icon={<Trash2 size={13} className="text-crimson" aria-hidden />} danger>
        <Hint>Erases all progress on this device and starts a new game. This cannot be undone. Export your save first if you might want it back.</Hint>
        <TwoTapButton
          size="md"
          block
          variant="danger"
          armedVariant="danger"
          label={
            <>
              <Trash2 size={12} aria-hidden /> RESET ALL PROGRESS
            </>
          }
          armedLabel="TAP AGAIN: ERASE EVERYTHING"
          onConfirm={() => {
            controls.resetSave();
            onClose();
          }}
        />
      </Section>
    </>
  );
};

// ---------------------------------------------------------------- tabs

const SettingsTab: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const privacyRequired = usePrivacyOptionsRequired();
  const store = useStore();
  return (
    <>
      <AudioSection />
      {privacyRequired && <PrivacySection />}
      {store.available && <PurchasesSection />}
      <SaveSection onClose={onClose} />
    </>
  );
};

const StatsTab: React.FC = () => {
  const counters = useGameState((s) => s.quests.counters);
  const peak = useGameState((s) => s.lifetimePeakLevel);
  const eclipses = useGameState((s) => s.eclipseCount);
  const rows: [string, number][] = [
    ['Highest level reached', peak],
    ['Enemies defeated', counters.kills || 0],
    ['Bosses defeated', counters.boss_wins || 0],
    ['Eclipses', eclipses],
    ['Upgrades bought', counters.upgrades_bought || 0],
    ['Taps', counters.taps || 0],
    ['Arcade games played', counters.minigame_played || 0],
    ['Arcade games won', counters.minigame_wins || 0],
    ['Cards absorbed', counters.cards_absorbed || 0],
  ];
  return (
    <Section title="Lifetime" icon={<BarChart2 size={13} className="text-neon" aria-hidden />}>
      <dl className="flex flex-col">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-2 py-1.5 border-b border-line/50 last:border-b-0">
            <dt className="text-[11px] font-tech text-dim">{label}</dt>
            <dd className="text-xs font-mono-code font-bold text-ink">{formatNumber(value)}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
};

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'SETTINGS', label: 'Settings', icon: <SlidersHorizontal size={12} aria-hidden /> },
  { id: 'STATS', label: 'Stats', icon: <BarChart2 size={12} aria-hidden /> },
];

/** Sound, feedback, ad privacy, purchases, save data, and lifetime stats. Rendered only while open. */
export const SettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [tab, setTab] = useState<Tab>('SETTINGS');
  return (
    <Modal open onClose={onClose} title="Settings" icon={<Settings size={14} className="text-neon" aria-hidden />}>
      <div role="tablist" aria-label="Settings sections" className="grid grid-cols-2 border border-line shrink-0">
        {TABS.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(t.id)}
              className={`min-h-[36px] text-[11px] font-display font-bold tracking-wider uppercase flex items-center justify-center gap-1.5 transition-colors ${
                selected ? 'bg-neon text-void' : 'bg-void text-dim hover:text-ink'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={tab === 'SETTINGS' ? 'Settings' : 'Stats'} className="flex flex-col gap-2.5">
        {tab === 'SETTINGS' ? <SettingsTab onClose={onClose} /> : <StatsTab />}
      </div>

      <footer className="flex flex-col items-center gap-0.5 pt-1">
        <a
          href={PRIVACY_URL}
          target="_blank"
          rel="noopener"
          className="min-h-[32px] inline-flex items-center gap-1 text-[10px] font-tech text-dim underline hover:text-neon"
        >
          Privacy policy <ExternalLink size={10} aria-hidden />
        </a>
        <span className="text-[9px] font-mono-code text-faint">{'Version ' + __APP_VERSION__}</span>
      </footer>
    </Modal>
  );
};
