import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  addProductsToCart,
  checkIperalAuth,
  createSession,
  fetchCategories,
  fetchCategoryProducts,
  fetchProxiedImage,
  getSessionCacheKey,
  getSessionMaskedPreviews,
  isAllowedImageProxyTarget,
  parseCookieString,
  restoreSessionFromSnapshot,
  type CartItemPayload,
  type IperalSession,
  type SimplifiedCategory,
} from './server/iperalClient.ts';

const PORT = Number(process.env.PORT || 3000);
const CATALOG_CACHE_TTL_MS = 3 * 60 * 1000;
const MAX_PRODUCT_CACHE_ENTRIES = 80;
const IMAGE_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_IMAGE_CACHE_ENTRIES = 250;

const ALLOWED_SORTS = new Set([
  'pri_um_asc',
  'pri_um_desc',
  'pri_asc',
  'pri_desc',
  'name_asc',
  'relevance',
]);

interface CachedValue<T> {
  value: T;
  expiresAt: number;
}

const categoriesCache = new Map<string, CachedValue<SimplifiedCategory[]>>();
const productsCache = new Map<string, CachedValue<Record<string, unknown>[]>>();
const imageProxyCache = new Map<
  string,
  CachedValue<{ contentType: string; buffer: Buffer; etag: string }>
>();

function clearCatalogCaches(): void {
  categoriesCache.clear();
  productsCache.clear();
  imageProxyCache.clear();
}

function getCachedEntry<T>(
  cache: Map<string, CachedValue<T>>,
  key: string,
): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  // Refresh insertion order for LRU behavior
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

function setCachedEntry<T>(
  cache: Map<string, CachedValue<T>>,
  key: string,
  value: T,
  ttlMs: number,
  maxEntries: number,
): void {
  if (cache.has(key)) {
    cache.delete(key);
  }
  while (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

const SESSION_COOKIE_NAME = 'iperal_bridge_session';
const SESSION_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;
const EPHEMERAL_SESSION_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionEncryptionKey(): Buffer {
  const secretSource =
    (process.env.IPERAL_SESSION_SECRET || '').trim() ||
    (process.env.IPERAL_PROXY_API_KEY || '').trim() ||
    EPHEMERAL_SESSION_SECRET;
  return crypto.createHash('sha256').update(secretSource).digest();
}

function encryptSessionCookie(session: IperalSession): string {
  const payload = JSON.stringify({
    jsessionid: session.jsessionid,
    ebsnAccount: session.ebsnAccount,
    jar: Array.from(session.cookieJar.entries()),
    source: session.source,
  });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getSessionEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

function decryptSessionCookie(token: string): IperalSession | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [ivB64, tagB64, dataB64] = parts;
    if (!ivB64 || !tagB64 || !dataB64) return null;

    const iv = Buffer.from(ivB64, 'base64url');
    const authTag = Buffer.from(tagB64, 'base64url');
    const encrypted = Buffer.from(dataB64, 'base64url');

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getSessionEncryptionKey(),
      iv,
    );
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');

    const parsed = JSON.parse(decrypted) as {
      jsessionid?: unknown;
      ebsnAccount?: unknown;
      jar?: Array<[string, string]>;
      source?: 'env' | 'manual' | 'cookie';
    };
    if (
      typeof parsed.jsessionid !== 'string' ||
      typeof parsed.ebsnAccount !== 'string'
    ) {
      return null;
    }

    return restoreSessionFromSnapshot({
      jsessionid: parsed.jsessionid,
      ebsnAccount: parsed.ebsnAccount,
      jar: Array.isArray(parsed.jar) ? parsed.jar : undefined,
      source: parsed.source,
    });
  } catch {
    return null;
  }
}

function readCookieFromRequest(req: Request, name: string): string {
  const cookieHeader = req.header('cookie') || '';
  if (!cookieHeader) return '';
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const k = part.slice(0, eqIdx).trim();
    if (k === name) {
      return part.slice(eqIdx + 1).trim();
    }
  }
  return '';
}

