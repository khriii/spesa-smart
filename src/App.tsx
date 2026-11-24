import {
  AlertCircle,
  LayoutGrid,
  RefreshCw,
  Search,
  TableProperties,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CartDrawer } from './components/CartDrawer';
import { CategorySidebar } from './components/CategorySidebar';
import { ChristmasSnowfall } from './components/ChristmasDecorations';
import { FavoritesView } from './components/FavoritesView';
import { OrderHistoryView } from './components/OrderHistoryView';
import { ProductCard } from './components/ProductCard';
import { ProductComparisonTable } from './components/ProductComparisonTable';
import { SessionView } from './components/SessionView';
import { StorefrontHero } from './components/StorefrontHero';
import { TopBar } from './components/TopBar';
import {
  clearSessionCredentials,
  fetchCategoriesTree,
  fetchProductsByCategory,
  getSessionStatus,
  saveSessionCredentials,
  syncCartToIperal,
  verifyLiveIperalSession,
} from './services/api';
import type {
  AccentColor,
  ActiveTab,
  CartItem,
  CategoryNode,
  ConnectionSettings,
  FavoriteItem,
  IperalProduct,
  OrderHistoryEntry,
  PriceDiff,
  PriceHistoryRecord,
  PriceSnapshot,
  SessionStatus,
  SortOption,
  ThemeMode,
  ViewMode,
} from './types/iperal';
import { computePriceDiff } from './utils/priceComparison';
import {
  normalizeSearchText,
  sortNormalizedProducts,
} from './utils/productNormalizer';

const FAVORITES_STORAGE_KEY = 'iperal_smart_favorites_v1';
const PRICE_HISTORY_STORAGE_KEY = 'iperal_smart_price_history_v1';
const CART_STORAGE_KEY = 'iperal_smart_cart_v1';
const ORDER_HISTORY_STORAGE_KEY = 'iperal_smart_order_history_v1';
const CONNECTION_STORAGE_KEY = 'iperal_smart_connection_v1';
const THEME_STORAGE_KEY = 'iperal_smart_theme_v1';
const ACCENT_STORAGE_KEY = 'iperal_smart_accent_v1';
const PROFILE_NAME_STORAGE_KEY = 'iperal_smart_profile_name_v1';
const MAX_PRICE_HISTORY_ENTRIES = 5000;
const MAX_ORDER_HISTORY = 6;
const RENDER_CHUNK_SIZE = 48;

function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readStoredString(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function getLocalDayKey(dateOrIso: Date | string): string {
  try {
    const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return '';
  }
}

function isPriceSnapshot(val: unknown): val is PriceSnapshot {
  return (
    Boolean(val) &&
    typeof val === 'object' &&
    'seenAt' in (val as Record<string, unknown>) &&
    ('priceUm' in (val as Record<string, unknown>) ||
      'price' in (val as Record<string, unknown>))
  );
}

function normalizeStoredPriceRecord(raw: unknown): PriceHistoryRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if ('latest' in rec && isPriceSnapshot(rec.latest)) {
    return {
      latest: rec.latest,
      prevDay: isPriceSnapshot(rec.prevDay) ? rec.prevDay : undefined,
    };
  }
  if (isPriceSnapshot(raw)) {
    return { latest: raw };
  }
  return null;
}

function buildPreviousVisitBaseline(): Map<number, PriceSnapshot> {
  const baseline = new Map<number, PriceSnapshot>();
  const todayKey = getLocalDayKey(new Date());

  const storedHistory = readStoredJson<Record<string, unknown>>(
    PRICE_HISTORY_STORAGE_KEY,
    {},
  );

  for (const [idStr, rawEntry] of Object.entries(storedHistory)) {
    const pid = Number(idStr);
    if (!Number.isInteger(pid) || pid <= 0) continue;
    const record = normalizeStoredPriceRecord(rawEntry);
    if (!record) continue;

    const latestDay = getLocalDayKey(record.latest.seenAt);
    if (latestDay && latestDay < todayKey) {
      baseline.set(pid, record.latest);
    } else if (record.prevDay) {
      const prevDayKey = getLocalDayKey(record.prevDay.seenAt);
      if (!prevDayKey || prevDayKey < todayKey) {
        baseline.set(pid, record.prevDay);
      }
    }
  }

  const storedOrders = readStoredJson<OrderHistoryEntry[]>(
    ORDER_HISTORY_STORAGE_KEY,
    [],
  );
  // Iterate newest -> oldest so most recent previous-day order takes precedence as fallback
  for (const order of storedOrders) {
    if (!order?.items) continue;
    const orderDay = getLocalDayKey(order.createdAt);
    if (orderDay && orderDay >= todayKey) continue;
    for (const item of order.items) {
      const p = item?.product;
      if (!p?.productId) continue;
      if (p.priceUm === null && p.price === null) continue;
      if (!baseline.has(p.productId)) {
        baseline.set(p.productId, {
          priceUm: p.priceUm,
          price: p.price,
          unitLabel: p.unitLabel || 'kg',
          seenAt: order.createdAt,
        });
      }
    }
  }

  const storedFavorites = readStoredJson<FavoriteItem[]>(FAVORITES_STORAGE_KEY, []);
  for (const fav of storedFavorites) {
    if (!fav?.product?.productId) continue;
    const pid = fav.product.productId;
    if (baseline.has(pid)) continue;
    const seenIso = fav.lastSeenAt || fav.addedAt;
    const seenDay = getLocalDayKey(seenIso);
    if (seenDay && seenDay >= todayKey) continue;
    const favPriceUm = fav.lastSeenPriceUm ?? fav.product.priceUm ?? null;
    const favPackPrice = fav.lastSeenPackPrice ?? fav.product.price ?? null;
    if (favPriceUm !== null || favPackPrice !== null) {
      baseline.set(pid, {
        priceUm: favPriceUm,
        price: favPackPrice,
        unitLabel: fav.product.unitLabel || 'kg',
        seenAt: seenIso,
      });
    }
  }

  return baseline;
}

