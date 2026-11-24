import crypto from 'node:crypto';

export interface IperalSession {
  jsessionid: string;
  ebsnAccount: string;
  source: 'env' | 'manual' | 'cookie';
  cookieJar: Map<string, string>;
  onCookiesUpdated?: (session: IperalSession) => void;
}

export interface SimplifiedCategory {
  categoryId: number;
  name: string;
  children: SimplifiedCategory[];
}

export interface CartItemPayload {
  productId: number;
  quantity: number;
  infos: {
    accept_alternatives: boolean;
  };
}

export function getSessionCacheKey(session: IperalSession): string {
  return crypto
    .createHash('sha256')
    .update(`${session.jsessionid}:${session.ebsnAccount}`)
    .digest('hex')
    .slice(0, 16);
}

const BASE_URL = 'https://www.iperalspesaonline.it';

const DEFAULT_HEADERS: Record<string, string> = {
  accept: 'application/json',
  'x-ebsn-client': 'site',
  'x-ebsn-client-redirect': 'site',
  'x-ebsn-version': '5.12.1',
  referer: `${BASE_URL}/`,
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
};

const ALLOWED_IMAGE_HOSTS = new Set([
  'iperalspesaonline.it',
  'www.iperalspesaonline.it',
  'iperal.it',
  'www.iperal.it',
  'iperal-cdn.azureedge.net',
]);

const verifiedProductImageUrls = new Set<string>();
const MAX_TRACKED_IMAGE_URLS = 15000;

function sanitizeCookieValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /[\r\n;]/.test(trimmed)) {
    throw new Error(
      'Valore cookie non valido: rimuovi interruzioni di riga o punti e virgola.',
    );
  }
  return trimmed;
}

export function createSession(
  jsessionid?: string,
  ebsnAccount?: string,
  source: 'env' | 'manual' | 'cookie' = 'manual',
): IperalSession {
  const resolvedJsession = jsessionid || process.env.IPERAL_JSESSIONID || '';
  const resolvedAccount = ebsnAccount || process.env.IPERAL_EBSN_ACCOUNT || '';

  if (!resolvedJsession || !resolvedAccount) {
    throw new Error(
      'Cookie mancanti: inserisci JSESSIONID e X-Ebsn-Account oppure configurali nel file .env.',
    );
  }

  const cleanJsession = sanitizeCookieValue(resolvedJsession);
  const cleanAccount = sanitizeCookieValue(resolvedAccount);
  const cookieJar = new Map<string, string>();
  cookieJar.set('JSESSIONID', cleanJsession);
  cookieJar.set('X-Ebsn-Account', cleanAccount);

  return {
    jsessionid: cleanJsession,
    ebsnAccount: cleanAccount,
    source: jsessionid && ebsnAccount ? source : 'env',
    cookieJar,
  };
}

export function maskSecretValue(value: string): string {
  const clean = value.trim();
  if (!clean) return '';
  if (clean.length <= 6) {
    return '••••';
  }
  if (clean.length <= 10) {
    return `${clean.slice(0, 2)}••••${clean.slice(-2)}`;
  }
  return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
}

export function getSessionMaskedPreviews(session: IperalSession | null): {
  maskedJsessionid?: string;
  maskedEbsnAccount?: string;
} {
  if (!session) return {};
  return {
    maskedJsessionid: maskSecretValue(session.jsessionid),
    maskedEbsnAccount: maskSecretValue(session.ebsnAccount),
  };
}

export function restoreSessionFromSnapshot(snapshot: {
  jsessionid: string;
  ebsnAccount: string;
  jar?: Array<[string, string]>;
  source?: 'env' | 'manual' | 'cookie';
}): IperalSession {
  const session = createSession(
    snapshot.jsessionid,
    snapshot.ebsnAccount,
    snapshot.source === 'env' ? 'env' : 'cookie',
  );
  if (Array.isArray(snapshot.jar)) {
    for (const [k, v] of snapshot.jar) {
      if (typeof k === 'string' && typeof v === 'string' && k && v) {
        session.cookieJar.set(k, v);
      }
    }
  }
  session.cookieJar.set('JSESSIONID', session.jsessionid);
  session.cookieJar.set('X-Ebsn-Account', session.ebsnAccount);
  return session;
}

