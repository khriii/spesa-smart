import { Heart, Minus, Plus } from 'lucide-react';
import type { IperalProduct, PriceDiff } from '../types/iperal';
import {
  computeDiscountPercent,
  formatEuro,
  formatUnitPrice,
} from '../utils/formatters';
import { PriceChangeBadge } from './PriceChangeBadge';
import { ProductImage } from './ProductImage';

interface ProductComparisonTableProps {
  products: IperalProduct[];
  favoriteIds: Set<number>;
  cartQuantities: Map<number, number>;
  useImageProxy: boolean;
  priceDiffs: Map<number, PriceDiff>;
  onToggleFavorite: (product: IperalProduct) => void;
  onAddToCart: (product: IperalProduct) => void;
  onUpdateCartQuantity: (productId: number, delta: number) => void;
}

export function ProductComparisonTable({
  products,
  favoriteIds,
  cartQuantities,
  useImageProxy,
  priceDiffs,
  onToggleFavorite,
  onAddToCart,
  onUpdateCartQuantity,
}: ProductComparisonTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-xs font-semibold text-[var(--text-secondary)]">
              <th className="px-4 py-3 text-center">#</th>
              <th className="px-4 py-3">Prodotto</th>
              <th className="px-4 py-3">Formato</th>
              <th className="px-4 py-3 text-right">Confezione</th>
              <th className="px-4 py-3 text-right text-[var(--text-primary)]">
                Prezzo €/kg · L
              </th>
              <th className="px-4 py-3 text-center">Preferito</th>
              <th className="px-4 py-3 text-right">Carrello</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {products.map((product, idx) => {
              const isFav = favoriteIds.has(product.productId);
              const qty = cartQuantities.get(product.productId) || 0;
              const isTopThree = idx < 3 && product.priceUm !== null;
              const diff = priceDiffs.get(product.productId) || null;
              const discountPct =
                product.discountPercent ??
                computeDiscountPercent(product.price, product.originalPrice);
              const savedVsLastLabel =
                diff?.packDelta !== null &&
                diff?.packDelta !== undefined &&
                diff.packDelta < -0.005
                  ? `-${formatEuro(Math.abs(diff.packDelta))}`
                  : null;

              return (
                <tr
                  key={product.productId}
                  className="transition-colors duration-100 hover:bg-[var(--surface-subtle)]/60"
                >
                  <td className="px-4 py-3 text-center font-mono text-xs tabular-nums text-[var(--text-muted)]">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-[#F8FAFC]">
                        <ProductImage
                          src={product.imageUrl}
                          alt={product.name}
                          useProxy={useImageProxy}
                          eager={idx < 35}
                          thumbWidth={140}
                          className="h-full w-full object-contain p-1"
                          fallbackClassName="flex h-full w-full items-center justify-center"
                          iconClassName="h-4 w-4"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                          {product.brand && (
                            <span className="font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                              {product.brand}
                            </span>
                          )}
                          {product.brand && (discountPct !== null || product.isPromo) && (
                            <span aria-hidden="true">·</span>
                          )}
                          {discountPct !== null ? (
                            <span className="font-mono font-semibold text-[var(--danger)]">
                              {savedVsLastLabel
                                ? `${savedVsLastLabel} (-${discountPct}%)`
                                : `-${discountPct}%`}
                            </span>
                          ) : (
                            product.isPromo && (
                              <span className="font-medium text-[var(--accent-text)]">
                                {savedVsLastLabel
                                  ? `${savedVsLastLabel} offerta`
                                  : product.promoLabel || 'In offerta'}
                              </span>
                            )
                          )}
                        </div>
                        <p className="line-clamp-1 font-medium text-[var(--text-primary)]">
                          {product.name}
                        </p>
                        {product.description && (
                          <p className="line-clamp-1 text-xs text-[var(--text-muted)]">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                    {product.packaging || product.description || '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-[var(--text-secondary)]">
                    {formatEuro(product.price)}
                    {product.originalPrice !== null && (
                      <div className="text-xs line-through text-[var(--text-muted)]">
                        {formatEuro(product.originalPrice)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-bold tabular-nums">
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={
                          isTopThree
                            ? 'text-[var(--best-value)]'
                            : 'text-[var(--text-primary)]'
                        }
                      >
                        {formatUnitPrice(product.priceUm, product.unitLabel)}
                      </span>
                      {diff && <PriceChangeBadge diff={diff} compact />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(product)}
                      aria-label={
                        isFav
                          ? `Rimuovi ${product.name} dai preferiti`
                          : `Aggiungi ${product.name} ai preferiti`
                      }
                      className={`inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border transition-colors ${
                        isFav
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                          : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--accent-text)]'
                      }`}
                    >
                      <Heart
                        className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {qty > 0 ? (
                      <div className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-1">
                        <button
                          type="button"
                          onClick={() => onUpdateCartQuantity(product.productId, -1)}
                          aria-label={`Riduci quantità di ${product.name}`}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-[var(--text-primary)] hover:bg-[var(--surface)] hover:text-[var(--accent-text)]"
                        >
                          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <span className="min-w-[1.5rem] text-center font-mono text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateCartQuantity(product.productId, 1)}
                          aria-label={`Aumenta quantità di ${product.name}`}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-[var(--text-primary)] hover:bg-[var(--surface)] hover:text-[var(--accent-text)]"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAddToCart(product)}
                        disabled={!product.inStock}
                        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Aggiungi</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
