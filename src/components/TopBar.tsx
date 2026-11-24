import {
  Check,
  ChevronDown,
  Moon,
  Settings,
  ShoppingBag,
  Snowflake,
  Sun,
  Trees,
  User,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AccentColor, ActiveTab, ThemeMode } from '../types/iperal';
import { ChristmasLightsBar } from './ChristmasDecorations';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  cartCount: number;
  favoritesCount: number;
  historyCount: number;
  onOpenCart: () => void;
  profileName: string;
  authenticated: boolean;
  theme: ThemeMode;
  onChangeTheme: (theme: ThemeMode) => void;
  accentColor: AccentColor;
  onChangeAccentColor: (color: AccentColor) => void;
}

const ACCENT_OPTIONS: Array<{
  id: AccentColor;
  label: string;
  swatch: string;
}> = [
  { id: 'crimson', label: 'Rosso', swatch: '#C8102E' },
  { id: 'cobalt', label: 'Blu', swatch: '#2563EB' },
  { id: 'emerald', label: 'Verde', swatch: '#15803D' },
  { id: 'amber', label: 'Ambra', swatch: '#B45309' },
];

const THEME_OPTIONS: Array<{
  id: ThemeMode;
  label: string;
  Icon: typeof Sun;
}> = [
  { id: 'light', label: 'Chiaro', Icon: Sun },
  { id: 'dark', label: 'Scuro', Icon: Moon },
  { id: 'christmas-light', label: 'Natale chiaro', Icon: Snowflake },
  { id: 'christmas', label: 'Natale scuro', Icon: Trees },
];

export function TopBar({
  activeTab,
  onSelectTab,
  cartCount,
  favoritesCount,
  historyCount,
  onOpenCart,
  profileName,
  authenticated,
  theme,
  onChangeTheme,
  accentColor,
  onChangeAccentColor,
}: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'catalog', label: 'Catalogo' },
    {
      id: 'favorites',
      label: favoritesCount > 0 ? `Preferiti (${favoritesCount})` : 'Preferiti',
    },
    {
      id: 'history',
      label: historyCount > 0 ? `Cronologia (${historyCount})` : 'Cronologia',
    },
  ];

  const displayName = profileName.trim() || 'Profilo';

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--header-bg)] backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:gap-8 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => onSelectTab('catalog')}
          className="cursor-pointer whitespace-nowrap shrink-0 text-left font-display text-lg font-bold tracking-tight text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Spesa Smart
        </button>

        <nav
          aria-label="Navigazione principale"
          className="hidden md:flex items-center gap-7"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`cursor-pointer whitespace-nowrap shrink-0 border-b-2 py-1 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] ${
                  isActive
                    ? 'border-[var(--accent)] text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-semibold text-[var(--accent-fg)] transition-colors duration-150 hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            <span className="tabular-nums">Carrello ({cartCount})</span>
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Menu profilo, impostazioni e temi"
              className="inline-flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)]">
                <User className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="hidden max-w-[120px] truncate sm:inline">
                {displayName}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-150 ${
                  menuOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {menuOpen && (
              <div
                role="menu"
                aria-label="Menu profilo e aspetto"
                className="absolute right-0 mt-2 w-72 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-xl"
              >
                <div className="border-b border-[var(--border-subtle)] px-2 pb-2.5">
                  <p className="truncate font-display text-sm font-semibold text-[var(--text-primary)]">
                    {displayName}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {authenticated
                      ? 'Sessione Iperal attiva'
                      : 'Sessione non configurata'}
                  </p>
                </div>

                <div className="py-2">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onSelectTab('session');
                    }}
                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors ${
                      activeTab === 'session'
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                        : 'text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]'
                    }`}
                  >
                    <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Impostazioni e sessione</span>
                  </button>
                </div>

                <div className="border-t border-[var(--border-subtle)] pt-3 pb-2.5">
                  <p className="mb-2 px-1 text-xs font-semibold text-[var(--text-secondary)]">
                    Tema interfaccia
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-[var(--surface-subtle)] p-1">
                    {THEME_OPTIONS.map(({ id, label, Icon }) => {
                      const active = theme === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => onChangeTheme(id)}
                          aria-pressed={active}
                          className={`flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                            active
                              ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-[var(--border-subtle)] pt-3">
                  <p className="mb-2 px-1 text-xs font-semibold text-[var(--text-secondary)]">
                    Colore accento
                  </p>
                  <div className="grid grid-cols-4 gap-2 px-1">
                    {ACCENT_OPTIONS.map((option) => {
                      const active = accentColor === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => onChangeAccentColor(option.id)}
                          aria-label={`Colore accento ${option.label}`}
                          aria-pressed={active}
                          title={option.label}
                          className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-1.5 text-[11px] font-medium transition-colors ${
                            active
                              ? 'border-[var(--text-primary)] bg-[var(--surface-subtle)] text-[var(--text-primary)]'
                              : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]'
                          }`}
                        >
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                            style={{ backgroundColor: option.swatch }}
                          >
                            {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                          </span>
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <nav
        aria-label="Navigazione mobile"
        className="flex items-center justify-between gap-2 overflow-x-auto border-t border-[var(--border-subtle)] px-4 py-2 md:hidden"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {(theme === 'christmas' || theme === 'christmas-light') && (
        <div className="pointer-events-none absolute inset-x-0 -bottom-4">
          <ChristmasLightsBar variant={theme === 'christmas-light' ? 'light' : 'dark'} />
        </div>
      )}
    </header>
  );
}
