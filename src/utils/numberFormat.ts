const SUFFIXES = [
  '',
  'K',
  'M',
  'B',
  'T',
  'Qa',
  'Qi',
  'Sx',
  'Sp',
  'Oc',
  'No',
  'Dc',
  'Ud',
  'Dd',
  'Td',
  'Qad',
  'Qid',
  'Sxd',
  'Spd',
  'Ocd',
  'Nod',
  'Vg',
];

export function formatNumber(value: number, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) return '0';
  if (!isFinite(value)) return '∞';
  if (value < 0) return '-' + formatNumber(-value, decimals);
  if (value < 1000) {
    const small = Number.isInteger(value) ? value.toString() : value.toFixed(value < 10 ? 1 : 0);
    // 999.6 rounds to "1000"; let it read "1.00K" like every other four-digit figure.
    if (Number(small) < 1000) return small;
  }

  let tier = Math.max(1, Math.floor(Math.log10(value) / 3));
  let scaled = value / Math.pow(10, tier * 3);
  // Rounding can carry into the next tier (999,999.9 would read "1000.00K"): step up instead.
  if (Number(scaled.toFixed(decimals)) >= 1000) {
    tier += 1;
    scaled /= 1000;
  }
  if (tier >= SUFFIXES.length) {
    return value.toExponential(2);
  }

  return scaled.toFixed(decimals) + SUFFIXES[tier];
}

export function formatPercent(value: number, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  const pct = value * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(decimals)}%`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m`;
}
