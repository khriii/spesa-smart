import { Heart, Minus, Plus } from 'lucide-react';
import type { IperalProduct, PriceDiff } from '../types/iperal';
import {
  computeDiscountPercent,
  formatEuro,
  formatUnitPrice,
} from '../utils/formatters';
import { formatShortItalianDate } from '../utils/priceComparison';
import { PriceChangeBadge } from './PriceChangeBadge';
import { ProductImage } from './ProductImage';

interface ProductCardProps {
  product: IperalProduct;
  rankIndex: number;
  isBestValue: boolean;
  isFavorite: boolean;
  cartQuantity: number;
  useImageProxy: boolean;
  priceDiff: PriceDiff | null;
  onToggleFavorite: (product: IperalProduct) => void;
  onAddToCart: (product: IperalProduct) => void;
  onUpdateCartQuantity: (productId: number, delta: number) => void;
}

export function ProductCard({
  product,
  rankIndex,
  isBestValue,
  isFavorite,
  cartQuantity,
  useImageProxy,
  priceDiff,
  onToggleFavorite,
  onAddToCart,
  onUpdateCartQuantity,
}: ProductCardProps) {
  const discountPct =
    product.discountPercent ??
    computeDiscountPercent(product.price, product.originalPrice);

  const savedVsLastLabel =
    priceDiff?.packDelta !== null &&
    priceDiff?.packDelta !== undefined &&
    priceDiff.packDelta < -0.005
      ? `-${formatEuro(Math.abs(priceDiff.packDelta))}`
      : priceDiff?.direction === 'down'
        ? `-${formatEuro(priceDiff.delta)}/${priceDiff.unitLabel}`
        : null;

  const topLeftBadgeText =
    discountPct !== null && savedVsLastLabel
      ? `${savedVsLastLabel} (-${discountPct}%)`
      : savedVsLastLabel && product.isPromo
        ? `${savedVsLastLabel} offerta`
        : discountPct !== null
          ? `-${discountPct}%`
          : product.isPromo
            ? product.promoLabel || 'OFFERTA'
            : null;

  const topLeftBadgeTitle =
    savedVsLastLabel && priceDiff?.previousPackPrice != null
      ? `Rispetto all'ultima visita (${formatEuro(priceDiff.previousPackPrice)}): ${savedVsLastLabel}`
      : discountPct !== null
        ? `Sconto ${discountPct} percento`
        : product.promoLabel || 'Prodotto in offerta';

  return (
    <article className="group flex flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 transition-transform duration-150 hover:-translate-y-0.5 hover:border-[var(--border-strong)]">
      <div>
        <div className="relative mb-3.5 aspect-[4/3] w-full overflow-hidden rounded-lg bg-[#F8FAFC]">
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            useProxy={useImageProxy}
            eager={rankIndex < 35}
            showFallbackTitle
            className="h-full w-full object-contain p-3 transition-transform duration-200 group-hover:scale-[1.03]"
          />

          {topLeftBadgeText && (
            <span
              title={topLeftBadgeTitle}
              aria-label={topLeftBadgeTitle}
              className="absolute top-2.5 left-2.5 max-w-[calc(100%-4rem)] truncate rounded-md bg-[#C8102E] px-2 py-1 font-mono text-xs font-bold tracking-tight text-white tabular-nums shadow-xs"
            >
              {topLeftBadgeText}
            </span>
          )}

          <button
            type="button"
            onClick={() => onToggleFavorite(product)}
            aria-label={
              isFavorite
                ? `Rimuovi ${product.name} dai preferiti`
                : `Aggiungi ${product.name} ai preferiti`
            }
            aria-pressed={isFavorite}
            className={`absolute top-2.5 right-2.5 flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
              isFavorite
                ? 'border-[var(--accent)] bg-[var(--surface)] text-[var(--accent-text)]'
                : 'border-[var(--border-subtle)] bg-[var(--surface)]/95 text-[var(--text-muted)] hover:text-[var(--accent-text)]'
            }`}
          >
            <Heart
              className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>

        {(product.brand || product.packaging) && (
          <div className="mb-1.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            {product.brand && (
              <span className="truncate font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                {product.brand}
              </span>
            )}
            {product.brand && product.packaging && (
              <span aria-hidden="true">·</span>
            )}
            {product.packaging && (
              <span className="truncate">{product.packaging}</span>
            )}
          </div>
        )}

        <h3
          title={product.name}
          className={`line-clamp-2 font-display text-[15px] leading-snug font-semibold text-[var(--text-primary)] ${
            product.description ? 'mb-1' : 'mb-3 min-h-[2.75rem]'
          }`}
        >
          {product.name}
        </h3>

        {product.description && (
          <p
            title={product.description}
            className="mb-3 line-clamp-2 text-xs text-[var(--text-secondary)]"
          >
            {product.description}
          </p>
        )}
      </div>

      <div className="border-t border-[var(--border-subtle)] pt-3">
        {priceDiff && (
          <div className="mb-2 flex items-center justify-between gap-2">
            <PriceChangeBadge diff={priceDiff} />
            <span className="text-[11px] text-[var(--text-muted)]">
              vs {formatShortItalianDate(priceDiff.previousSeenAt)}
            </span>
          </div>
        )}

        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`font-mono text-lg font-bold tracking-tight tabular-nums ${
                  isBestValue
                    ? 'text-[var(--best-value)]'
                    : 'text-[var(--text-primary)]'
                }`}
              >
                {formatUnitPrice(product.priceUm, product.unitLabel)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span>Confezione</span>
              <span className="font-mono text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                {formatEuro(product.price)}
              </span>
              {product.originalPrice !== null && (
                <span className="font-mono text-xs line-through tabular-nums text-[var(--text-muted)]">
                  {formatEuro(product.originalPrice)}
                </span>
              )}
            </div>
          </div>

          <div className="text-right text-xs">
            {isBestValue ? (
              <span className="font-medium text-[var(--best-value)]">
                #{rankIndex + 1} migliore €/kg
              </span>
            ) : discountPct !== null ? (
              <span className="font-semibold text-[var(--accent-text)]">
                {savedVsLastLabel ? `${savedVsLastLabel} (-${discountPct}%)` : `-${discountPct}% offerta`}
              </span>
            ) : product.isPromo ? (
              <span className="font-medium text-[var(--accent-text)]">
                {product.promoLabel || 'In offerta'}
              </span>
            ) : (
              <span className="tabular-nums text-[var(--text-muted)]">
                #{rankIndex + 1}
              </span>
            )}
          </div>
        </div>

        {cartQuantity > 0 ? (
          <div className="flex h-10 items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-1">
            <button
              type="button"
              onClick={() => onUpdateCartQuantity(product.productId, -1)}
              aria-label={`Riduci quantità di ${product.name}`}
              className="flex h-8 w-9 cursor-pointer items-center justify-center rounded-md text-[var(--text-primary)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--accent-text)]"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="font-mono text-sm font-semibold tabular-nums text-[var(--text-primary)]">
              {cartQuantity} nel carrello
            </span>
            <button
              type="button"
              onClick={() => onUpdateCartQuantity(product.productId, 1)}
              aria-label={`Aumenta quantità di ${product.name}`}
              className="flex h-8 w-9 cursor-pointer items-center justify-center rounded-md text-[var(--text-primary)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--accent-text)]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onAddToCart(product)}
            disabled={!product.inStock}
            className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-fg)] transition-colors duration-150 hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{product.inStock ? 'Aggiungi' : 'Non disponibile'}</span>
          </button>
        )}
      </div>
    </article>
  );
}
