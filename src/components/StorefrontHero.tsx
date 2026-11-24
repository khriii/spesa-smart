import { ArrowRight, KeyRound, ShoppingBasket } from 'lucide-react';
import { useState } from 'react';

interface StorefrontHeroProps {
  authenticated: boolean;
  hasCategories: boolean;
  onConfigureSession: () => void;
  onSelectFirstCategory: () => void;
}

export function StorefrontHero({
  authenticated,
  hasCategories,
  onConfigureSession,
  onSelectFirstCategory,
}: StorefrontHeroProps) {
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]">
      <div className="grid grid-cols-1 items-stretch lg:grid-cols-12">
        <div className="flex flex-col justify-between p-6 sm:p-8 lg:col-span-6 lg:p-10">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[var(--accent-text)]">
              Spesa Smart · Confronto Prezzo Unitario
            </p>
            <h1 className="mt-2 font-display text-3xl leading-tight font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              Confronta ogni prodotto dal prezzo al chilo più basso.
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
              Scarica interi reparti senza limiti di pagina, ordina automaticamente per
              convenienza reale al kg o al litro, salva i tuoi preferiti e invia il
              carrello in un solo blocco al tuo account Iperal.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {authenticated ? (
              <button
                type="button"
                onClick={onSelectFirstCategory}
                disabled={!hasCategories}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>Apri primo reparto</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onConfigureSession}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                <span>Collega sessione Iperal</span>
              </button>
            )}
          </div>
        </div>

        <div className="relative min-h-[240px] bg-[var(--surface-subtle)] lg:col-span-6 lg:min-h-[340px]">
          {heroImgFailed ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[var(--surface-subtle)] to-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
              <ShoppingBasket className="h-12 w-12 text-[var(--accent-text)]" aria-hidden="true" />
              <p className="font-display text-sm font-semibold text-[var(--text-primary)]">
                Catalogo fresco Spesa Smart
              </p>
            </div>
          ) : (
            <img
              src="/src/assets/images/hero_iperal_market_1795445397842.jpg"
              alt="Prodotti freschi della spesa italiana su piano in travertino"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="h-full w-full object-cover"
            />
          )}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent lg:bg-gradient-to-r lg:from-black/15 lg:via-transparent"
          />
        </div>
      </div>
    </section>
  );
}
