export function formatEuro(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatUnitPrice(
  priceUm: number | null | undefined,
  unitLabel: string,
): string {
  if (priceUm === null || priceUm === undefined || !Number.isFinite(priceUm)) {
    return 'N/D';
  }
  const formatted = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceUm);
  return `${formatted} / ${unitLabel || 'kg'}`;
}

export function computeDiscountPercent(
  price: number | null,
  originalPrice: number | null,
): number | null {
  if (
    price === null ||
    originalPrice === null ||
    !Number.isFinite(price) ||
    !Number.isFinite(originalPrice) ||
    originalPrice <= price ||
    originalPrice <= 0
  ) {
    return null;
  }
  const pct = Math.round(((originalPrice - price) / originalPrice) * 100);
  return pct > 0 ? pct : null;
}
