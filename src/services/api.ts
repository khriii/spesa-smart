import type {
  CartItem,
  CategoryNode,
  ConnectionSettings,
  IperalProduct,
  RawIperalProduct,
  SessionStatus,
  SortOption,
} from '../types/iperal';
import { normalizeIperalProduct } from '../utils/productNormalizer';

function resolveBaseUrl(settings: ConnectionSettings): string {
  if (settings.backendMode === 'external') {
    const trimmed = settings.externalBaseUrl.trim().replace(/\/+$/, '');
    if (trimmed) {
      return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
    }
  }
  return '/api';
}

function buildRequestHeaders(
  apiKey: string,
  hasBody = false,
  isMutation = false,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  if (isMutation) {
    headers['X-Requested-With'] = 'XMLHttpRequest';
  }
  if (apiKey.trim()) {
    headers['X-Api-Key'] = apiKey.trim();
  }
  return headers;
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string; message?: string };
    return data.error || data.message || fallback;
  } catch {
    return `${fallback} (HTTP ${res.status})`;
  }
}

export async function getSessionStatus(
  settings: ConnectionSettings,
  apiKey: string,
): Promise<SessionStatus> {
  const baseUrl = resolveBaseUrl(settings);
  const res = await fetch(`${baseUrl}/session`, {
    method: 'GET',
    headers: buildRequestHeaders(apiKey),
    cache: 'no-store',
    credentials: settings.backendMode === 'integrated' ? 'same-origin' : 'omit',
  });

  if (!res.ok) {
    // Fallback compatibility with Flask server.py versions that only implement POST /api/session
    if (res.status === 405) {
      return {
        authenticated: false,
        source: 'none',
        apiKeyRequired: false,
        apiKeyAuthorized: true,
      };
    }
    throw new Error(await parseErrorMessage(res, 'Impossibile verificare la sessione.'));
  }

  const data = (await res.json()) as Partial<SessionStatus>;
  return {
    authenticated: Boolean(data.authenticated),
    source: data.source || 'none',
    apiKeyRequired: Boolean(data.apiKeyRequired),
    apiKeyAuthorized: data.apiKeyAuthorized !== false,
    maskedJsessionid: data.maskedJsessionid,
    maskedEbsnAccount: data.maskedEbsnAccount,
    persistedAcrossReload: Boolean(data.persistedAcrossReload),
  };
}

export async function saveSessionCredentials(
  settings: ConnectionSettings,
  apiKey: string,
  payload: { jsessionid?: string; ebsnAccount?: string; cookieString?: string },
): Promise<void> {
  const baseUrl = resolveBaseUrl(settings);
  const res = await fetch(`${baseUrl}/session`, {
    method: 'POST',
    headers: buildRequestHeaders(apiKey, true, true),
    body: JSON.stringify(payload),
    credentials: settings.backendMode === 'integrated' ? 'same-origin' : 'omit',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Salvataggio sessione non riuscito.'));
  }
}

export async function verifyLiveIperalSession(
  settings: ConnectionSettings,
  apiKey: string,
): Promise<{
  valid: boolean;
  userId: number | null;
  message: string;
  maskedJsessionid?: string;
  maskedEbsnAccount?: string;
}> {
  const baseUrl = resolveBaseUrl(settings);
  const res = await fetch(`${baseUrl}/session/check`, {
    method: 'POST',
    headers: buildRequestHeaders(apiKey, false, true),
    credentials: settings.backendMode === 'integrated' ? 'same-origin' : 'omit',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Verifica sessione non riuscita.'));
  }

  return (await res.json()) as {
    valid: boolean;
    userId: number | null;
    message: string;
    maskedJsessionid?: string;
    maskedEbsnAccount?: string;
  };
}

export async function clearSessionCredentials(
  settings: ConnectionSettings,
  apiKey: string,
): Promise<void> {
  const baseUrl = resolveBaseUrl(settings);
  const res = await fetch(`${baseUrl}/session`, {
    method: 'DELETE',
    headers: buildRequestHeaders(apiKey, false, true),
    credentials: settings.backendMode === 'integrated' ? 'same-origin' : 'omit',
  });

  if (!res.ok && res.status !== 405) {
    throw new Error(await parseErrorMessage(res, 'Disconnessione non riuscita.'));
  }
}

export async function fetchCategoriesTree(
  settings: ConnectionSettings,
  apiKey: string,
  forceRefresh = false,
): Promise<CategoryNode[]> {
  const baseUrl = resolveBaseUrl(settings);
  const url = forceRefresh ? `${baseUrl}/categories?refresh=true` : `${baseUrl}/categories`;
  const res = await fetch(url, {
    method: 'GET',
    headers: buildRequestHeaders(apiKey),
    cache: 'no-store',
    credentials: settings.backendMode === 'integrated' ? 'same-origin' : 'omit',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Errore nel caricamento delle categorie.'));
  }

  return (await res.json()) as CategoryNode[];
}

export async function fetchProductsByCategory(
  settings: ConnectionSettings,
  apiKey: string,
  categoryId: number,
  categoryName: string,
  sort: SortOption = 'pri_um_asc',
  options?: { signal?: AbortSignal; forceRefresh?: boolean },
): Promise<IperalProduct[]> {
  const baseUrl = resolveBaseUrl(settings);
  const params = new URLSearchParams({
    category_id: String(categoryId),
    sort,
  });
  if (options?.forceRefresh) {
    params.set('refresh', 'true');
  }
  const url = `${baseUrl}/products?${params.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: buildRequestHeaders(apiKey),
    signal: options?.signal,
    cache: 'no-store',
    credentials: settings.backendMode === 'integrated' ? 'same-origin' : 'omit',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Errore nel caricamento dei prodotti.'));
  }

  const rawProducts = (await res.json()) as RawIperalProduct[];
  if (!Array.isArray(rawProducts)) return [];

  const normalized: IperalProduct[] = [];
  for (const item of rawProducts) {
    const prod = normalizeIperalProduct(item, categoryName);
    if (prod) normalized.push(prod);
  }
  return normalized;
}

export async function syncCartToIperal(
  settings: ConnectionSettings,
  apiKey: string,
  items: CartItem[],
): Promise<Record<string, unknown>> {
  const baseUrl = resolveBaseUrl(settings);
  const payload = {
    items: items.map((entry) => ({
      productId: entry.product.productId,
      quantity: entry.quantity,
    })),
  };

  const res = await fetch(`${baseUrl}/cart`, {
    method: 'POST',
    headers: buildRequestHeaders(apiKey, true, true),
    body: JSON.stringify(payload),
    credentials: settings.backendMode === 'integrated' ? 'same-origin' : 'omit',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Errore durante l'invio al carrello Iperal."));
  }

  return (await res.json()) as Record<string, unknown>;
}
