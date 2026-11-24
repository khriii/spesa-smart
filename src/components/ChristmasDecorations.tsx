import type { CSSProperties } from 'react';

interface SnowflakeSpec {
  id: number;
  leftPct: number;
  sizePx: number;
  durationSec: number;
  delaySec: number;
  opacity: number;
  swayPx: number;
  crystalline: boolean;
}

const SNOWFLAKES: SnowflakeSpec[] = [
  { id: 1, leftPct: 3, sizePx: 14, durationSec: 14, delaySec: -4, opacity: 0.55, swayPx: 18, crystalline: true },
  { id: 2, leftPct: 7, sizePx: 6, durationSec: 19, delaySec: -11, opacity: 0.42, swayPx: -12, crystalline: false },
  { id: 3, leftPct: 11, sizePx: 12, durationSec: 16, delaySec: -2, opacity: 0.48, swayPx: 14, crystalline: true },
  { id: 4, leftPct: 15, sizePx: 5, durationSec: 21, delaySec: -15, opacity: 0.36, swayPx: -16, crystalline: false },
  { id: 5, leftPct: 19, sizePx: 15, durationSec: 13, delaySec: -7, opacity: 0.58, swayPx: 20, crystalline: true },
  { id: 6, leftPct: 24, sizePx: 7, durationSec: 18, delaySec: -13, opacity: 0.44, swayPx: -14, crystalline: false },
  { id: 7, leftPct: 28, sizePx: 11, durationSec: 15, delaySec: -5, opacity: 0.46, swayPx: 16, crystalline: true },
  { id: 8, leftPct: 33, sizePx: 5, durationSec: 22, delaySec: -18, opacity: 0.34, swayPx: -10, crystalline: false },
  { id: 9, leftPct: 37, sizePx: 14, durationSec: 14.5, delaySec: -9, opacity: 0.52, swayPx: 19, crystalline: true },
  { id: 10, leftPct: 42, sizePx: 6, durationSec: 20, delaySec: -3, opacity: 0.4, swayPx: -15, crystalline: false },
  { id: 11, leftPct: 46, sizePx: 13, durationSec: 16.5, delaySec: -12, opacity: 0.5, swayPx: 12, crystalline: true },
  { id: 12, leftPct: 51, sizePx: 7, durationSec: 18.5, delaySec: -6, opacity: 0.42, swayPx: -18, crystalline: false },
  { id: 13, leftPct: 55, sizePx: 15, durationSec: 13.5, delaySec: -14, opacity: 0.56, swayPx: 15, crystalline: true },
  { id: 14, leftPct: 60, sizePx: 5, durationSec: 21.5, delaySec: -8, opacity: 0.35, swayPx: -12, crystalline: false },
  { id: 15, leftPct: 64, sizePx: 12, durationSec: 15.5, delaySec: -1, opacity: 0.48, swayPx: 17, crystalline: true },
  { id: 16, leftPct: 69, sizePx: 6, durationSec: 19.5, delaySec: -16, opacity: 0.4, swayPx: -14, crystalline: false },
  { id: 17, leftPct: 73, sizePx: 14, durationSec: 14.2, delaySec: -10, opacity: 0.54, swayPx: 16, crystalline: true },
  { id: 18, leftPct: 78, sizePx: 7, durationSec: 17.5, delaySec: -4, opacity: 0.45, swayPx: -16, crystalline: false },
  { id: 19, leftPct: 82, sizePx: 13, durationSec: 16.2, delaySec: -13, opacity: 0.5, swayPx: 14, crystalline: true },
  { id: 20, leftPct: 86, sizePx: 5, durationSec: 20.5, delaySec: -7, opacity: 0.38, swayPx: -11, crystalline: false },
  { id: 21, leftPct: 91, sizePx: 15, durationSec: 13.8, delaySec: -17, opacity: 0.56, swayPx: -18, crystalline: true },
  { id: 22, leftPct: 95, sizePx: 6, durationSec: 19, delaySec: -9, opacity: 0.42, swayPx: -13, crystalline: false },
  { id: 23, leftPct: 9, sizePx: 8, durationSec: 17, delaySec: -15, opacity: 0.38, swayPx: 11, crystalline: false },
  { id: 24, leftPct: 26, sizePx: 10, durationSec: 18, delaySec: -1, opacity: 0.42, swayPx: -13, crystalline: true },
  { id: 25, leftPct: 48, sizePx: 9, durationSec: 17.5, delaySec: -11, opacity: 0.36, swayPx: 13, crystalline: false },
  { id: 26, leftPct: 67, sizePx: 11, durationSec: 16.8, delaySec: -5, opacity: 0.46, swayPx: -15, crystalline: true },
  { id: 27, leftPct: 88, sizePx: 10, durationSec: 18.2, delaySec: -2, opacity: 0.44, swayPx: -14, crystalline: true },
  { id: 28, leftPct: 58, sizePx: 6, durationSec: 22.5, delaySec: -19, opacity: 0.32, swayPx: 10, crystalline: false },
];

