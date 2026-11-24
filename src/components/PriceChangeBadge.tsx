import { ArrowDown, ArrowUp } from 'lucide-react';
import type { PriceDiff } from '../types/iperal';
import { formatEuro } from '../utils/formatters';
import {
  formatPriceDiffAmount,
  formatShortItalianDate,
} from '../utils/priceComparison';

interface PriceChangeBadgeProps {
  diff: PriceDiff;
  compact?: boolean;
}

export function PriceChangeBadge({ diff, compact = false }: PriceChangeBadgeProps) {
  const isUp = diff.direction === 'up';
  const amountLabel = formatPriceDiffAmount(diff);
  const previousFormatted = diff.isUnitPrice
    ? `${formatEuro(diff.previousPrice)}/${diff.unitLabel}`
    : formatEuro(diff.previousPrice);
  const dateLabel = formatShortItalianDate(diff.previousSeenAt);

  const tooltip = isUp
    ? `Prezzo aumentato rispetto all'ultima visita (${dateLabel}): era ${previousFormatted}`
    : `Prezzo diminuito rispetto all'ultima visita (${dateLabel}): era ${previousFormatted}`;

  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${
        isUp
          ? 'border-[var(--price-up)]/30 bg-[var(--price-up-soft)] text-[var(--price-up)]'
          : 'border-[var(--price-down)]/30 bg-[var(--price-down-soft)] text-[var(--price-down)]'
      }`}
    >
      {isUp ? (
        <ArrowUp className="h-3 w-3 shrink-0 stroke-[2.5]" aria-hidden="true" />
      ) : (
        <ArrowDown className="h-3 w-3 shrink-0 stroke-[2.5]" aria-hidden="true" />
      )}
      <span>{amountLabel}</span>
      {!compact && diff.percent !== null && (
        <span className="opacity-80">({isUp ? `+${diff.percent}%` : `-${diff.percent}%`})</span>
      )}
    </span>
  );
}
