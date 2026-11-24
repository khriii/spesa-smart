import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  RotateCcw,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { OrderHistoryEntry } from '../types/iperal';
import { formatEuro, formatUnitPrice } from '../utils/formatters';
import { ProductImage } from './ProductImage';

interface OrderHistoryViewProps {
  orders: OrderHistoryEntry[];
  currentCartPieces: number;
  useImageProxy: boolean;
  onApplyOrder: (order: OrderHistoryEntry, mode: 'merge' | 'replace') => void;
  onBrowseCatalog: () => void;
}

type ModalState =
  | {
      order: OrderHistoryEntry;
      step: 'choose' | 'confirm-merge' | 'confirm-replace-1' | 'confirm-replace-2';
    }
  | null;

function formatOrderDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function OrderHistoryView({
  orders,
  currentCartPieces,
  useImageProxy,
  onApplyOrder,
  onBrowseCatalog,
}: OrderHistoryViewProps) {
  const [modalState, setModalState] = useState<ModalState>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleConfirm = (order: OrderHistoryEntry, mode: 'merge' | 'replace') => {
    onApplyOrder(order, mode);
    setModalState(null);
    setNotice(
      mode === 'replace'
        ? `Carrello attuale sostituito con l'ordine del ${formatOrderDate(order.createdAt)}.`
        : `${order.totalPieces} articoli dell'ordine aggiunti al carrello attuale.`,
    );
  };

  return (
    <section className="mx-auto max-w-[1200px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Cronologia ultimi 6 ordini
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Rivedi gli ultimi 6 ordini inviati a Iperal e ricaricali nel carrello
            aggiungendoli o sostituendo quello attuale.
          </p>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--best-value)]/30 bg-[var(--best-value-soft)] px-4 py-3 text-sm text-[var(--best-value)]"
        >
          <div className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--best-value)]" aria-hidden="true" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Chiudi avviso"
            className="cursor-pointer rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[var(--text-muted)]">
            <Clock className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            Nessun ordine in cronologia
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-muted)]">
            Appena invii un carrello a Iperal tramite il pulsante &ldquo;Invia tutto a
            Iperal&rdquo;, verrà salvato automaticamente qui (fino agli ultimi 6
            ordini).
          </p>
          <button
            type="button"
            onClick={onBrowseCatalog}
            className="mt-5 cursor-pointer rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            Vai al catalogo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order, idx) => (
            <article
              key={order.id}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span className="font-mono font-semibold text-[var(--accent-text)]">
                      Ordine #{orders.length - idx}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatOrderDate(order.createdAt)}</span>
                  </div>
                  <p className="mt-1 font-display text-base font-bold text-[var(--text-primary)]">
                    {order.items.length} prodotti ·{' '}
                    <span className="tabular-nums">{order.totalPieces} pezzi</span> ·{' '}
                    <span className="font-mono tabular-nums">
                      {formatEuro(order.estimatedTotal)}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalState({ order, step: 'confirm-merge' })}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)]"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Aggiungi al carrello attuale</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setModalState({ order, step: 'confirm-replace-1' })
                    }
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Imposta come ordine attuale</span>
                  </button>
                </div>
              </div>

              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {order.items.map(({ product, quantity }) => (
                  <li
                    key={product.productId}
                    className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/50 p-2.5"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[#F8FAFC]">
                      <ProductImage
                        src={product.imageUrl}
                        alt={product.name}
                        useProxy={useImageProxy}
                        thumbWidth={140}
                        className="h-full w-full object-contain p-1"
                        fallbackClassName="flex h-full w-full items-center justify-center"
                        iconClassName="h-4 w-4"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      {product.brand && (
                        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                          {product.brand}
                        </p>
                      )}
                      <p className="line-clamp-1 text-xs font-semibold text-[var(--text-primary)]">
                        {product.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                        {quantity}× · {formatEuro(product.price)} ·{' '}
                        {formatUnitPrice(product.priceUm, product.unitLabel)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}

      {modalState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {modalState.step === 'confirm-merge' ? (
                  <ShoppingBag
                    className="h-5 w-5 shrink-0 text-[var(--accent-text)]"
                    aria-hidden="true"
                  />
                ) : (
                  <AlertTriangle
                    className="h-5 w-5 shrink-0 text-[var(--danger)]"
                    aria-hidden="true"
                  />
                )}
                <h2
                  id="history-modal-title"
                  className="font-display text-lg font-bold text-[var(--text-primary)]"
                >
                  {modalState.step === 'confirm-merge'
                    ? 'Aggiungere al carrello attuale?'
                    : modalState.step === 'confirm-replace-1'
                      ? 'Sostituire il carrello attuale?'
                      : 'Seconda conferma richiesta'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalState(null)}
                aria-label="Chiudi finestra conferma"
                className="cursor-pointer rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {modalState.step === 'confirm-merge' && (
              <>
                <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                  I{' '}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {modalState.order.totalPieces} articoli
                  </span>{' '}
                  dell&apos;ordine del{' '}
                  <span className="font-medium text-[var(--text-primary)]">
                    {formatOrderDate(modalState.order.createdAt)}
                  </span>{' '}
                  verranno sommati al tuo carrello attuale ({currentCartPieces} pezzi).
                </p>
                <div className="mt-5 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setModalState(null)}
                    className="cursor-pointer rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirm(modalState.order, 'merge')}
                    className="cursor-pointer rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
                  >
                    Conferma aggiunta
                  </button>
                </div>
              </>
            )}

            {modalState.step === 'confirm-replace-1' && (
              <>
                <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {currentCartPieces > 0
                    ? `Attenzione: hai attualmente ${currentCartPieces} articoli nel carrello di preparazione. Scegliendo di sostituirlo, tutti gli articoli attuali verranno cancellati.`
                    : 'Vuoi impostare questo ordine storico come nuovo carrello attuale?'}
                </p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalState(null)}
                    className="cursor-pointer rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                  >
                    Annulla
                  </button>
                  {currentCartPieces > 0 && (
                    <button
                      type="button"
                      onClick={() => handleConfirm(modalState.order, 'merge')}
                      className="cursor-pointer rounded-lg border border-[var(--border-strong)] bg-[var(--surface-subtle)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                    >
                      Aggiungi invece sopra
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setModalState({
                        order: modalState.order,
                        step: 'confirm-replace-2',
                      })
                    }
                    className="cursor-pointer rounded-lg bg-[var(--danger)] px-3.5 py-2 text-xs font-semibold text-white dark:text-slate-950 christmas:text-slate-950 hover:opacity-90"
                  >
                    Cancella attuale e continua
                  </button>
                </div>
              </>
            )}

            {modalState.step === 'confirm-replace-2' && (
              <>
                <div className="mt-3 rounded-lg border border-[var(--danger)]/35 bg-[var(--danger-soft)] p-3 text-sm text-[var(--text-primary)]">
                  Conferma definitiva: il carrello attuale ({currentCartPieces} pezzi)
                  sarà azzerato e sostituito con{' '}
                  <span className="font-semibold">
                    {modalState.order.items.length} prodotti
                  </span>{' '}
                  ({formatEuro(modalState.order.estimatedTotal)}).
                </div>
                <div className="mt-5 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setModalState(null)}
                    className="cursor-pointer rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                  >
                    No, mantieni carrello
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirm(modalState.order, 'replace')}
                    className="cursor-pointer rounded-lg bg-[var(--danger)] px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 christmas:text-slate-950 hover:opacity-90"
                  >
                    Sì, sostituisci definitivamente
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