const DARK_BULB_PALETTE = [
  { color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.78)' },
  { color: '#fb7185', glow: 'rgba(251, 113, 133, 0.75)' },
  { color: '#34d399', glow: 'rgba(52, 211, 153, 0.72)' },
  { color: '#7dd3fc', glow: 'rgba(125, 211, 252, 0.75)' },
];

const LIGHT_BULB_PALETTE = [
  { color: '#d97706', glow: 'rgba(245, 158, 11, 0.65)' },
  { color: '#dc2626', glow: 'rgba(220, 38, 38, 0.6)' },
  { color: '#15803d', glow: 'rgba(22, 163, 74, 0.6)' },
  { color: '#0284c7', glow: 'rgba(14, 165, 233, 0.6)' },
];

interface ChristmasDecorationProps {
  variant?: 'dark' | 'light';
}

export function ChristmasSnowfall({ variant = 'dark' }: ChristmasDecorationProps) {
  const isLight = variant === 'light';

  return (
    <div
      aria-hidden="true"
      className="christmas-snow-layer pointer-events-none fixed inset-0 z-40 overflow-hidden select-none"
    >
      {SNOWFLAKES.map((flake) => {
        const outerStyle = {
          left: `${flake.leftPct}%`,
          width: `${flake.sizePx}px`,
          height: `${flake.sizePx}px`,
          opacity: isLight ? Math.min(0.68, flake.opacity + 0.1) : flake.opacity,
          '--fall-duration': `${flake.durationSec}s`,
          '--fall-delay': `${flake.delaySec}s`,
          '--sway-x': `${flake.swayPx}px`,
        } as CSSProperties;

        return (
          <div key={flake.id} className="christmas-snowflake" style={outerStyle}>
            {flake.crystalline ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                className={
                  isLight
                    ? 'h-full w-full text-sky-500/80 drop-shadow-[0_1px_3px_rgba(14,165,233,0.3)]'
                    : 'h-full w-full text-sky-50/90 drop-shadow-[0_0_4px_rgba(224,242,254,0.45)]'
                }
              >
                <path d="M12 2v20M4.93 7l14.14 10M19.07 7L4.93 17" />
                <path d="M9.5 4.2 12 6.5l2.5-2.3M9.5 19.8 12 17.5l2.5 2.3" />
                <path d="m6.2 10.2 1.8-2.9-3.1-.8M17.8 13.8l-1.8 2.9 3.1.8" />
                <path d="m17.8 10.2-1.8-2.9 3.1-.8M6.2 13.8l1.8 2.9-3.1.8" />
              </svg>
            ) : (
              <span
                className={
                  isLight
                    ? 'block h-full w-full rounded-full bg-sky-400/65 shadow-[0_0_5px_rgba(56,189,248,0.45)]'
                    : 'block h-full w-full rounded-full bg-white/90 shadow-[0_0_6px_rgba(255,255,255,0.65)]'
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ChristmasLightsBar({ variant = 'dark' }: ChristmasDecorationProps) {
  const isLight = variant === 'light';
  const paletteSource = isLight ? LIGHT_BULB_PALETTE : DARK_BULB_PALETTE;

  return (
    <div
      aria-hidden="true"
      className="christmas-lights-bar pointer-events-none relative h-4 w-full overflow-x-clip overflow-y-visible select-none"
    >
      <svg
        viewBox="0 0 1440 16"
        preserveAspectRatio="none"
        className={`absolute inset-x-0 top-0 h-3 w-full ${
          isLight ? 'text-[#5b856f]' : 'text-[#274d3c]'
        }`}
      >
        <path
          d="M0,1 Q36,10 72,1 T144,1 T216,1 T288,1 T360,1 T432,1 T504,1 T576,1 T648,1 T720,1 T792,1 T864,1 T936,1 T1008,1 T1080,1 T1152,1 T1224,1 T1296,1 T1368,1 T1440,1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeOpacity="0.85"
        />
      </svg>

      {Array.from({ length: 28 }, (_, idx) => {
        const palette = paletteSource[idx % paletteSource.length];
        const group = idx % 3;
        const style = {
          left: `${((idx + 0.5) / 28) * 100}%`,
          top: `${idx % 2 === 0 ? 5 : 8}px`,
          backgroundColor: palette.color,
          boxShadow: `0 0 8px 2px ${palette.glow}`,
          '--twinkle-delay': `${(idx % 5) * 0.65}s`,
          '--twinkle-duration': `${3.2 + (idx % 3) * 0.7}s`,
        } as CSSProperties;

        return (
          <span
            key={idx}
            style={style}
            className={`christmas-bulb ${
              group === 0
                ? 'christmas-bulb-a'
                : group === 1
                  ? 'christmas-bulb-b'
                  : 'christmas-bulb-c'
            }`}
          />
        );
      })}
    </div>
  );
}