export function parseCookieString(rawInput: string): {
  jsessionid: string;
  ebsnAccount: string;
} | null {
  const cleaned = rawInput.replace(/\\\r?\n/g, ' ');
  const jsessionMatch = cleaned.match(
    /(?:^|[;\s'"(])JSESSIONID=([^;\r\n'"`\s)]+)/i,
  );
  const accountMatch = cleaned.match(
    /(?:^|[;\s'"(])X-Ebsn-Account=([^;\r\n'"`\s)]+)/i,
  );

  if (!jsessionMatch?.[1] || !accountMatch?.[1]) {
    return null;
  }

  return {
    jsessionid: jsessionMatch[1].trim(),
    ebsnAccount: accountMatch[1].trim(),
  };
}

function updateCookieJarFromResponse(
  session: IperalSession,
  response: Response,
): void {
  const headersWithSetCookie = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  const setCookies =
    typeof headersWithSetCookie.getSetCookie === 'function'
      ? headersWithSetCookie.getSetCookie()
      : [];

  let updated = false;
  for (const raw of setCookies) {
    const firstPart = raw.split(';')[0];
    if (!firstPart) continue;
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = firstPart.slice(0, eqIdx).trim();
    const val = firstPart.slice(eqIdx + 1).trim();
    if (!name || !val) continue;

    session.cookieJar.set(name, val);
    updated = true;

    if (name.toUpperCase() === 'JSESSIONID') {
      session.jsessionid = val;
    } else if (name.toLowerCase() === 'x-ebsn-account') {
      session.ebsnAccount = val;
    }
  }

  if (updated && session.onCookiesUpdated) {
    session.onCookiesUpdated(session);
  }
}

function formatCookieHeader(session: IperalSession): string {
  if (!session.cookieJar.has('JSESSIONID')) {
    session.cookieJar.set('JSESSIONID', session.jsessionid);
  }
  if (!session.cookieJar.has('X-Ebsn-Account')) {
    session.cookieJar.set('X-Ebsn-Account', session.ebsnAccount);
  }
  return Array.from(session.cookieJar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function buildHeaders(
  session: IperalSession,
  hasJsonBody = false,
): Record<string, string> {
  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    cookie: formatCookieHeader(session),
  };
  if (hasJsonBody) {
    headers['content-type'] = 'application/json';
    headers.origin = BASE_URL;
  }
  return headers;
}

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '::1' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }

  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (
      a === 127 ||
      a === 10 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return true;
    }
  }

  if (lower.startsWith('[') || lower.includes(':')) {
    const normalized = lower.replace(/^\[|\]$/g, '');
    if (
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80')
    ) {
      return true;
    }
  }

  return false;
}

function isAllowedStaticIperalHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (ALLOWED_IMAGE_HOSTS.has(lower)) return true;
  if (lower.endsWith('.iperalspesaonline.it') || lower.endsWith('.iperal.it')) {
    return true;
  }
  return false;
}

function normalizeCandidateUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || /^data:|^javascript:/i.test(trimmed)) return null;

  let full = trimmed;
  if (full.startsWith('//')) {
    full = `https:${full}`;
  } else if (full.startsWith('/')) {
    full = `${BASE_URL}${full}`;
  } else if (!/^https?:\/\//i.test(full)) {
    if (/\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(full) || full.includes('/')) {
      full = `${BASE_URL}/${full.replace(/^\/+/, '')}`;
    } else {
      return null;
    }
  }

  try {
    const parsed = new URL(full);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.protocol === 'http:' && isAllowedStaticIperalHost(parsed.hostname)) {
      parsed.protocol = 'https:';
    }
    if (isPrivateOrLoopbackHost(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function extractImageFromUnknown(value: unknown, depth = 0): string | null {
  if (depth > 3 || value === null || value === undefined) return null;

  if (typeof value === 'string') {
    return normalizeCandidateUrl(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractImageFromUnknown(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const priorityKeys = [
      'large',
      'medium',
      'url',
      'src',
      'imageUrl',
      'imageURL',
      'imgUrl',
      'path',
      'href',
      'link',
      'small',
      'thumb',
      'thumbnail',
    ];
    for (const key of priorityKeys) {
      if (key in obj) {
        const found = extractImageFromUnknown(obj[key], depth + 1);
        if (found) return found;
      }
    }
  }

  return null;
}

function resolveRawProductImageUrl(product: Record<string, unknown>): string | null {
  const directFields = [
    'imageUrl',
    'imageURL',
    'image_url',
    'imgUrl',
    'imgURL',
    'img_url',
    'image',
    'img',
    'photo',
    'photoUrl',
    'picture',
    'pictureUrl',
    'thumbnail',
    'thumbnailUrl',
    'thumb',
    'thumbUrl',
    'smallImage',
    'mediumImage',
    'largeImage',
    'mainImage',
    'productImage',
    'urlImage',
    'media',
    'images',
    'pictures',
    'photos',
    'gallery',
  ];

  for (const field of directFields) {
    if (field in product) {
      const found = extractImageFromUnknown(product[field]);
      if (found) return found;
    }
  }

  for (const [key, val] of Object.entries(product)) {
    if (/img|image|photo|pict|thumb|media/i.test(key)) {
      const found = extractImageFromUnknown(val);
      if (found) return found;
    }
  }

  return null;
}

function registerVerifiedImageUrl(url: string | null): void {
  if (!url) return;
  if (verifiedProductImageUrls.size >= MAX_TRACKED_IMAGE_URLS) {
    verifiedProductImageUrls.clear();
  }
  verifiedProductImageUrls.add(url);
}

export function isAllowedImageProxyTarget(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return null;
    if (isPrivateOrLoopbackHost(parsed.hostname)) return null;

    if (
      isAllowedStaticIperalHost(parsed.hostname) ||
      verifiedProductImageUrls.has(parsed.toString())
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function buildRequestSignal(timeoutMs: number, externalSignal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!externalSignal) return timeoutSignal;
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([timeoutSignal, externalSignal]);
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (externalSignal.aborted) {
    controller.abort();
  } else {
    externalSignal.addEventListener('abort', onAbort, { once: true });
    timeoutSignal.addEventListener('abort', onAbort, { once: true });
  }
  return controller.signal;
}

type SharpFactory = (input: Buffer) => {
  rotate: () => ReturnType<SharpFactory>;
  resize: (opts: {
    width: number;
    height: number;
    fit: 'inside';
    withoutEnlargement: boolean;
  }) => ReturnType<SharpFactory>;
  webp: (opts: { quality: number; effort?: number }) => ReturnType<SharpFactory>;
  toBuffer: () => Promise<Buffer>;
};

let sharpFactoryPromise: Promise<SharpFactory | null> | null = null;

async function getSharpFactory(): Promise<SharpFactory | null> {
  if (!sharpFactoryPromise) {
    sharpFactoryPromise = import('sharp')
      .then((mod) => (mod.default as unknown as SharpFactory) || null)
      .catch(() => null);
  }
  return sharpFactoryPromise;
}

export async function fetchProxiedImage(
  targetUrl: URL,
  session: IperalSession | null,
  options?: { width?: number; preferWebp?: boolean },
): Promise<{ contentType: string; buffer: Buffer; etag: string } | null> {
  const headers: Record<string, string> = {
    accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    referer: `${BASE_URL}/`,
    'user-agent': DEFAULT_HEADERS['user-agent'],
  };

  if (session && isAllowedStaticIperalHost(targetUrl.hostname)) {
    headers.cookie = formatCookieHeader(session);
  }

  const response = await fetch(targetUrl.toString(), {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    return null;
  }

  const rawContentType = (response.headers.get('content-type') || 'image/jpeg')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!rawContentType.startsWith('image/')) {
    return null;
  }

  const rawBuffer: Buffer = Buffer.from(await response.arrayBuffer());
  let finalBuffer: Buffer = rawBuffer;
  let finalContentType = rawContentType;

  const isOptimizableRaster =
    rawContentType !== 'image/svg+xml' && rawContentType !== 'image/gif';
  const targetWidth =
    options?.width && Number.isFinite(options.width)
      ? Math.max(48, Math.min(800, Math.round(options.width)))
      : 360;
  const preferWebp = options?.preferWebp !== false;

  if (isOptimizableRaster && (preferWebp || targetWidth < 800)) {
    const sharp = await getSharpFactory();
    if (sharp) {
      try {
        let pipeline = sharp(rawBuffer).rotate().resize({
          width: targetWidth,
          height: targetWidth,
          fit: 'inside',
          withoutEnlargement: true,
        });
        if (preferWebp) {
          pipeline = pipeline.webp({ quality: 78, effort: 4 });
          finalContentType = 'image/webp';
        }
        const optimized = await pipeline.toBuffer();
        if (optimized.length > 0 && (preferWebp || optimized.length < rawBuffer.length)) {
          finalBuffer = optimized;
        }
      } catch {
        // Fallback to original bytes if sharp cannot decode this image format
      }
    }
  }

  const digest = crypto
    .createHash('sha256')
    .update(finalBuffer)
    .digest('hex')
    .slice(0, 24);

  return {
    contentType: finalContentType,
    buffer: finalBuffer,
    etag: `"${digest}"`,
  };
}

interface RawCategory {
  categoryId: number;
  name: string;
  categories?: RawCategory[] | null;
}

function simplifyCategory(category: RawCategory): SimplifiedCategory {
  const children = Array.isArray(category.categories) ? category.categories : [];
  return {
    categoryId: category.categoryId,
    name: category.name,
    children: children.map(simplifyCategory),
  };
}

export async function fetchCategories(
  session: IperalSession,
): Promise<SimplifiedCategory[]> {
  const response = await fetch(`${BASE_URL}/ebsn/api/category`, {
    method: 'GET',
    headers: buildHeaders(session),
    signal: AbortSignal.timeout(10000),
  });
  updateCookieJarFromResponse(session, response);

  if (!response.ok) {
    throw new Error(`Errore HTTP Iperal (${response.status}) nel recupero categorie.`);
  }

  const data = (await response.json()) as {
    response?: { status?: number | string; errorsMessage?: string };
    data?: { categories?: RawCategory[] };
  };

  if (data?.response?.status !== undefined && Number(data.response.status) !== 0) {
    throw new Error(
      `Errore Iperal: ${data?.response?.errorsMessage || 'Sessione non valida o scaduta.'}`,
    );
  }

  const categories = Array.isArray(data?.data?.categories) ? data.data.categories : [];
  return categories.map(simplifyCategory);
}

export async function fetchCategoryProducts(
  session: IperalSession,
  categoryId: number,
  sort = 'pri_um_asc',
  pageSize = 100,
  maxPages = 100,
  abortSignal?: AbortSignal,
): Promise<Record<string, unknown>[]> {
  const allProducts: Record<string, unknown>[] = [];
  const seenIds = new Set<string | number>();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= maxPages) {
    if (abortSignal?.aborted) {
      throw new DOMException('Richiesta annullata.', 'AbortError');
    }

    const url = new URL(`${BASE_URL}/ebsn/api/products`);
    url.searchParams.set('parent_category_id', String(categoryId));
    url.searchParams.set('page', String(page));
    url.searchParams.set('page_size', String(pageSize));
    url.searchParams.set('sort', sort);
    url.searchParams.set('promo', 'false');
    url.searchParams.set('hash', 'x');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: buildHeaders(session),
      signal: buildRequestSignal(12000, abortSignal),
    });
    updateCookieJarFromResponse(session, response);

    if (!response.ok) {
      throw new Error(
        `Errore HTTP Iperal (${response.status}) durante il recupero prodotti.`,
      );
    }

    const data = (await response.json()) as {
      response?: { status?: number | string; errorsMessage?: string };
      data?: {
        page?: { totPages?: number | string; totItems?: number | string } | null;
        products?: Record<string, unknown>[] | null;
      };
    };

    if (
      data?.response &&
      data.response.status !== undefined &&
      Number(data.response.status) !== 0
    ) {
      throw new Error(
        `Errore Iperal: ${data.response.errorsMessage || 'Impossibile caricare i prodotti.'}`,
      );
    }

    const payload = data?.data || {};
    const pageInfo = payload.page || {};
    const rawTotPages = Number(pageInfo.totPages || 0);
    const totItems = Number(pageInfo.totItems || 0);

    const batch = Array.isArray(payload.products) ? payload.products : [];
    if (batch.length === 0) {
      break;
    }

    if (rawTotPages > 0) {
      totalPages = rawTotPages;
    } else if (totItems > 0) {
      totalPages = Math.max(totalPages, Math.ceil(totItems / batch.length));
    }

    for (const product of batch) {
      const pid = (product.productId ?? product.id ?? product.code) as
        | string
        | number
        | undefined;
      if (pid !== undefined && pid !== null) {
        if (seenIds.has(pid)) {
          continue;
        }
        seenIds.add(pid);
      }

      const resolvedImageUrl = resolveRawProductImageUrl(product);
      registerVerifiedImageUrl(resolvedImageUrl);

      allProducts.push(
        resolvedImageUrl ? { ...product, _resolvedImageUrl: resolvedImageUrl } : product,
      );
    }

    if (totItems > 0 && allProducts.length >= totItems) {
      break;
    }

    page += 1;
    if (page > totalPages) {
      break;
    }
  }

  return allProducts;
}

export async function addProductsToCart(
  session: IperalSession,
  items: CartItemPayload[],
): Promise<Record<string, unknown>> {
  const url = new URL(`${BASE_URL}/ebsn/api/cart/add`);
  url.searchParams.set('show_sectors', 'true');

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: buildHeaders(session, true),
    body: JSON.stringify({ items }),
    signal: AbortSignal.timeout(15000),
  });
  updateCookieJarFromResponse(session, response);

  const rawText = await response.text();
  let data: ({
    response?: { status?: number | string; errorsMessage?: string };
    message?: string;
  } & Record<string, unknown>) | null = null;

  try {
    data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail =
      data?.response?.errorsMessage ||
      data?.message ||
      (rawText ? rawText.slice(0, 140) : '');
    throw new Error(
      `Errore HTTP Iperal (${response.status}) durante l'invio al carrello${detail ? `: ${detail}` : '.'}`,
    );
  }

  if (
    data?.response &&
    data.response.status !== undefined &&
    Number(data.response.status) !== 0
  ) {
    throw new Error(
      `Errore Iperal: ${data.response.errorsMessage || "Errore nell'aggiunta al carrello."}`,
    );
  }

  return data || { status: 'ok' };
}

export async function checkIperalAuth(
  session: IperalSession,
): Promise<{ valid: boolean; userId: number | null; message: string }> {
  const response = await fetch(`${BASE_URL}/ebsn/api/auth/test?operation=0`, {
    method: 'GET',
    headers: buildHeaders(session),
    signal: AbortSignal.timeout(10000),
  });
  updateCookieJarFromResponse(session, response);

  if (!response.ok) {
    return {
      valid: false,
      userId: null,
      message: `Iperal ha risposto con HTTP ${response.status}.`,
    };
  }

  try {
    const data = (await response.json()) as {
      user?: { userId?: number };
      data?: { user?: { userId?: number } };
    };
    const userId = data.user?.userId ?? data.data?.user?.userId ?? null;
    const valid = userId !== null && Number(userId) > -1;
    return {
      valid,
      userId: userId !== null ? Number(userId) : null,
      message: valid
        ? 'Sessione Iperal verificata e attiva.'
        : 'Sessione scaduta o non autenticata su Iperal.',
    };
  } catch {
    return {
      valid: false,
      userId: null,
      message: 'Risposta non valida durante la verifica sessione Iperal.',
    };
  }
}
