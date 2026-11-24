import type { IperalProduct, PriceDiff, PriceSnapshot } from '../types/iperal';
import { formatEuro } from './formatters';

export function computePriceDiff(
  product: IperalProduct,
  baseline: PriceSnapshot | undefined,
): PriceDiff | null {
  if (!baseline) return null;

  const canComparePack =
    product.price !== null &&
    baseline.price !== null &&
    Number.isFinite(product.price) &&
    Number.isFinite(baseline.price);

  const rawPackDelta =
    canComparePack && product.price !== null && baseline.price !== null
      ? product.price - baseline.price
      : null;
  const meaningfulPackDelta =
    rawPackDelta !== null && Math.abs(rawPackDelta) >= 0.005 ? rawPackDelta : null;

  const canCompareUm =
    product.priceUm !== null &&
    baseline.priceUm !== null &&
    Number.isFinite(product.priceUm) &&
    Number.isFinite(baseline.priceUm);

  if (canCompareUm && product.priceUm !== null && baseline.priceUm !== null) {
    const rawDelta = product.priceUm - baseline.priceUm;
    if (Math.abs(rawDelta) < 0.005 && meaningfulPackDelta === null) return null;

    if (Math.abs(rawDelta) >= 0.005) {
      const direction = rawDelta > 0 ? 'up' : 'down';
      const delta = Math.abs(rawDelta);
      const percent =
        baseline.priceUm > 0
          ? Math.round((delta / baseline.priceUm) * 100)
          : null;

      return {
        direction,
        delta,
        percent: percent !== null && percent > 0 ? percent : null,
        previousPrice: baseline.priceUm,
        currentPrice: product.priceUm,
        unitLabel: product.unitLabel || baseline.unitLabel || 'kg',
        previousSeenAt: baseline.seenAt,
        isUnitPrice: true,
        packDelta: meaningfulPackDelta,
        previousPackPrice: canComparePack ? baseline.price : null,
        currentPackPrice: canComparePack ? product.price : null,
      };
    }
  }

  if (
    canComparePack &&
    product.price !== null &&
    baseline.price !== null &&
    meaningfulPackDelta !== null
  ) {
    const direction = meaningfulPackDelta > 0 ? 'up' : 'down';
    const delta = Math.abs(meaningfulPackDelta);
    const percent =
      baseline.price > 0 ? Math.round((delta / baseline.price) * 100) : null;

    return {
      direction,
      delta,
      percent: percent !== null && percent > 0 ? percent : null,
      previousPrice: baseline.price,
      currentPrice: product.price,
      unitLabel: 'conf.',
      previousSeenAt: baseline.seenAt,
      isUnitPrice: false,
      packDelta: meaningfulPackDelta,
      previousPackPrice: baseline.price,
      currentPackPrice: product.price,
    };
  }

  return null;
}

export function formatPriceDiffAmount(diff: PriceDiff): string {
  const sign = diff.direction === 'up' ? '+' : '-';
  const formatted = formatEuro(diff.delta);
  return diff.isUnitPrice ? `${sign}${formatted}/${diff.unitLabel}` : `${sign}${formatted}`;
}

export function formatShortItalianDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return 'ultima visita';
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
    }).format(date);
  } catch {
    return 'ultima visita';
  }
}
