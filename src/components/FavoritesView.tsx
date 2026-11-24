import {
  Download,
  Heart,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Upload,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { FavoriteItem, IperalProduct, PriceDiff } from '../types/iperal';
import { formatEuro, formatUnitPrice } from '../utils/formatters';
import { formatShortItalianDate } from '../utils/priceComparison';
import { PriceChangeBadge } from './PriceChangeBadge';
import { ProductImage } from './ProductImage';

interface FavoritesViewProps {
  favorites: FavoriteItem[];
  cartQuantities: Map<number, number>;
  useImageProxy: boolean;
  priceDiffs: Map<number, PriceDiff>;
  onRemoveFavorite: (productId: number) => void;
  onAddToCart: (product: IperalProduct) => void;
  onAddAllToCart: () => void;
  onImportFavorites: (imported: FavoriteItem[]) => void;
  onBrowseCatalog: () => void;
}

export function FavoritesView({
  favorites,
  cartQuantities,
  useImageProxy,
  priceDiffs,
  onRemoveFavorite,
  onAddToCart,
  onAddAllToCart,
  onImportFavorites,
  onBrowseCatalog,
}: FavoritesViewProps) {
  const [query, setQuery] = useState('');
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? favorites.filter(
          (f) =>
            f.product.name.toLowerCase().includes(q) ||
            f.product.brand.toLowerCase().includes(q) ||
            (f.product.categoryName || '').toLowerCase().includes(q),
        )
      : favorites;

    return [...list].sort(
      (a, b) =>
        (a.product.priceUm ?? Number.POSITIVE_INFINITY) -
        (b.product.priceUm ?? Number.POSITIVE_INFINITY),
    );
  }, [favorites, query]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(favorites, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `iperal-preferiti-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) {
        setImportNotice('File non valido: atteso un elenco JSON di preferiti.');
        return;
      }

      const valid = parsed.filter(
        (item): item is FavoriteItem =>
          Boolean(item) &&
          typeof item === 'object' &&
          Boolean((item as FavoriteItem).product) &&
          Number.isInteger((item as FavoriteItem).product.productId),
      );
      onImportFavorites(valid);
      setImportNotice(`Importati ${valid.length} prodotti preferiti.`);
    } catch {
      setImportNotice('Impossibile leggere il file JSON selezionato.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <section className="mx-auto max-w-[1200px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            I tuoi prodotti preferiti
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Ordinati dal più conveniente al kg/litro per riordinare la spesa abituale
            in pochi secondi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)]"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Importa JSON</span>
          </button>

          {favorites.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)]"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Esporta JSON</span>
              </button>
              <button
                type="button"
                onClick={onAddAllToCart}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Aggiungi tutti al carrello</span>
              </button>
            </>
          )}
        </div>
      </div>

      {importNotice && (
        <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text-primary)]">
          {importNotice}
        </p>
      )}

      {favorites.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[var(--text-muted)]">
            <Heart className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            Nessun preferito salvato
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-muted)]">
            Clicca sull&apos;icona cuore su qualsiasi prodotto del catalogo per
            tenerlo sempre a portata di mano insieme al suo ultimo prezzo al kg.
          </p>
          <button
            type="button"
            onClick={onBrowseCatalog}
            className="mt-5 cursor-pointer rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            Esplora il catalogo
          </button>
        </div>
      ) : (
        <>
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtra tra i tuoi preferiti..."
              aria-label="Filtra tra i preferiti"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] py-2.5 pr-4 pl-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map(({ product, lastSeenPriceUm, lastSeenAt, addedAt }) => {
              const inCartQty = cartQuantities.get(product.productId) || 0;
              const diff = priceDiffs.get(product.productId) || null;
              const seenDate = formatShortItalianDate(lastSeenAt || addedAt);

              return (
                <article
                  key={product.productId}
                  className="flex flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4"
                >
                  <div className="flex gap-3.5">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#F8FAFC]">
                      <ProductImage
                        src={product.imageUrl}
                        alt={product.name}
                        useProxy={useImageProxy}
                        thumbWidth={160}
                        className="h-full w-full object-contain p-1.5"
                        fallbackClassName="flex h-full w-full items-center justify-center"
                        iconClassName="h-5 w-5"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                        {product.brand && (
                          <span className="truncate font-medium text-[var(--text-secondary)]">
                            {product.brand}
                          </span>
                        )}
                        {product.brand && product.categoryName && (
                          <span aria-hidden="true">·</span>
                        )}
                        {product.categoryName && (
                          <span className="truncate">{product.categoryName}</span>
                        )}
                      </div>
                      <h3 className="mt-0.5 line-clamp-2 font-display text-sm font-semibold text-[var(--text-primary)]">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">
                          {product.description}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {product.packaging ? `${product.packaging} · ` : ''}Visto{' '}
                        {seenDate}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
                    {diff && (
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <PriceChangeBadge diff={diff} />
                        <span className="text-[11px] text-[var(--text-muted)]">
                          vs {formatShortItalianDate(diff.previousSeenAt)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-end justify-between">
                      <div>
                        <div className="font-mono text-base font-bold tabular-nums text-[var(--text-primary)]">
                          {formatUnitPrice(
                            product.priceUm ?? lastSeenPriceUm,
                            product.unitLabel,
                          )}
                        </div>
                        <div className="font-mono text-xs tabular-nums text-[var(--text-muted)]">
                          Confezione {formatEuro(product.price)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onRemoveFavorite(product.productId)}
                          aria-label={`Rimuovi ${product.name} dai preferiti`}
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--danger)]/40 hover:text-[var(--danger)]"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onAddToCart(product)}
                          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 text-xs font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>
                            {inCartQty > 0 ? `Nel carrello (${inCartQty})` : 'Aggiungi'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
