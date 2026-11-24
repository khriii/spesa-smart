import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Minus,
  Plus,
  Send,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CartItem } from '../types/iperal';
import { formatEuro, formatUnitPrice } from '../utils/formatters';
import { ProductImage } from './ProductImage';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  useImageProxy: boolean;
  onUpdateQuantity: (productId: number, delta: number) => void;
  onRemoveItem: (productId: number) => void;
  onClearCart: () => void;
  onSyncCart: () => Promise<{ ok: boolean; message: string }>;
  onNavigateSession: () => void;
  onNavigateHistory: () => void;
}

export function CartDrawer({
  isOpen,
  onClose,
  items,
  useImageProxy,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onSyncCart,
  onNavigateSession,
  onNavigateHistory,
}: CartDrawerProps) {
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalPieces = items.reduce((acc, item) => acc + item.quantity, 0);
  const estimatedTotal = items.reduce(
    (acc, item) => acc + (item.product.price ?? 0) * item.quantity,
    0,
  );

  const handleSync = async () => {
    if (syncing || items.length === 0) return;
    setSyncing(true);
    setFeedback(null);
    const result = await onSyncCart();
    setSyncing(false);
    setFeedback({
      type: result.ok ? 'success' : 'error',
      message: result.message,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[var(--border-subtle)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div>
            <h2
              id="cart-drawer-title"
              className="font-display text-lg font-bold text-[var(--text-primary)]"
            >
              Carrello di preparazione
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {totalPieces === 0
                ? 'Nessun articolo selezionato'
                : `${items.length} prodotti · ${totalPieces} pezzi pronti per l'invio`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi carrello"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {feedback && (
            <div
              role="status"
              className={`mb-4 rounded-xl border p-3.5 text-sm ${
                feedback.type === 'success'
                  ? 'border-[var(--best-value)]/30 bg-[var(--best-value-soft)] text-[var(--best-value)]'
                  : 'border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <div className="flex-1 space-y-2">
                  <p className="font-medium text-[var(--text-primary)]">
                    {feedback.message}
                  </p>
                  {feedback.type === 'success' && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateHistory();
                        }}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                      >
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Vedi Cronologia</span>
                      </button>
                      <a
                        href="https://www.iperalspesaonline.it"
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md bg-[var(--best-value)] px-2.5 py-1 text-xs font-semibold text-white dark:text-slate-950 christmas:text-slate-950"
                      >
                        Apri iperalspesaonline.it
                      </a>
                    </div>
                  )}
                  {feedback.type === 'error' && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateSession();
                      }}
                      className="cursor-pointer rounded-md border border-[var(--danger)]/35 bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--surface-subtle)]"
                    >
                      Verifica cookie di sessione
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[var(--text-muted)]">
                <ShoppingBag className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="font-display text-base font-semibold text-[var(--text-primary)]">
                Il carrello locale è vuoto
              </p>
              <p className="mt-1 max-w-xs text-sm text-[var(--text-muted)]">
                Aggiungi i prodotti dal catalogo o dai preferiti, poi inviali tutti
                insieme al tuo carrello Iperal.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {items.map(({ product, quantity }) => (
                <li key={product.productId} className="py-3.5">
                  <div className="flex gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#F8FAFC]">
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
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {product.brand && (
                            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                              {product.brand}
                            </p>
                          )}
                          <p className="line-clamp-2 text-sm font-semibold text-[var(--text-primary)]">
                            {product.name}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(product.productId)}
                          aria-label={`Rimuovi ${product.name}`}
                          className="cursor-pointer rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--danger)]"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                        {product.packaging && <span>{product.packaging}</span>}
                        {product.packaging && <span aria-hidden="true">·</span>}
                        <span className="font-mono tabular-nums">
                          {formatUnitPrice(product.priceUm, product.unitLabel)}
                        </span>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-3">
                        <div className="inline-flex h-8 items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-1">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(product.productId, -1)}
                            aria-label={`Riduci quantità di ${product.name}`}
                            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[var(--text-primary)] hover:bg-[var(--surface)]"
                          >
                            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <span className="min-w-[1.75rem] text-center font-mono text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(product.productId, 1)}
                            aria-label={`Aumenta quantità di ${product.name}`}
                            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[var(--text-primary)] hover:bg-[var(--surface)]"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>

                        <span className="font-mono text-sm font-bold tabular-nums text-[var(--text-primary)]">
                          {formatEuro(
                            product.price !== null ? product.price * quantity : null,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-5 py-4">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Totale stimato</span>
              <span className="font-mono text-xl font-bold tabular-nums text-[var(--text-primary)]">
                {formatEuro(estimatedTotal)}
              </span>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onClearCart();
                  setFeedback(null);
                }}
                disabled={syncing}
                className="cursor-pointer rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
              >
                Svuota
              </button>

              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-wait disabled:opacity-70"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                <span>
                  {syncing
                    ? 'Invio in corso...'
                    : `Invia tutto a Iperal (${totalPieces})`}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