function isSecureRequest(req: Request): boolean {
  const forwardedProto = (req.header('x-forwarded-proto') || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (forwardedProto) {
    return forwardedProto === 'https';
  }
  return Boolean(req.secure);
}

function setBridgeSessionCookie(
  req: Request,
  res: Response,
  session: IperalSession,
): void {
  const encrypted = encryptSessionCookie(session);
  const cookieAttrs = isSecureRequest(req)
    ? 'HttpOnly; Secure; SameSite=None; Partitioned'
    : 'HttpOnly; SameSite=Lax';
  res.append(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encrypted}; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE_SEC}; ${cookieAttrs}`,
  );
}

function clearBridgeSessionCookie(req: Request, res: Response): void {
  const cookieAttrs = isSecureRequest(req)
    ? 'HttpOnly; Secure; SameSite=None; Partitioned'
    : 'HttpOnly; SameSite=Lax';
  res.append(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; ${cookieAttrs}`,
  );
}

let currentSession: IperalSession | null = null;
try {
  currentSession = createSession(undefined, undefined, 'env');
} catch {
  currentSession = null;
}

function attachCookieUpdateHook(
  session: IperalSession,
  req: Request,
  res: Response,
): void {
  session.onCookiesUpdated = (updated) => {
    if (!res.headersSent) {
      setBridgeSessionCookie(req, res, updated);
    }
  };
}

function resolveActiveSession(req: Request): IperalSession | null {
  if (currentSession) return currentSession;

  const cookieToken = readCookieFromRequest(req, SESSION_COOKIE_NAME);
  if (cookieToken) {
    const restored = decryptSessionCookie(cookieToken);
    if (restored) {
      currentSession = restored;
      return currentSession;
    }
  }
  return null;
}

function getConfiguredApiKey(): string {
  return (process.env.IPERAL_PROXY_API_KEY || '').trim();
}

function extractProvidedApiKey(req: Request): string {
  const headerKey = req.header('x-api-key');
  if (headerKey) return headerKey.trim();

  const authHeader = req.header('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

function isApiKeyAuthorized(req: Request): boolean {
  const expected = getConfiguredApiKey();
  if (!expected) return true;

  const provided = extractProvidedApiKey(req);
  if (!provided) return false;

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  if (expectedBuf.length !== providedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!isApiKeyAuthorized(req)) {
    res.status(401).json({
      error: 'Chiave API del server non valida o mancante (header X-Api-Key).',
    });
    return;
  }
  next();
}

function isChromeExtensionOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return /^chrome-extension:\/\/[a-p]{32}$/i.test(origin.trim());
}

function handleExtensionCors(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const origin = req.header('origin');
  if (isChromeExtensionOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin!.trim());
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, X-Requested-With, X-Api-Key, Authorization',
    );
    if (req.method.toUpperCase() === 'OPTIONS') {
      res.status(204).end();
      return;
    }
  }
  next();
}

function verifyMutationCsrf(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }

  const origin = req.header('origin');
  const requestedWith = req.header('x-requested-with');
  if (requestedWith || isChromeExtensionOrigin(origin)) {
    next();
    return;
  }

  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      const expectedHost = (
        req.header('x-forwarded-host') ||
        req.header('host') ||
        ''
      )
        .split(',')[0]
        .trim()
        .toLowerCase();
      if (expectedHost && originHost === expectedHost) {
        next();
        return;
      }
    } catch {
      // Invalid origin URL falls through to rejection
    }
  }

  res.status(403).json({
    error: 'Richiesta non autorizzata (verifica Origin / X-Requested-With).',
  });
}

