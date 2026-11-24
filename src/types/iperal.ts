export interface CategoryNode {
  categoryId: number;
  name: string;
  children: CategoryNode[];
}

export type RawIperalProduct = Record<string, unknown>;

export interface IperalProduct {
  productId: number;
  name: string;
  description?: string;
  brand: string;
  price: number | null;
  originalPrice: number | null;
  discountPercent: number | null;
  priceUm: number | null;
  unitLabel: string;
  packaging: string;
  imageUrl: string | null;
  isPromo: boolean;
  promoLabel: string | null;
  inStock: boolean;
  categoryName?: string;
  searchText?: string;
}

export interface CartItem {
  product: IperalProduct;
  quantity: number;
  acceptAlternatives?: boolean;
}

export interface OrderHistoryEntry {
  id: string;
  createdAt: string;
  items: CartItem[];
  totalPieces: number;
  estimatedTotal: number;
}

export interface FavoriteItem {
  product: IperalProduct;
  addedAt: string;
  lastSeenPriceUm: number | null;
  lastSeenPackPrice?: number | null;
  lastSeenAt?: string;
}

export interface PriceSnapshot {
  priceUm: number | null;
  price: number | null;
  unitLabel: string;
  seenAt: string;
}

export interface PriceHistoryRecord {
  latest: PriceSnapshot;
  prevDay?: PriceSnapshot;
}

export interface PriceDiff {
  direction: 'up' | 'down';
  delta: number;
  percent: number | null;
  previousPrice: number;
  currentPrice: number;
  unitLabel: string;
  previousSeenAt: string;
  isUnitPrice: boolean;
  packDelta?: number | null;
  previousPackPrice?: number | null;
  currentPackPrice?: number | null;
}

export type SortOption =
  | 'pri_um_asc'
  | 'pri_um_desc'
  | 'pri_asc'
  | 'pri_desc'
  | 'name_asc';

export type ViewMode = 'grid' | 'table';

export type ActiveTab = 'catalog' | 'favorites' | 'history' | 'session';

export type ThemeMode = 'light' | 'dark' | 'christmas' | 'christmas-light';

export type AccentColor = 'crimson' | 'cobalt' | 'emerald' | 'amber';

export interface SessionStatus {
  authenticated: boolean;
  source: 'env' | 'manual' | 'cookie' | 'none';
  apiKeyRequired: boolean;
  apiKeyAuthorized: boolean;
  maskedJsessionid?: string;
  maskedEbsnAccount?: string;
  persistedAcrossReload?: boolean;
}

export interface ConnectionSettings {
  backendMode: 'integrated' | 'external';
  externalBaseUrl: string;
}