function persistLivePricesToHistory(
  liveProducts: IperalProduct[],
  nowIso: string,
  favoriteIds: Set<number>,
  boughtIds: Set<number>,
): void {
  try {
    const rawHistory = readStoredJson<Record<string, unknown>>(
      PRICE_HISTORY_STORAGE_KEY,
      {},
    );
    const history: Record<string, PriceHistoryRecord> = {};
    for (const [idStr, rawEntry] of Object.entries(rawHistory)) {
      const normalized = normalizeStoredPriceRecord(rawEntry);
      if (normalized) history[idStr] = normalized;
    }

    const todayKey = getLocalDayKey(nowIso);

    for (const p of liveProducts) {
      if (p.priceUm === null && p.price === null) continue;
      const key = String(p.productId);
      const existing = history[key];
      const nextLatest: PriceSnapshot = {
        priceUm: p.priceUm,
        price: p.price,
        unitLabel: p.unitLabel,
        seenAt: nowIso,
      };

      let nextPrevDay: PriceSnapshot | undefined;
      if (existing) {
        const existingDay = getLocalDayKey(existing.latest.seenAt);
        if (existingDay && existingDay < todayKey) {
          nextPrevDay = existing.latest;
        } else {
          nextPrevDay = existing.prevDay;
        }
      }

      history[key] = nextPrevDay
        ? { latest: nextLatest, prevDay: nextPrevDay }
        : { latest: nextLatest };
    }

    const entries = Object.entries(history);
    if (entries.length > MAX_PRICE_HISTORY_ENTRIES) {
      const getTier = (idStr: string): number => {
        const pid = Number(idStr);
        if (favoriteIds.has(pid)) return 2;
        if (boughtIds.has(pid)) return 1;
        return 0;
      };
      entries.sort((a, b) => {
        const tierDiff = getTier(b[0]) - getTier(a[0]);
        if (tierDiff !== 0) return tierDiff;
        return (b[1].latest.seenAt || '').localeCompare(a[1].latest.seenAt || '');
      });
      const trimmed = Object.fromEntries(entries.slice(0, MAX_PRICE_HISTORY_ENTRIES));
      window.localStorage.setItem(PRICE_HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
    } else {
      window.localStorage.setItem(PRICE_HISTORY_STORAGE_KEY, JSON.stringify(history));
    }
  } catch {
    // Ignore storage quota errors
  }
}

function findFirstLeafCategory(nodes: CategoryNode[]): CategoryNode | null {
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      const leaf = findFirstLeafCategory(node.children);
      if (leaf) return leaf;
    }
    return node;
  }
  return null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('catalog');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isCartOpen, setIsCartOpen] = useState(false);

  const previousVisitRef = useRef<Map<number, PriceSnapshot> | null>(null);
  if (previousVisitRef.current === null) {
    previousVisitRef.current = buildPreviousVisitBaseline();
  }

  const productsAbortRef = useRef<AbortController | null>(null);
  const productsRequestIdRef = useRef(0);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = readStoredString(THEME_STORAGE_KEY, 'light');
    return saved === 'dark' ||
      saved === 'christmas' ||
      saved === 'christmas-light'
      ? saved
      : 'light';
  });

  const [accentColor, setAccentColor] = useState<AccentColor>(() => {
    const saved = readStoredString(ACCENT_STORAGE_KEY, 'crimson');
    return saved === 'cobalt' || saved === 'emerald' || saved === 'amber'
      ? saved
      : 'crimson';
  });

  const [profileName, setProfileName] = useState<string>(() =>
    readStoredString(PROFILE_NAME_STORAGE_KEY, 'Profilo'),
  );

  const [connectionSettings, setConnectionSettings] = useState<ConnectionSettings>(() =>
    readStoredJson<ConnectionSettings>(CONNECTION_STORAGE_KEY, {
      backendMode: 'integrated',
      externalBaseUrl: 'http://localhost:5000',
    }),
  );
  // Kept strictly in React memory for security
  const [apiKey, setApiKey] = useState('');

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>({
    authenticated: false,
    source: 'none',
    apiKeyRequired: false,
    apiKeyAuthorized: true,
  });

  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryNode | null>(null);

  const [products, setProducts] = useState<IperalProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [promoOnly, setPromoOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [priceChangedOnly, setPriceChangedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('pri_um_asc');
  const [visibleCount, setVisibleCount] = useState(RENDER_CHUNK_SIZE);

  const [favorites, setFavorites] = useState<FavoriteItem[]>(() =>
    readStoredJson<FavoriteItem[]>(FAVORITES_STORAGE_KEY, []),
  );
  const [stagedCart, setStagedCart] = useState<CartItem[]>(() =>
    readStoredJson<CartItem[]>(CART_STORAGE_KEY, []),
  );
  const [orderHistory, setOrderHistory] = useState<OrderHistoryEntry[]>(() =>
    readStoredJson<OrderHistoryEntry[]>(ORDER_HISTORY_STORAGE_KEY, []).slice(
      0,
      MAX_ORDER_HISTORY,
    ),
  );

  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;
  const orderHistoryRef = useRef(orderHistory);
  orderHistoryRef.current = orderHistory;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'christmas', 'christmas-light');
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'christmas') {
      root.classList.add('christmas');
    } else if (theme === 'christmas-light') {
      root.classList.add('christmas-light');
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accentColor);
    try {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, accentColor);
    } catch {
      // Ignore storage errors
    }
  }, [accentColor]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PROFILE_NAME_STORAGE_KEY, profileName);
    } catch {
      // Ignore storage errors
    }
  }, [profileName]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // Ignore storage quota errors
    }
  }, [favorites]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(stagedCart));
    } catch {
      // Ignore storage quota errors
    }
  }, [stagedCart]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        ORDER_HISTORY_STORAGE_KEY,
        JSON.stringify(orderHistory.slice(0, MAX_ORDER_HISTORY)),
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [orderHistory]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        CONNECTION_STORAGE_KEY,
        JSON.stringify(connectionSettings),
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [connectionSettings]);

  const loadCategories = useCallback(
    async (settings: ConnectionSettings, key: string, forceRefresh = false) => {
      setLoadingCategories(true);
      setCatalogError(null);
      try {
        const tree = await fetchCategoriesTree(settings, key, forceRefresh);
        setCategories(tree);
      } catch (error) {
        setCatalogError(
          error instanceof Error
            ? error.message
            : 'Impossibile caricare le categorie Iperal.',
        );
      } finally {
        setLoadingCategories(false);
      }
    },
    [],
  );

  const refreshSessionAndCategories = useCallback(async () => {
    try {
      const status = await getSessionStatus(connectionSettings, apiKey);
      setSessionStatus(status);
      if (status.authenticated && (!status.apiKeyRequired || status.apiKeyAuthorized)) {
        await loadCategories(connectionSettings, apiKey);
      }
    } catch (error) {
      setCatalogError(
        error instanceof Error
          ? error.message
          : 'Errore nella verifica della sessione server.',
      );
    }
  }, [apiKey, connectionSettings, loadCategories]);

  useEffect(() => {
    void refreshSessionAndCategories();
  }, [refreshSessionAndCategories]);

  useEffect(() => {
    return () => {
      productsAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (selectedCategory?.categoryId) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [selectedCategory?.categoryId]);

  const loadCategoryProducts = useCallback(
    async (
      category: CategoryNode,
      sort: SortOption = 'pri_um_asc',
      forceRefresh = false,
    ) => {
      productsAbortRef.current?.abort();
      const controller = new AbortController();
      productsAbortRef.current = controller;
      const requestId = ++productsRequestIdRef.current;

      if (!forceRefresh) {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }

      setSelectedCategory(category);
      setProducts([]);
      setVisibleCount(RENDER_CHUNK_SIZE);
      setLoadingProducts(true);
      setCatalogError(null);
      setSelectedBrand('all');
      setPriceChangedOnly(false);

      try {
        const items = await fetchProductsByCategory(
          connectionSettings,
          apiKey,
          category.categoryId,
          category.name,
          sort,
          { signal: controller.signal, forceRefresh },
        );

        if (requestId !== productsRequestIdRef.current || controller.signal.aborted) {
          return;
        }

        setProducts(items);

        const nowIso = new Date().toISOString();
        const favIdSet = new Set(favoritesRef.current.map((f) => f.product.productId));
        const boughtIdSet = new Set<number>();
        for (const order of orderHistoryRef.current) {
          for (const entry of order.items) {
            boughtIdSet.add(entry.product.productId);
          }
        }
        persistLivePricesToHistory(items, nowIso, favIdSet, boughtIdSet);

        const liveById = new Map<number, IperalProduct>();
        for (const item of items) {
          liveById.set(item.productId, item);
        }
        setFavorites((prev) => {
          let changed = false;
          const next = prev.map((fav) => {
            const live = liveById.get(fav.product.productId);
            if (!live) return fav;
            changed = true;
            return {
              ...fav,
              product: live,
              lastSeenPriceUm: live.priceUm,
              lastSeenPackPrice: live.price,
              lastSeenAt: nowIso,
            };
          });
          return changed ? next : prev;
        });
      } catch (error) {
        if (
          requestId !== productsRequestIdRef.current ||
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === 'AbortError')
        ) {
          return;
        }
        setProducts([]);
        setCatalogError(
          error instanceof Error
            ? error.message
            : 'Impossibile scaricare i prodotti della categoria.',
        );
      } finally {
        if (requestId === productsRequestIdRef.current) {
          setLoadingProducts(false);
        }
      }
    },
    [apiKey, connectionSettings],
  );

  const handleSubmitCredentials = async (payload: {
    jsessionid?: string;
    ebsnAccount?: string;
    cookieString?: string;
  }): Promise<{ ok: boolean; message: string }> => {
    try {
      await saveSessionCredentials(connectionSettings, apiKey, payload);
      const status = await getSessionStatus(connectionSettings, apiKey);
      setSessionStatus({
        ...status,
        authenticated: true,
      });
      await loadCategories(connectionSettings, apiKey);
      return {
        ok: true,
        message: 'Sessione collegata con successo. Categorie caricate.',
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Errore durante la connessione a Iperal.',
      };
    }
  };

  const handleVerifyLiveSession = async (): Promise<{
    ok: boolean;
    message: string;
  }> => {
    try {
      const result = await verifyLiveIperalSession(connectionSettings, apiKey);
      const status = await getSessionStatus(connectionSettings, apiKey);
      setSessionStatus(status);
      return {
        ok: result.valid,
        message: result.message,
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Impossibile verificare la sessione con Iperal.',
      };
    }
  };

  const handleClearSession = async () => {
    try {
      await clearSessionCredentials(connectionSettings, apiKey);
    } finally {
      setSessionStatus((prev) => ({
        ...prev,
        authenticated: false,
        source: 'none',
        maskedJsessionid: undefined,
        maskedEbsnAccount: undefined,
        persistedAcrossReload: false,
      }));
      setCategories([]);
      setProducts([]);
      setSelectedCategory(null);
    }
  };

  const favoriteIds = useMemo(
    () => new Set(favorites.map((item) => item.product.productId)),
    [favorites],
  );

  const cartQuantities = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of stagedCart) {
      map.set(item.product.productId, item.quantity);
    }
    return map;
  }, [stagedCart]);

  const totalCartItemsCount = useMemo(
    () => stagedCart.reduce((sum, item) => sum + item.quantity, 0),
    [stagedCart],
  );

  const priceDiffs = useMemo(() => {
    const map = new Map<number, PriceDiff>();
    const baseline = previousVisitRef.current;
    if (!baseline) return map;

    for (const product of products) {
      const diff = computePriceDiff(product, baseline.get(product.productId));
      if (diff) map.set(product.productId, diff);
    }

    for (const fav of favorites) {
      if (!map.has(fav.product.productId)) {
        const diff = computePriceDiff(fav.product, baseline.get(fav.product.productId));
        if (diff) map.set(fav.product.productId, diff);
      }
    }

    return map;
  }, [products, favorites]);

  const changedPricesCountInCategory = useMemo(() => {
    let count = 0;
    for (const p of products) {
      if (priceDiffs.has(p.productId)) count += 1;
    }
    return count;
  }, [products, priceDiffs]);

  const toggleFavorite = (product: IperalProduct) => {
    const nowIso = new Date().toISOString();
    setFavorites((prev) => {
      const exists = prev.some((f) => f.product.productId === product.productId);
      const nextFavorites = exists
        ? prev.filter((f) => f.product.productId !== product.productId)
        : [
            ...prev,
            {
              product,
              addedAt: nowIso,
              lastSeenPriceUm: product.priceUm,
              lastSeenPackPrice: product.price,
              lastSeenAt: nowIso,
            },
          ];

      if (!exists) {
        const nextFavIds = new Set(nextFavorites.map((f) => f.product.productId));
        const boughtIdSet = new Set<number>();
        for (const order of orderHistory) {
          for (const entry of order.items) {
            boughtIdSet.add(entry.product.productId);
          }
        }
        persistLivePricesToHistory([product], nowIso, nextFavIds, boughtIdSet);
      }

      return nextFavorites;
    });
  };

  const addToCart = (product: IperalProduct) => {
    setStagedCart((prev) => {
      const idx = prev.findIndex((c) => c.product.productId === product.productId);
      if (idx >= 0) {
        return prev.map((c, i) =>
          i === idx ? { ...c, quantity: Math.min(99, c.quantity + 1), product } : c,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: number, delta: number) => {
    setStagedCart((prev) =>
      prev
        .map((c) =>
          c.product.productId === productId
            ? { ...c, quantity: Math.min(99, c.quantity + delta) }
            : c,
        )
        .filter((c) => c.quantity > 0),
    );
  };

  const removeCartItem = (productId: number) => {
    setStagedCart((prev) => prev.filter((c) => c.product.productId !== productId));
  };

  const addAllFavoritesToCart = () => {
    setStagedCart((prev) => {
      const map = new Map<number, CartItem>();
      for (const item of prev) {
        map.set(item.product.productId, item);
      }
      for (const fav of favorites) {
        const existing = map.get(fav.product.productId);
        if (existing) {
          map.set(fav.product.productId, {
            ...existing,
            quantity: Math.min(99, existing.quantity + 1),
          });
        } else {
          map.set(fav.product.productId, {
            product: fav.product,
            quantity: 1,
          });
        }
      }
      return Array.from(map.values());
    });
    setIsCartOpen(true);
  };

  const importFavorites = (imported: FavoriteItem[]) => {
    if (previousVisitRef.current) {
      for (const item of imported) {
        const pid = item.product.productId;
        if (!previousVisitRef.current.has(pid)) {
          previousVisitRef.current.set(pid, {
            priceUm: item.lastSeenPriceUm ?? item.product.priceUm ?? null,
            price: item.lastSeenPackPrice ?? item.product.price ?? null,
            unitLabel: item.product.unitLabel || 'kg',
            seenAt: item.lastSeenAt || item.addedAt,
          });
        }
      }
    }

    setFavorites((prev) => {
      const map = new Map<number, FavoriteItem>();
      for (const item of prev) {
        map.set(item.product.productId, item);
      }
      for (const item of imported) {
        map.set(item.product.productId, item);
      }
      return Array.from(map.values());
    });
  };

  const handleSyncCartToIperal = async (): Promise<{
    ok: boolean;
    message: string;
  }> => {
    if (stagedCart.length === 0) {
      return { ok: false, message: 'Il carrello è vuoto.' };
    }

    const snapshotItems = stagedCart.map((c) => ({
      product: c.product,
      quantity: c.quantity,
    }));
    const totalPieces = snapshotItems.reduce((sum, item) => sum + item.quantity, 0);
    const estimatedTotal = snapshotItems.reduce(
      (sum, item) => sum + (item.product.price ?? 0) * item.quantity,
      0,
    );

    try {
      await syncCartToIperal(connectionSettings, apiKey, snapshotItems);

      const nowIso = new Date().toISOString();
      const newOrder: OrderHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: nowIso,
        items: snapshotItems,
        totalPieces,
        estimatedTotal,
      };
      const nextHistory = [newOrder, ...orderHistory].slice(0, MAX_ORDER_HISTORY);
      setOrderHistory(nextHistory);
      setStagedCart([]);

      const favIdSet = new Set(favorites.map((f) => f.product.productId));
      const boughtIdSet = new Set<number>();
      for (const order of nextHistory) {
        for (const entry of order.items) {
          boughtIdSet.add(entry.product.productId);
        }
      }
      persistLivePricesToHistory(
        snapshotItems.map((i) => i.product),
        nowIso,
        favIdSet,
        boughtIdSet,
      );

      return {
        ok: true,
        message: `${snapshotItems.length} prodotti (${totalPieces} pezzi) inviati al carrello di iperalspesaonline.it. Il carrello locale è stato svuotato e l'ordine è salvato in Cronologia.`,
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Invio al carrello Iperal non riuscito.",
      };
    }
  };

  const handleApplyHistoricalOrder = (
    order: OrderHistoryEntry,
    mode: 'merge' | 'replace',
  ) => {
    if (mode === 'replace') {
      setStagedCart(order.items.map((item) => ({ ...item })));
    } else {
      setStagedCart((prev) => {
        const map = new Map<number, CartItem>();
        for (const item of prev) {
          map.set(item.product.productId, { ...item });
        }
        for (const item of order.items) {
          const existing = map.get(item.product.productId);
          if (existing) {
            map.set(item.product.productId, {
              ...existing,
              quantity: Math.min(99, existing.quantity + item.quantity),
            });
          } else {
            map.set(item.product.productId, { ...item });
          }
        }
        return Array.from(map.values());
      });
    }
  };

  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.brand) set.add(p.brand);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'it'));
  }, [products]);

  const displayedProducts = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);
    const queryTokens = normalizedQuery ? normalizedQuery.split(/\s+/).filter(Boolean) : [];

    const filtered = products.filter((p) => {
      if (queryTokens.length > 0) {
        const haystack =
          p.searchText ||
          normalizeSearchText(`${p.name} ${p.brand} ${p.packaging} ${p.categoryName || ''}`);
        for (const token of queryTokens) {
          if (!haystack.includes(token)) return false;
        }
      }
      if (selectedBrand !== 'all' && p.brand !== selectedBrand) return false;
      if (promoOnly && !p.isPromo) return false;
      if (favoritesOnly && !favoriteIds.has(p.productId)) return false;
      if (priceChangedOnly && !priceDiffs.has(p.productId)) return false;
      return true;
    });
    return sortNormalizedProducts(filtered, sortBy);
  }, [
    favoriteIds,
    favoritesOnly,
    priceChangedOnly,
    priceDiffs,
    products,
    promoOnly,
    searchQuery,
    selectedBrand,
    sortBy,
  ]);

  const visibleProducts = useMemo(
    () => displayedProducts.slice(0, visibleCount),
    [displayedProducts, visibleCount],
  );
  const hasMoreProducts = visibleCount < displayedProducts.length;

  useEffect(() => {
    setVisibleCount(RENDER_CHUNK_SIZE);
  }, [displayedProducts]);

  const showStorefrontWorkspace = activeTab === 'catalog';

  useEffect(() => {
    if (!showStorefrontWorkspace || loadingProducts || !hasMoreProducts) return;
    const sentinel = loadMoreRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisibleCount((prev) =>
              Math.min(displayedProducts.length, prev + RENDER_CHUNK_SIZE),
            );
            break;
          }
        }
      },
      { rootMargin: '450px 0px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    displayedProducts.length,
    hasMoreProducts,
    loadingProducts,
    showStorefrontWorkspace,
  ]);

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
  };

  const handleSelectFirstCategory = () => {
    const first = findFirstLeafCategory(categories);
    if (first) {
      void loadCategoryProducts(first, sortBy);
    }
  };

  const useImageProxy = connectionSettings.backendMode === 'integrated';

  const isChristmasTheme = theme === 'christmas' || theme === 'christmas-light';

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {isChristmasTheme && (
        <ChristmasSnowfall variant={theme === 'christmas-light' ? 'light' : 'dark'} />
      )}
      <TopBar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        cartCount={totalCartItemsCount}
        favoritesCount={favorites.length}
        historyCount={orderHistory.length}
        onOpenCart={() => setIsCartOpen(true)}
        profileName={profileName}
        authenticated={sessionStatus.authenticated}
        theme={theme}
        onChangeTheme={setTheme}
        accentColor={accentColor}
        onChangeAccentColor={setAccentColor}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'session' && (
          <SessionView
            sessionStatus={sessionStatus}
            connectionSettings={connectionSettings}
            apiKey={apiKey}
            profileName={profileName}
            onChangeProfileName={setProfileName}
            onChangeApiKey={setApiKey}
            onChangeConnectionSettings={setConnectionSettings}
            onSubmitCredentials={handleSubmitCredentials}
            onVerifyLiveSession={handleVerifyLiveSession}
            onClearSession={handleClearSession}
            onGoToCatalog={() => handleSelectTab('catalog')}
          />
        )}

        {activeTab === 'favorites' && (
          <FavoritesView
            favorites={favorites}
            cartQuantities={cartQuantities}
            useImageProxy={useImageProxy}
            priceDiffs={priceDiffs}
            onRemoveFavorite={(id) =>
              setFavorites((prev) => prev.filter((f) => f.product.productId !== id))
            }
            onAddToCart={addToCart}
            onAddAllToCart={addAllFavoritesToCart}
            onImportFavorites={importFavorites}
            onBrowseCatalog={() => handleSelectTab('catalog')}
          />
        )}

        {activeTab === 'history' && (
          <OrderHistoryView
            orders={orderHistory}
            currentCartPieces={totalCartItemsCount}
            useImageProxy={useImageProxy}
            onApplyOrder={handleApplyHistoricalOrder}
            onBrowseCatalog={() => handleSelectTab('catalog')}
          />
        )}

        {showStorefrontWorkspace && (
          <div className="space-y-6">
            {!selectedCategory && (
              <StorefrontHero
                authenticated={sessionStatus.authenticated}
                hasCategories={categories.length > 0}
                onConfigureSession={() => setActiveTab('session')}
                onSelectFirstCategory={handleSelectFirstCategory}
              />
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-3 lg:sticky lg:top-[84px] lg:self-start">
                <CategorySidebar
                  categories={categories}
                  selectedCategoryId={selectedCategory?.categoryId ?? null}
                  onSelectCategory={(cat) => void loadCategoryProducts(cat, sortBy)}
                  loading={loadingCategories}
                />
              </div>

              <div className="space-y-4 lg:col-span-9">
                {catalogError && (
                  <div
                    role="alert"
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--surface)] p-4 text-sm"
                  >
                    <div className="flex items-start gap-2.5 text-[var(--danger)]">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="font-medium text-[var(--text-primary)]">
                        {catalogError}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('session')}
                        className="cursor-pointer rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-xs font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
                      >
                        Configura sessione
                      </button>
                      {selectedCategory && (
                        <button
                          type="button"
                          onClick={() =>
                            void loadCategoryProducts(selectedCategory, sortBy, true)
                          }
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Riprova</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3.5">
                    <div>
                      <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                        {selectedCategory
                          ? selectedCategory.name
                          : 'Seleziona un reparto a sinistra'}
                      </h2>
                      {selectedCategory && (
                        <p className="text-xs tabular-nums text-[var(--text-muted)]">
                          {loadingProducts
                            ? 'Caricamento in corso...'
                            : `${displayedProducts.length} di ${products.length} prodotti`}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedCategory && (
                        <button
                          type="button"
                          onClick={() =>
                            void loadCategoryProducts(selectedCategory, sortBy, true)
                          }
                          disabled={loadingProducts}
                          aria-label="Aggiorna prodotti categoria"
                          title="Forza aggiornamento live da Iperal"
                          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 ${loadingProducts ? 'animate-spin' : ''}`}
                            aria-hidden="true"
                          />
                          <span>Aggiorna</span>
                        </button>
                      )}

                      <div className="inline-flex rounded-lg bg-[var(--surface-subtle)] p-1">
                        <button
                          type="button"
                          onClick={() => setViewMode('grid')}
                          aria-label="Vista a griglia"
                          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                            viewMode === 'grid'
                              ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Griglia</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('table')}
                          aria-label="Vista tabella confronto"
                          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                            viewMode === 'table'
                              ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <TableProperties className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Tabella €/kg</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[210px] flex-1">
                      <Search
                        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                        aria-hidden="true"
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filtra prodotti o marche nella categoria..."
                        aria-label="Filtra prodotti nella categoria"
                        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] py-2 pr-8 pl-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:outline-none"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label="Pulisci filtro testo"
                          className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    <select
                      value={selectedBrand}
                      onChange={(e) => setSelectedBrand(e.target.value)}
                      aria-label="Filtra per marca"
                      className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                    >
                      <option value="all">Tutte le marche</option>
                      {availableBrands.map((brand) => (
                        <option key={brand} value={brand}>
                          {brand}
                        </option>
                      ))}
                    </select>

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      aria-label="Ordina prodotti"
                      className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                    >
                      <option value="pri_um_asc">Prezzo €/kg: dal più basso</option>
                      <option value="pri_um_desc">Prezzo €/kg: dal più alto</option>
                      <option value="pri_asc">Prezzo confezione: crescente</option>
                      <option value="pri_desc">Prezzo confezione: decrescente</option>
                      <option value="name_asc">Nome prodotto: A-Z</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setPromoOnly((v) => !v)}
                      aria-pressed={promoOnly}
                      className={`h-9 cursor-pointer whitespace-nowrap shrink-0 rounded-lg border px-3 text-xs font-medium transition-colors ${
                        promoOnly
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                          : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Solo offerte
                    </button>

                    <button
                      type="button"
                      onClick={() => setFavoritesOnly((v) => !v)}
                      aria-pressed={favoritesOnly}
                      className={`h-9 cursor-pointer whitespace-nowrap shrink-0 rounded-lg border px-3 text-xs font-medium transition-colors ${
                        favoritesOnly
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                          : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Solo preferiti
                    </button>

                    {(changedPricesCountInCategory > 0 || priceChangedOnly) && (
                      <button
                        type="button"
                        onClick={() => setPriceChangedOnly((v) => !v)}
                        aria-pressed={priceChangedOnly}
                        className={`h-9 cursor-pointer whitespace-nowrap shrink-0 rounded-lg border px-3 text-xs font-medium tabular-nums transition-colors ${
                          priceChangedOnly
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                            : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Prezzi cambiati ({changedPricesCountInCategory})
                      </button>
                    )}
                  </div>
                </div>

                {loadingProducts ? (
                  <div
                    className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
                    aria-busy="true"
                    aria-label="Caricamento prodotti"
                  >
                    {[1, 2, 3, 4, 5, 6].map((idx) => (
                      <div
                        key={idx}
                        className="h-80 animate-pulse rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4"
                      >
                        <div className="mb-4 aspect-[4/3] rounded-lg bg-[var(--surface-subtle)]" />
                        <div className="mb-2 h-4 w-1/3 rounded bg-[var(--surface-subtle)]" />
                        <div className="mb-4 h-5 w-4/5 rounded bg-[var(--surface-subtle)]" />
                        <div className="h-10 rounded-lg bg-[var(--surface-subtle)]" />
                      </div>
                    ))}
                  </div>
                ) : !selectedCategory ? (
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-12 text-center">
                    <p className="font-display text-base font-semibold text-[var(--text-primary)]">
                      {sessionStatus.authenticated
                        ? 'Scegli un reparto per iniziare la spesa'
                        : 'Connetti la sessione Iperal per esplorare il catalogo live'}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {sessionStatus.authenticated
                        ? 'I prodotti verranno scaricati da tutte le pagine della categoria e ordinati automaticamente per €/kg.'
                        : 'Apri il menu profilo in alto a destra e seleziona Impostazioni e sessione per inserire JSESSIONID e X-Ebsn-Account.'}
                    </p>
                  </div>
                ) : displayedProducts.length === 0 ? (
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-12 text-center">
                    <p className="font-display text-base font-semibold text-[var(--text-primary)]">
                      Nessun prodotto trovato
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      Prova a rimuovere i filtri di ricerca o scegli una sottocategoria
                      diversa.
                    </p>
                    {(searchQuery ||
                      selectedBrand !== 'all' ||
                      promoOnly ||
                      favoritesOnly ||
                      priceChangedOnly) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedBrand('all');
                          setPromoOnly(false);
                          setFavoritesOnly(false);
                          setPriceChangedOnly(false);
                        }}
                        className="mt-4 cursor-pointer rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                      >
                        Azzera filtri
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {viewMode === 'table' ? (
                      <ProductComparisonTable
                        products={visibleProducts}
                        favoriteIds={favoriteIds}
                        cartQuantities={cartQuantities}
                        useImageProxy={useImageProxy}
                        priceDiffs={priceDiffs}
                        onToggleFavorite={toggleFavorite}
                        onAddToCart={addToCart}
                        onUpdateCartQuantity={updateCartQuantity}
                      />
                    ) : (
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                        {visibleProducts.map((product, index) => (
                          <ProductCard
                            key={product.productId}
                            product={product}
                            rankIndex={index}
                            isBestValue={
                              sortBy === 'pri_um_asc' &&
                              index < 3 &&
                              product.priceUm !== null
                            }
                            isFavorite={favoriteIds.has(product.productId)}
                            cartQuantity={cartQuantities.get(product.productId) || 0}
                            useImageProxy={useImageProxy}
                            priceDiff={priceDiffs.get(product.productId) || null}
                            onToggleFavorite={toggleFavorite}
                            onAddToCart={addToCart}
                            onUpdateCartQuantity={updateCartQuantity}
                          />
                        ))}
                      </div>
                    )}

                    {hasMoreProducts && (
                      <div
                        ref={loadMoreRef}
                        className="flex flex-col items-center justify-center gap-2 py-4"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleCount((prev) =>
                              Math.min(
                                displayedProducts.length,
                                prev + RENDER_CHUNK_SIZE,
                              ),
                            )
                          }
                          className="cursor-pointer rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)]"
                        >
                          Mostra altri{' '}
                          {Math.min(
                            RENDER_CHUNK_SIZE,
                            displayedProducts.length - visibleProducts.length,
                          )}{' '}
                          prodotti ({visibleProducts.length} / {displayedProducts.length})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface)]/60">
        <div className="mx-auto max-w-[1440px] px-4 py-4 text-center text-xs text-[var(--text-muted)] sm:px-6 lg:px-8">
          Spesa Smart · Progetto indipendente e non ufficiale compatibile con{' '}
          <span className="font-medium text-[var(--text-secondary)]">
            iperalspesaonline.it
          </span>
          , non affiliato, associato né approvato da Iperal S.p.A. I marchi
          citati appartengono ai rispettivi proprietari.
        </div>
      </footer>

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={stagedCart}
        useImageProxy={useImageProxy}
        onUpdateQuantity={updateCartQuantity}
        onRemoveItem={removeCartItem}
        onClearCart={() => setStagedCart([])}
        onSyncCart={handleSyncCartToIperal}
        onNavigateSession={() => setActiveTab('session')}
        onNavigateHistory={() => setActiveTab('history')}
      />
    </div>
  );
}