function requireIperalSession(req: Request, res: Response): IperalSession | null {
  const session = resolveActiveSession(req);
  if (!session) {
    res.status(401).json({
      error: 'Nessuna sessione Iperal attiva. Configura i cookie di sessione prima di continuare.',
    });
    return null;
  }
  attachCookieUpdateHook(session, req, res);
  return session;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', handleExtensionCors);
  app.use('/api', verifyMutationCsrf);

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/session', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const apiKeyRequired = Boolean(getConfiguredApiKey());
    const apiKeyAuthorized = isApiKeyAuthorized(req);
    const activeSession = resolveActiveSession(req);
    const masked = apiKeyAuthorized ? getSessionMaskedPreviews(activeSession) : {};

    res.json({
      authenticated: activeSession !== null,
      source: activeSession ? activeSession.source : 'none',
      apiKeyRequired,
      apiKeyAuthorized,
      persistedAcrossReload: activeSession !== null,
      ...masked,
    });
  });

  app.post('/api/session', requireApiKey, (req: Request, res: Response) => {
    const body = (req.body || {}) as {
      jsessionid?: unknown;
      ebsnAccount?: unknown;
      cookieString?: unknown;
    };

    let jsessionid = typeof body.jsessionid === 'string' ? body.jsessionid.trim() : '';
    let ebsnAccount = typeof body.ebsnAccount === 'string' ? body.ebsnAccount.trim() : '';

    if ((!jsessionid || !ebsnAccount) && typeof body.cookieString === 'string') {
      const parsed = parseCookieString(body.cookieString);
      if (parsed) {
        jsessionid = parsed.jsessionid;
        ebsnAccount = parsed.ebsnAccount;
      }
    }

    const existingSession = resolveActiveSession(req);
    if (existingSession) {
      if (!jsessionid) jsessionid = existingSession.jsessionid;
      if (!ebsnAccount) ebsnAccount = existingSession.ebsnAccount;
    }

    if (!jsessionid || !ebsnAccount) {
      res.status(400).json({
        error: 'JSESSIONID e X-Ebsn-Account sono entrambi obbligatori.',
      });
      return;
    }

    try {
      const created = createSession(jsessionid, ebsnAccount, 'manual');
      currentSession = created;
      clearCatalogCaches();
      setBridgeSessionCookie(req, res, created);
      res.json({
        status: 'ok',
        source: 'manual',
        ...getSessionMaskedPreviews(created),
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Credenziali sessione non valide.',
      });
    }
  });

  app.post('/api/session/check', requireApiKey, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const session = requireIperalSession(req, res);
    if (!session) return;

    try {
      const check = await checkIperalAuth(session);
      setBridgeSessionCookie(req, res, session);
      res.json({
        ...check,
        ...getSessionMaskedPreviews(session),
      });
    } catch (error) {
      res.status(502).json({
        valid: false,
        userId: null,
        message:
          error instanceof Error
            ? error.message
            : 'Errore nella verifica live con i server Iperal.',
      });
    }
  });

  app.delete('/api/session', requireApiKey, (req: Request, res: Response) => {
    currentSession = null;
    clearCatalogCaches();
    clearBridgeSessionCookie(req, res);
    res.json({ status: 'cleared' });
  });

  app.post('/api/cache/clear', requireApiKey, (_req: Request, res: Response) => {
    clearCatalogCaches();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'cleared' });
  });

  app.get('/api/categories', requireApiKey, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const session = requireIperalSession(req, res);
    if (!session) return;

    const forceRefresh = req.query.refresh === 'true' || req.query.refresh === '1';
    const cacheKey = getSessionCacheKey(session);

    if (!forceRefresh) {
      const cached = getCachedEntry(categoriesCache, cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.json(cached);
        return;
      }
    }

    try {
      const categories = await fetchCategories(session);
      setCachedEntry(
        categoriesCache,
        cacheKey,
        categories,
        CATALOG_CACHE_TTL_MS,
        10,
      );
      res.setHeader('X-Cache', 'MISS');
      res.json(categories);
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Errore nel recupero categorie Iperal.',
      });
    }
  });

  app.get('/api/products', requireApiKey, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const session = requireIperalSession(req, res);
    if (!session) return;

    const rawCategoryId = Number(req.query.category_id);
    if (!Number.isInteger(rawCategoryId) || rawCategoryId <= 0) {
      res.status(400).json({ error: 'Parametro category_id non valido o mancante.' });
      return;
    }

    const rawSort = typeof req.query.sort === 'string' ? req.query.sort : 'pri_um_asc';
    const sort = ALLOWED_SORTS.has(rawSort) ? rawSort : 'pri_um_asc';
    const forceRefresh = req.query.refresh === 'true' || req.query.refresh === '1';
    const cacheKey = `${getSessionCacheKey(session)}:${rawCategoryId}:${sort}`;

    if (!forceRefresh) {
      const cached = getCachedEntry(productsCache, cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.json(cached);
        return;
      }
    }

    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    try {
      const products = await fetchCategoryProducts(
        session,
        rawCategoryId,
        sort,
        100,
        100,
        abortController.signal,
      );
      if (abortController.signal.aborted || res.writableEnded) {
        return;
      }
      setCachedEntry(
        productsCache,
        cacheKey,
        products,
        CATALOG_CACHE_TTL_MS,
        MAX_PRODUCT_CACHE_ENTRIES,
      );
      res.setHeader('X-Cache', 'MISS');
      res.json(products);
    } catch (error) {
      if (
        abortController.signal.aborted ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        if (!res.writableEnded) res.status(499).end();
        return;
      }
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Errore nel recupero prodotti Iperal.',
      });
    }
  });

  app.post('/api/cart', requireApiKey, async (req: Request, res: Response) => {
    const session = requireIperalSession(req, res);
    if (!session) return;

    const body = (req.body || {}) as {
      items?: Array<{
        productId?: unknown;
        quantity?: unknown;
      }>;
    };

    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: 'Elenco articoli mancante o vuoto.' });
      return;
    }

    const mergedQuantities = new Map<number, number>();
    for (const item of body.items) {
      const productId = Number(item?.productId);
      const quantity = Number(item?.quantity);
      if (
        !Number.isInteger(productId) ||
        productId <= 0 ||
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        quantity > 99
      ) {
        res.status(400).json({
          error: 'Ogni articolo deve avere productId valido e quantity tra 1 e 99.',
        });
        return;
      }

      const prevQty = mergedQuantities.get(productId) || 0;
      mergedQuantities.set(productId, Math.min(99, prevQty + quantity));
    }

    const items: CartItemPayload[] = Array.from(mergedQuantities.entries()).map(
      ([productId, quantity]) => ({
        productId,
        quantity,
        infos: {
          accept_alternatives: false,
        },
      }),
    );

    try {
      const result = await addProductsToCart(session, items);
      res.json(result);
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : "Errore nell'invio al carrello Iperal.",
      });
    }
  });

  app.get('/api/image', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const targetUrl = isAllowedImageProxyTarget(rawUrl);
    if (!targetUrl) {
      res.status(400).json({ error: 'URL immagine non consentito.' });
      return;
    }

    const rawWidth = Number(req.query.w);
    const width =
      Number.isFinite(rawWidth) && rawWidth > 0
        ? Math.max(48, Math.min(800, Math.round(rawWidth)))
        : 360;
    const acceptHeader = (req.header('accept') || '').toLowerCase();
    const preferWebp =
      req.query.fmt === 'webp' ||
      (req.query.fmt !== 'orig' && acceptHeader.includes('image/webp'));

    const cacheKey = `${targetUrl.toString()}|w=${width}|webp=${preferWebp ? 1 : 0}`;
    let image = getCachedEntry(imageProxyCache, cacheKey);

    try {
      if (!image) {
        image = await fetchProxiedImage(targetUrl, resolveActiveSession(req), {
          width,
          preferWebp,
        });
        if (!image) {
          res.status(404).end();
          return;
        }
        setCachedEntry(
          imageProxyCache,
          cacheKey,
          image,
          IMAGE_CACHE_TTL_MS,
          MAX_IMAGE_CACHE_ENTRIES,
        );
      }

      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
      res.setHeader('Vary', 'Accept');
      res.setHeader('ETag', image.etag);

      const ifNoneMatch = req.header('if-none-match');
      if (ifNoneMatch && ifNoneMatch.includes(image.etag)) {
        res.status(304).end();
        return;
      }

      res.setHeader('Content-Type', image.contentType);
      res.setHeader('Content-Length', String(image.buffer.length));
      res.send(image.buffer);
    } catch {
      res.status(502).end();
    }
  });

  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint API non trovato.' });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve('dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(500).send('Build frontend mancante. Esegui npm run build.');
      }
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Spesa Smart server attivo su http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Avvio server fallito:', err);
  process.exit(1);
});
