import type { IperalProduct, RawIperalProduct, SortOption } from '../types/iperal';

const IPERAL_ORIGIN = 'https://www.iperalspesaonline.it';

function toNumber(value: unknown, depth = 0): number | null {
  if (depth > 2 || value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const cleaned = value
      .replace(/[€%\s]/g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.') return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const numericKeys = [
      'value',
      'amount',
      'price',
      'finalPrice',
      'sellingPrice',
      'promoPrice',
      'listPrice',
      'originalPrice',
      'val',
      'numericValue',
      'prezzo',
      'importo',
    ];
    for (const k of numericKeys) {
      if (k in obj) {
        const parsed = toNumber(obj[k], depth + 1);
        if (parsed !== null) return parsed;
      }
    }
  }
  return null;
}

function toCleanString(value: unknown, depth = 0): string {
  if (depth > 3 || value === null || value === undefined) return '';
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = toCleanString(item, depth + 1);
      if (candidate) return candidate;
    }
    return '';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const candidateKeys = [
      'name',
      'brandName',
      'brand',
      'description',
      'desc',
      'shortDescription',
      'label',
      'displayName',
      'title',
      'text',
      'textValue',
      'value',
      'val',
      'valore',
      'nome',
      'caption',
    ];
    for (const k of candidateKeys) {
      if (k in obj) {
        const str = toCleanString(obj[k], depth + 1);
        if (str) return str;
      }
    }
  }
  return '';
}

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function sanitizeImageUrl(rawUrl: unknown): string | null {
  const str = toCleanString(rawUrl);
  if (!str || /^data:|^javascript:/i.test(str)) return null;

  let full = str;
  if (full.startsWith('//')) {
    full = `https:${full}`;
  } else if (full.startsWith('/')) {
    full = `${IPERAL_ORIGIN}${full}`;
  } else if (!/^https?:\/\//i.test(full)) {
    if (/\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(full) || full.includes('/')) {
      full = `${IPERAL_ORIGIN}/${full.replace(/^\/+/, '')}`;
    } else {
      return null;
    }
  }

  try {
    const parsed = new URL(full);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      if (
        parsed.protocol === 'http:' &&
        (parsed.hostname.endsWith('iperalspesaonline.it') ||
          parsed.hostname.endsWith('iperal.it'))
      ) {
        parsed.protocol = 'https:';
      }
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function extractImageFromValue(value: unknown, depth = 0): string | null {
  if (depth > 3 || value === null || value === undefined) return null;

  if (typeof value === 'string') {
    return sanitizeImageUrl(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractImageFromValue(item, depth + 1);
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
        const found = extractImageFromValue(obj[key], depth + 1);
        if (found) return found;
      }
    }
  }

  return null;
}

function extractImageUrl(raw: RawIperalProduct): string | null {
  const directCandidates = [
    raw._resolvedImageUrl,
    raw.imageUrl,
    raw.imageURL,
    raw.image_url,
    raw.imgUrl,
    raw.imgURL,
    raw.img_url,
    raw.image,
    raw.img,
    raw.photo,
    raw.photoUrl,
    raw.picture,
    raw.pictureUrl,
    raw.thumbnail,
    raw.thumbnailUrl,
    raw.thumb,
    raw.thumbUrl,
    raw.smallImage,
    raw.mediumImage,
    raw.largeImage,
    raw.mainImage,
    raw.productImage,
    raw.urlImage,
    raw.media,
    raw.images,
    raw.pictures,
    raw.photos,
    raw.gallery,
  ];
  for (const candidate of directCandidates) {
    const url = extractImageFromValue(candidate);
    if (url) return url;
  }

  for (const [key, val] of Object.entries(raw)) {
    if (/img|image|photo|pict|thumb|media/i.test(key)) {
      const url = extractImageFromValue(val);
      if (url) return url;
    }
  }

  return null;
}

function normalizeUnitLabel(rawUnit: string): string {
  const u = rawUnit.toLowerCase().trim();
  if (!u) return 'kg';
  if (u === 'l' || u === 'lt' || u === 'litro' || u === 'litri') return 'L';
  if (u === 'kg' || u === 'chilogrammo' || u === 'kilo') return 'kg';
  if (u === 'pz' || u === 'pezzo' || u === 'pezzi') return 'pz';
  return rawUnit.trim();
}

function parseProductId(raw: RawIperalProduct): number | null {
  const candidates = [
    raw.productId,
    raw.id,
    raw.itemId,
    raw.idProduct,
    raw.code,
    raw.sku,
  ];
  for (const val of candidates) {
    if (typeof val === 'number' && Number.isInteger(val) && val > 0) {
      return val;
    }
    if (typeof val === 'string') {
      const parsed = Number.parseInt(val.trim(), 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return null;
}

const BRAND_KEY_REGEX =
  /brand|marca|marchio|producer|produttore|manufacturer|fabbricante|vendor|supplier|fornitore|trademark|brandline|pretitle|supertitle/i;

function scanObjectForBrand(
  node: unknown,
  depth = 0,
  seen = new Set<unknown>(),
): string {
  if (depth > 4 || node === null || node === undefined) return '';
  if (typeof node !== 'object') return '';
  if (seen.has(node)) return '';
  seen.add(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const entry = item as Record<string, unknown>;
        const labelCandidate = toCleanString(
          entry.name ?? entry.key ?? entry.code ?? entry.label ?? entry.type ?? entry.attribute,
        );
        if (labelCandidate && BRAND_KEY_REGEX.test(labelCandidate)) {
          const valCandidate = toCleanString(
            entry.value ?? entry.val ?? entry.valore ?? entry.description ?? entry.text,
          );
          if (valCandidate) return valCandidate;
        }
      }
      const nested = scanObjectForBrand(item, depth + 1, seen);
      if (nested) return nested;
    }
    return '';
  }

  const obj = node as Record<string, unknown>;
  for (const [key, val] of Object.entries(obj)) {
    if (BRAND_KEY_REGEX.test(key) && !/id$|code$/i.test(key)) {
      const text = toCleanString(val);
      if (text && !/^\d+$/.test(text)) return text;
    }
  }

  for (const [key, val] of Object.entries(obj)) {
    if (
      val &&
      typeof val === 'object' &&
      !/img|image|photo|pict|thumb|media|url/i.test(key)
    ) {
      const nested = scanObjectForBrand(val, depth + 1, seen);
      if (nested) return nested;
    }
  }

  return '';
}

function extractBrand(
  raw: RawIperalProduct,
  containers: Array<Record<string, unknown> | null>,
): string {
  const directCandidates: unknown[] = [
    raw.brand,
    raw.brandName,
    raw.brandDescription,
    raw.brandDesc,
    raw.marca,
    raw.marchio,
    raw.producer,
    raw.producerName,
    raw.produttore,
    raw.manufacturer,
    raw.manufacturerName,
    raw.fabbricante,
    raw.vendor,
    raw.supplier,
    raw.fornitore,
    raw.trademark,
    raw.brandLine,
    raw.preTitle,
    raw.superTitle,
  ];

  for (const container of containers) {
    if (!container) continue;
    directCandidates.push(
      container.brand,
      container.brandName,
      container.brandDescription,
      container.marca,
      container.marchio,
      container.producer,
      container.produttore,
      container.manufacturer,
      container.trademark,
    );
  }

  for (const candidate of directCandidates) {
    const clean = toCleanString(candidate);
    if (clean && !/^\d+$/.test(clean)) return clean;
  }

  return scanObjectForBrand(raw);
}

function parsePercentFromText(text: string): number | null {
  if (!text) return null;
  const match =
    text.match(/(?:sconto|promo|ribasso|risparmi[oa]?)\s*:?\s*-?\s*(\d{1,2})\s*%/i) ||
    text.match(/-\s*(\d{1,2})\s*%/) ||
    text.match(/^\s*(\d{1,2})\s*%\s*$/);
  if (match?.[1]) {
    const num = Number.parseInt(match[1], 10);
    if (num > 0 && num < 100) return num;
  }
  return null;
}

function parseEuroDiscountFromText(text: string): number | null {
  if (!text) return null;
  const match =
    text.match(
      /(?:sconto|risparmi[oa]?|taglio\s*prezzo|ribasso|-)\s*(?:di\s*)?€?\s*(\d+(?:[.,]\d{1,2})?)\s*€/i,
    ) ||
    text.match(
      /(?:sconto|risparmi[oa]?|taglio\s*prezzo|ribasso|-)\s*(?:di\s*)?€\s*(\d+(?:[.,]\d{1,2})?)/i,
    ) ||
    text.match(/€?\s*(\d+(?:[.,]\d{1,2})?)\s*€\s*(?:di\s+sconto|in\s+meno|off)/i) ||
    text.match(/€\s*(\d+(?:[.,]\d{1,2})?)\s*(?:di\s+sconto|in\s+meno|off)/i);
  if (match?.[1]) {
    const num = Number.parseFloat(match[1].replace(',', '.'));
    if (Number.isFinite(num) && num > 0) return num;
  }
  return null;
}

function parseStandaloneEuroInPromo(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed || !trimmed.includes('€')) return null;
  if (/\/\s*(kg|l|lt|pz|hg|g|ml)|\bal\s+(kg|litro|pz)/i.test(trimmed)) return null;
  const match = trimmed.match(/^-?\s*€?\s*(\d+(?:[.,]\d{1,2})?)\s*€?$/);
  if (match?.[1]) {
    const num = Number.parseFloat(match[1].replace(',', '.'));
    if (Number.isFinite(num) && num > 0) return num;
  }
  return null;
}

const PROMO_CONTAINER_REGEX =
  /^(promo|promos|active_?promo|active_?promos|applied_?promo|promo_?info|promo_?infos|promo_?detail|promo_?details|promotion|promotions|active_?promotions|applied_?promotions|promotion_?info|discount|discounts|sconto|sconti|offer|offers|campaign|campaigns|badge|badges|sticker|stickers|price_?info|price_?detail|price_?details)$/i;
const NON_DISCOUNT_KEY_REGEX =
  /vat|iva|tax|aliquota|alcohol|alcol|cacao|cocoa|fat|grassi|sugar|zuccher|weight|peso|margin|commission|fee/i;
const PERCENT_UNIT_REGEX = /percent|perc|pct|%/i;
const AMOUNT_UNIT_REGEX =
  /amount|euro|eur|fixed|\bfix\b|fisso|valore|importo|taglio|\babs\b|absolute|price|money|cash|flat|currency|€/i;

function scanForDiscountPercent(
  node: unknown,
  inPromoContext: boolean,
  depth = 0,
  seen = new Set<unknown>(),
): number | null {
  if (depth > 4 || node === null || node === undefined) return null;

  if (typeof node === 'string') {
    return inPromoContext ? parsePercentFromText(node) : null;
  }

  if (typeof node !== 'object') return null;
  if (seen.has(node)) return null;
  seen.add(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = scanForDiscountPercent(item, inPromoContext, depth + 1, seen);
      if (found !== null) return found;
    }
    return null;
  }

  const obj = node as Record<string, unknown>;
  const objUnitType = [
    obj.type,
    obj.discountType,
    obj.promoType,
    obj.kind,
    obj.unit,
    obj.measureUnit,
    obj.symbol,
    obj.currency,
    obj.discountUnit,
    obj.valueType,
  ]
    .filter((v) => typeof v === 'string')
    .join(' ');
  const objIsAmountType =
    AMOUNT_UNIT_REGEX.test(objUnitType) && !PERCENT_UNIT_REGEX.test(objUnitType);
  const objIsPercentType = PERCENT_UNIT_REGEX.test(objUnitType);

  for (const [key, val] of Object.entries(obj)) {
    if (NON_DISCOUNT_KEY_REGEX.test(key) || /id$|code$/i.test(key)) continue;

    if (typeof val === 'string' && val.includes('%')) {
      const pct = parsePercentFromText(val);
      if (pct !== null) return pct;
    }

    if (objIsAmountType) continue;

    const isExplicitPercentDiscountKey =
      /(?:discount|scont|promo|ribass|saving).*(?:percent|perc|pct)|(?:percent|perc).*(?:discount|scont)/i.test(
        key,
      );
    const isPromoPercentKey =
      inPromoContext &&
      (/^(percent|percentage|perc|pct)$/i.test(key) ||
        (objIsPercentType && /^(value|val|discount|sconto)$/i.test(key)));

    if (isExplicitPercentDiscountKey || isPromoPercentKey) {
      if (typeof val === 'number' || typeof val === 'string') {
        const num = toNumber(val);
        if (num !== null && num > 0) {
          if (num < 1 && PERCENT_UNIT_REGEX.test(key)) {
            const scaled = Math.round(num * 100);
            if (scaled > 0 && scaled < 100) return scaled;
          }
          const abs = Math.round(Math.abs(num));
          if (abs > 0 && abs < 100) {
            return abs;
          }
        }
      }
    }
  }

  for (const [key, val] of Object.entries(obj)) {
    if (
      NON_DISCOUNT_KEY_REGEX.test(key) ||
      /img|image|photo|pict|thumb|media|url/i.test(key)
    ) {
      continue;
    }
    const childContext = inPromoContext || PROMO_CONTAINER_REGEX.test(key);
    const found = scanForDiscountPercent(val, childContext, depth + 1, seen);
    if (found !== null) return found;
  }

  return null;
}

function scanForEuroDiscountAmount(
  node: unknown,
  inPromoContext: boolean,
  depth = 0,
  seen = new Set<unknown>(),
): number | null {
  if (depth > 4 || node === null || node === undefined) return null;

  if (typeof node === 'string') {
    return inPromoContext ? parseEuroDiscountFromText(node) : null;
  }

  if (typeof node !== 'object') return null;
  if (seen.has(node)) return null;
  seen.add(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = scanForEuroDiscountAmount(item, inPromoContext, depth + 1, seen);
      if (found !== null) return found;
    }
    return null;
  }

  const obj = node as Record<string, unknown>;
  const objUnitType = [
    obj.type,
    obj.discountType,
    obj.promoType,
    obj.kind,
    obj.unit,
    obj.measureUnit,
    obj.symbol,
    obj.currency,
    obj.discountUnit,
    obj.valueType,
  ]
    .filter((v) => typeof v === 'string')
    .join(' ');
  const objIsAmountType =
    AMOUNT_UNIT_REGEX.test(objUnitType) && !PERCENT_UNIT_REGEX.test(objUnitType);

  for (const [key, val] of Object.entries(obj)) {
    if (NON_DISCOUNT_KEY_REGEX.test(key)) continue;

    if (typeof val === 'string' && val.includes('€')) {
      const eur =
        parseEuroDiscountFromText(val) ??
        (inPromoContext && !/price|prezzo|um|unit|kg|litro/i.test(key)
          ? parseStandaloneEuroInPromo(val)
          : null);
      if (eur !== null) return eur;
    }

    const isExplicitEuroOffKey =
      /^(discount_?amount|amount_?off|sconto_?euro|discount_?euro|euro_?discount|saving_?amount)$/i.test(
        key,
      ) ||
      (inPromoContext &&
        objIsAmountType &&
        /^(value|val|discount|sconto|amount)$/i.test(key));

    if (isExplicitEuroOffKey) {
      const num = toNumber(val);
      if (num !== null && num > 0) return num;
    }
  }

  for (const [key, val] of Object.entries(obj)) {
    if (
      NON_DISCOUNT_KEY_REGEX.test(key) ||
      /img|image|photo|pict|thumb|media|url/i.test(key)
    ) {
      continue;
    }
    const childContext = inPromoContext || PROMO_CONTAINER_REGEX.test(key);
    const found = scanForEuroDiscountAmount(val, childContext, depth + 1, seen);
    if (found !== null) return found;
  }

  return null;
}

const PROMO_PRICE_KEY_REGEX =
  /^(final_?price|selling_?price|promo_?price|price_?promo|discounted_?price|price_?discounted|discount_?price|price_?discount|price_?with_?promo|price_?with_?discount|with_?discount_?price|price_?after_?discount|price_?after_?promo|after_?promo_?price|price_?in_?promo|in_?promo_?price|price_?on_?sale|on_?sale_?price|offer_?price|price_?offer|sale_?price|special_?price|reduced_?price|effective_?price|actual_?price|net_?price|current_?price|new_?price|best_?price|low_?price|lower_?price|min_?price|fidelity_?price|price_?fidelity|club_?price|price_?club|card_?price|price_?card|prezzo_?promo|prezzo_?scontato|prezzo_?finale|prezzo_?offerta|prezzo_?in_?offerta|prezzo_?netto|prezzo_?attuale|prezzo_?speciale|prezzo_?ridotto|prezzo_?fidelity|prezzo_?carta|amount_?after|final)$/i;
const LIST_PRICE_KEY_REGEX =
  /^(list_?price|original_?price|full_?price|old_?price|base_?price|gross_?price|standard_?price|regular_?price|price_?no_?promo|price_?before_?promo|price_?before_?discount|prezzo_?listino|prezzo_?barrato|crossed_?price|strike_?price|price_?orig|orig_?price)$/i;

function scanForPrices(
  node: unknown,
  inPromoContext: boolean,
  promoCandidates: number[],
  listCandidates: number[],
  depth = 0,
  seen = new Set<unknown>(),
): void {
  if (depth > 4 || node === null || node === undefined || typeof node !== 'object') {
    return;
  }
  if (seen.has(node)) return;
  seen.add(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      scanForPrices(item, inPromoContext, promoCandidates, listCandidates, depth + 1, seen);
    }
    return;
  }

  const obj = node as Record<string, unknown>;
  for (const [key, val] of Object.entries(obj)) {
    if (
      NON_DISCOUNT_KEY_REGEX.test(key) ||
      /^(um|unit)$/i.test(key) ||
      /price_?um|um_?price|per_?um|unit_?price|per_?kg|price_?kg|liter|litro|img|image|photo|url|id$/i.test(
        key,
      )
    ) {
      continue;
    }

    if (PROMO_PRICE_KEY_REGEX.test(key) || (inPromoContext && /^(price|prezzo|selling)$/i.test(key))) {
      const num = toNumber(val);
      if (num !== null && num > 0) promoCandidates.push(num);
    } else if (LIST_PRICE_KEY_REGEX.test(key)) {
      const num = toNumber(val);
      if (num !== null && num > 0) listCandidates.push(num);
    }

    if (val && typeof val === 'object') {
      const childPromoContext = inPromoContext || PROMO_CONTAINER_REGEX.test(key);
      scanForPrices(val, childPromoContext, promoCandidates, listCandidates, depth + 1, seen);
    }
  }
}

function extractPromoText(
  raw: RawIperalProduct,
  promoObj: Record<string, unknown> | null,
  infos: Record<string, unknown> | null,
): string {
  const candidates: unknown[] = [
    raw.promoDescription,
    raw.promoLabel,
    raw.discountLabel,
    raw.promoText,
    raw.badgeLabel,
    raw.offerLabel,
    infos?.promoDescription,
    infos?.promoLabel,
    infos?.discountLabel,
    promoObj?.promoDescription,
    promoObj?.promoLabel,
    promoObj?.discountLabel,
    promoObj?.description,
    promoObj?.label,
    promoObj?.text,
    promoObj?.title,
  ];
  for (const candidate of candidates) {
    const clean = toCleanString(candidate);
    if (clean) return clean;
  }
  return '';
}

function extractDiscountPercent(
  raw: RawIperalProduct,
  promoObj: Record<string, unknown> | null,
  infos: Record<string, unknown> | null,
  price: number | null,
  originalPrice: number | null,
): number | null {
  if (
    price !== null &&
    originalPrice !== null &&
    originalPrice > price + 0.009 &&
    originalPrice > 0
  ) {
    const pct = Math.round(((originalPrice - price) / originalPrice) * 100);
    if (pct > 0 && pct < 100) return pct;
  }

  const explicitPercentCandidates: unknown[] = [
    raw.discountPercentage,
    raw.discountPercent,
    raw.percentageDiscount,
    raw.promoPercentage,
    raw.promoPercent,
    infos?.discountPercentage,
    infos?.discountPercent,
    infos?.percentageDiscount,
    promoObj?.discountPercentage,
    promoObj?.discountPercent,
    promoObj?.percentageDiscount,
    promoObj?.percentage,
    promoObj?.percent,
  ];

  for (const candidate of explicitPercentCandidates) {
    const num = toNumber(candidate);
    if (num !== null && num > 0) {
      const abs = Math.round(Math.abs(num));
      if (abs > 0 && abs < 100) return abs;
    }
  }

  const promoStrings = [
    raw.sconto,
    infos?.sconto,
    promoObj?.sconto,
    raw.promoDescription,
    raw.promoLabel,
    raw.discountLabel,
    promoObj?.description,
    promoObj?.label,
  ];
  for (const candidate of promoStrings) {
    if (typeof candidate === 'string' && candidate.includes('%')) {
      const pct = parsePercentFromText(candidate);
      if (pct !== null) return pct;
    }
  }

  const deepFound = scanForDiscountPercent(raw, false);
  if (deepFound !== null) return deepFound;

  return null;
}

function isTruthyPromoValue(val: unknown, depth = 0): boolean {
  if (depth > 3 || val === null || val === undefined || val === false || val === 0) {
    return false;
  }
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val > 0;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return Boolean(s && s !== 'false' && s !== '0' && s !== 'no' && s !== 'null' && s !== 'none');
  }
  if (Array.isArray(val)) {
    return val.some((item) => isTruthyPromoValue(item, depth + 1));
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (obj.isPromo === false || obj.active === false || obj.enabled === false) {
      return false;
    }
    return Object.entries(obj).some(
      ([k, v]) =>
        !/^(id|code|type|kind|unit|measureUnit)$/i.test(k) &&
        isTruthyPromoValue(v, depth + 1),
    );
  }
  return false;
}

function collectRawTextTokens(
  node: unknown,
  depth = 0,
  seen = new Set<unknown>(),
): string[] {
  if (depth > 4 || node === null || node === undefined) return [];
  if (typeof node === 'string') {
    const trimmed = node.trim();
    return trimmed && !/^https?:\/\//i.test(trimmed) ? [trimmed] : [];
  }
  if (typeof node === 'number' && Number.isFinite(node)) {
    return [String(node)];
  }
  if (typeof node !== 'object' || seen.has(node)) return [];
  seen.add(node);

  const collected: string[] = [];
  if (Array.isArray(node)) {
    for (const item of node) {
      collected.push(...collectRawTextTokens(item, depth + 1, seen));
    }
    return collected;
  }

  for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
    if (
      key.startsWith('_') ||
      /img|image|photo|url|media|thumb|picture|href|link/i.test(key)
    ) {
      continue;
    }
    collected.push(...collectRawTextTokens(val, depth + 1, seen));
  }
  return collected;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
    return value[0] as Record<string, unknown>;
  }
  return null;
}

function firstValidNumber(candidates: unknown[]): number | null {
  for (const c of candidates) {
    const num = toNumber(c);
    if (num !== null && num > 0) return num;
  }
  return null;
}

export function normalizeIperalProduct(
  raw: RawIperalProduct,
  categoryName?: string,
): IperalProduct | null {
  const idNum = parseProductId(raw);
  if (idNum === null) {
    return null;
  }

  const infos = asRecord(raw.infos) ?? asRecord(raw.info) ?? asRecord(raw.productInfos);
  const pricing =
    asRecord(raw.pricing) ??
    asRecord(raw.prices) ??
    asRecord(raw.priceInfo) ??
    asRecord(raw.priceDetail);
  const promoObj = asRecord(raw.promo) ?? asRecord(raw.promotions) ?? asRecord(raw.offer);
  const detailsObj = asRecord(raw.details);
  const containers = [infos, pricing, promoObj, detailsObj];

  const name =
    toCleanString(raw.name) ||
    toCleanString(raw.productName) ||
    toCleanString(raw.description) ||
    toCleanString(raw.shortDescription) ||
    toCleanString(raw.longDescription) ||
    toCleanString(raw.title) ||
    `Prodotto #${idNum}`;

  const rawDescription =
    toCleanString(raw.description) ||
    toCleanString(raw.shortDescription) ||
    toCleanString(raw.subDescription) ||
    toCleanString(raw.longDescription) ||
    toCleanString(infos?.description) ||
    toCleanString(infos?.shortDescription) ||
    toCleanString(detailsObj?.description);
  const description =
    rawDescription && rawDescription !== name ? rawDescription : undefined;

  const brand = extractBrand(raw, containers);

  const deepPromoPrices: number[] = [];
  const deepListPrices: number[] = [];
  scanForPrices(raw, false, deepPromoPrices, deepListPrices);

  const promoOrSellingPrice =
    firstValidNumber([
      raw.finalPrice,
      raw.sellingPrice,
      raw.promoPrice,
      raw.pricePromo,
      raw.promo_price,
      raw.price_promo,
      raw.discountedPrice,
      raw.discounted_price,
      raw.priceDiscounted,
      raw.priceDiscount,
      raw.priceWithPromo,
      raw.offerPrice,
      raw.salePrice,
      raw.specialPrice,
      raw.netPrice,
      raw.currentPrice,
      raw.fidelityPrice,
      pricing?.finalPrice,
      pricing?.sellingPrice,
      pricing?.promoPrice,
      pricing?.pricePromo,
      pricing?.discountedPrice,
      promoObj?.price,
      promoObj?.promoPrice,
      promoObj?.pricePromo,
      promoObj?.finalPrice,
      promoObj?.discountedPrice,
      infos?.promoPrice,
      infos?.pricePromo,
      infos?.finalPrice,
    ]) ?? (deepPromoPrices.length > 0 ? Math.min(...deepPromoPrices) : null);

  const baseOrListPrice =
    firstValidNumber([
      raw.listPrice,
      raw.list_price,
      raw.originalPrice,
      raw.original_price,
      raw.fullPrice,
      raw.full_price,
      raw.oldPrice,
      raw.basePrice,
      raw.grossPrice,
      raw.standardPrice,
      raw.regularPrice,
      raw.priceNoPromo,
      raw.priceBeforePromo,
      raw.prezzoListino,
      raw.prezzoBarrato,
      raw.crossedPrice,
      raw.strikePrice,
      pricing?.listPrice,
      pricing?.originalPrice,
      pricing?.fullPrice,
      pricing?.oldPrice,
      pricing?.basePrice,
      promoObj?.originalPrice,
      promoObj?.listPrice,
      infos?.originalPrice,
      infos?.listPrice,
    ]) ?? (deepListPrices.length > 0 ? Math.max(...deepListPrices) : null);

  const rawMainPrice = firstValidNumber([
    raw.price,
    raw.prezzo,
    pricing?.price,
    infos?.price,
  ]);

  const rawDisplayPrice = firstValidNumber(
    [
      raw.priceDisplay,
      raw.displayPrice,
      raw.priceFormatted,
      pricing?.priceDisplay,
      pricing?.displayPrice,
      infos?.priceDisplay,
    ].filter(
      (v) =>
        typeof v !== 'string' ||
        !/\/\s*(kg|l|lt|pz|hg|g|ml)|\bal\s+(kg|litro|pz)/i.test(v),
    ),
  );

  const effectivePromoPrice =
    promoOrSellingPrice ??
    (rawDisplayPrice !== null &&
    rawMainPrice !== null &&
    rawDisplayPrice < rawMainPrice - 0.009
      ? rawDisplayPrice
      : null);

  let price: number | null = effectivePromoPrice ?? rawMainPrice ?? baseOrListPrice;
  let originalPrice: number | null = baseOrListPrice;
  let appliedEuroDiscount = false;

  if (
    effectivePromoPrice !== null &&
    rawMainPrice !== null &&
    effectivePromoPrice < rawMainPrice - 0.009 &&
    (originalPrice === null || rawMainPrice > originalPrice)
  ) {
    price = effectivePromoPrice;
    originalPrice = rawMainPrice;
  }

  if (
    price !== null &&
    effectivePromoPrice === null &&
    (originalPrice === null || Math.abs(originalPrice - price) < 0.01)
  ) {
    const euroDiscount = scanForEuroDiscountAmount(raw, false);
    if (euroDiscount !== null && euroDiscount > 0.01 && euroDiscount < price - 0.01) {
      originalPrice = price;
      price = Number((price - euroDiscount).toFixed(2));
      appliedEuroDiscount = true;
    }
  }

  if (originalPrice !== null && price !== null && originalPrice <= price + 0.009) {
    originalPrice = null;
  }

  const rawUnit =
    toCleanString(raw.um) ||
    toCleanString(raw.unitOfMeasure) ||
    toCleanString(raw.priceUmUnit) ||
    toCleanString(raw.umDescription) ||
    toCleanString(pricing?.um) ||
    toCleanString(infos?.um) ||
    'kg';
  const unitLabel = normalizeUnitLabel(rawUnit);

  const splitWeightVal =
    toNumber(raw.umQty) ??
    toNumber(raw.umQuantity) ??
    toNumber(raw.umValue) ??
    toNumber(raw.weightValue) ??
    toNumber(raw.netWeightValue) ??
    toNumber(raw.sizeValue) ??
    toNumber(raw.peso) ??
    toNumber(raw.grammage) ??
    toNumber(infos?.umQty) ??
    toNumber(infos?.weight);
  const splitWeightUnit =
    toCleanString(raw.weightUm) ||
    toCleanString(raw.weightUnit) ||
    toCleanString(raw.sizeUm) ||
    toCleanString(raw.sizeUnit) ||
    toCleanString(raw.qtyUm) ||
    toCleanString(raw.quantityUm) ||
    toCleanString(raw.sellUm) ||
    toCleanString(raw.shortUm) ||
    toCleanString(infos?.weightUm) ||
    '';

  const packaging =
    toCleanString(raw.packaging) ||
    toCleanString(raw.packagingDescription) ||
    toCleanString(raw.packagingLabel) ||
    toCleanString(raw.weightLabel) ||
    toCleanString(raw.displayWeight) ||
    toCleanString(raw.weight) ||
    toCleanString(raw.netWeight) ||
    toCleanString(raw.format) ||
    toCleanString(raw.formato) ||
    toCleanString(raw.pezzatura) ||
    toCleanString(raw.grammatura) ||
    toCleanString(raw.confezione) ||
    toCleanString(raw.size) ||
    toCleanString(raw.sizeDescription) ||
    toCleanString(raw.quantityDescription) ||
    toCleanString(raw.measure) ||
    toCleanString(raw.netContent) ||
    toCleanString(raw.subTitle) ||
    toCleanString(raw.subtitle) ||
    toCleanString(infos?.packaging) ||
    toCleanString(infos?.weight) ||
    toCleanString(infos?.format) ||
    toCleanString(infos?.size) ||
    toCleanString(infos?.quantityDescription) ||
    toCleanString(detailsObj?.packaging) ||
    toCleanString(detailsObj?.weight) ||
    (splitWeightVal !== null && splitWeightVal > 0 && splitWeightUnit
      ? `${splitWeightUnit} ${splitWeightVal}`
      : '');

  const parsePackSizeInBaseUnit = (text: string): number | null => {
    if (!text) return null;
    const isLiquid = unitLabel === 'L';
    const isWeight = unitLabel === 'kg';

    const convert = (numStr: string, unitStr: string): number | null => {
      const val = Number.parseFloat(numStr.replace(',', '.'));
      if (!Number.isFinite(val) || val <= 0) return null;
      const u = unitStr.toLowerCase();
      if (u === 'kg') return isLiquid ? null : val;
      if (u === 'g' || u === 'gr') return isLiquid ? null : val / 1000;
      if (u === 'l' || u === 'lt') return isWeight ? null : val;
      if (u === 'ml') return isWeight ? null : val / 1000;
      if (u === 'cl') return isWeight ? null : val / 100;
      return null;
    };

    const multi = text.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|gr?|lt?|ml|cl)\b/i);
    if (multi?.[1] && multi[2] && multi[3]) {
      const count = Number.parseInt(multi[1], 10);
      const single = convert(multi[2], multi[3]);
      if (count > 0 && single !== null) return count * single;
    }

    const prefixUnit = text.match(/\b(kg|gr?|lt?|ml|cl)\s+(\d+(?:[.,]\d+)?)\b/i);
    if (prefixUnit?.[1] && prefixUnit[2]) {
      const converted = convert(prefixUnit[2], prefixUnit[1]);
      if (converted !== null) return converted;
    }

    const suffixUnit = text.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|gr?|lt?|ml|cl)\b/i);
    if (suffixUnit?.[1] && suffixUnit[2]) {
      const converted = convert(suffixUnit[1], suffixUnit[2]);
      if (converted !== null) return converted;
    }

    return null;
  };

  const explicitPromoPriceUm = firstValidNumber([
    raw.promoPriceUm,
    raw.priceUmPromo,
    raw.discountedPriceUm,
    raw.priceUmDiscounted,
    raw.priceUmWithPromo,
    raw.priceUmAfterDiscount,
    raw.finalPriceUm,
    raw.sellingPriceUm,
    raw.offerPriceUm,
    raw.priceUmOffer,
    raw.fidelityPriceUm,
    raw.priceUmFidelity,
    raw.promo_price_um,
    raw.price_um_promo,
    pricing?.promoPriceUm,
    pricing?.priceUmPromo,
    pricing?.discountedPriceUm,
    infos?.promoPriceUm,
    infos?.priceUmPromo,
    promoObj?.priceUm,
    promoObj?.priceUmPromo,
  ]);

  let priceUm =
    explicitPromoPriceUm ??
    toNumber(raw.priceUm) ??
    toNumber(raw.pricePerUm) ??
    toNumber(raw.unitPrice) ??
    toNumber(raw.umPrice) ??
    toNumber(raw.priceKg) ??
    toNumber(pricing?.priceUm) ??
    toNumber(pricing?.unitPrice) ??
    toNumber(infos?.priceUm);

  if (
    explicitPromoPriceUm === null &&
    priceUm !== null &&
    price !== null &&
    originalPrice !== null &&
    originalPrice > price + 0.009
  ) {
    const packSize =
      parsePackSizeInBaseUnit(packaging) ??
      parsePackSizeInBaseUnit(description || '') ??
      parsePackSizeInBaseUnit(name);

    if (packSize !== null && packSize > 0) {
      const expectedFullUm = originalPrice / packSize;
      const expectedPromoUm = price / packSize;
      if (
        Math.abs(priceUm - expectedFullUm) < Math.abs(priceUm - expectedPromoUm)
      ) {
        priceUm = Number(expectedPromoUm.toFixed(2));
      }
    } else {
      const STANDARD_PACK_SIZES = [
        0.05, 0.08, 0.1, 0.125, 0.15, 0.175, 0.2, 0.25, 0.3, 0.33, 0.35, 0.4, 0.45,
        0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 1, 1.2, 1.25, 1.5, 1.75, 2, 2.5,
        3, 4, 5, 6,
      ];
      const snapStandard = (val: number): number | null => {
        for (const std of STANDARD_PACK_SIZES) {
          if (Math.abs(val - std) / std <= 0.015) return std;
        }
        return null;
      };
      const snapPromo = snapStandard(price / priceUm);
      const snapFull = snapStandard(originalPrice / priceUm);

      if (snapPromo !== null && snapFull === null) {
        // priceUm already reflects the discounted price
      } else if (snapFull !== null && snapPromo === null) {
        priceUm = Number((price / snapFull).toFixed(2));
      } else if (appliedEuroDiscount || Math.abs(priceUm - originalPrice) < 0.02 || snapFull !== null || snapPromo === null) {
        priceUm = Number((priceUm * (price / originalPrice)).toFixed(2));
      }
    }
  }

  const discountPercent = extractDiscountPercent(
    raw,
    promoObj,
    infos,
    price,
    originalPrice,
  );

  const hasExplicitPromoFlag =
    isTruthyPromoValue(raw.isPromo) ||
    isTruthyPromoValue(raw.inPromo) ||
    isTruthyPromoValue(raw.onSale) ||
    isTruthyPromoValue(raw.discounted) ||
    isTruthyPromoValue(raw.promo) ||
    isTruthyPromoValue(raw.promotions);

  const isPromoFlag = Boolean(
    hasExplicitPromoFlag ||
      discountPercent !== null ||
      (originalPrice !== null && price !== null && originalPrice > price + 0.009),
  );

  const promoLabel =
    extractPromoText(raw, promoObj, infos) ||
    (discountPercent !== null
      ? `Sconto ${discountPercent}%`
      : isPromoFlag
        ? 'In offerta'
        : '');

  const inStock =
    raw.available !== undefined
      ? Boolean(raw.available)
      : raw.inStock !== undefined
        ? Boolean(raw.inStock)
        : true;

  const rawTokens = collectRawTextTokens(raw);
  const searchText = normalizeSearchText(
    [name, description || '', brand, packaging, promoLabel, categoryName || '', ...rawTokens].join(
      ' ',
    ),
  );

  return {
    productId: idNum,
    name,
    description,
    brand,
    price,
    originalPrice,
    discountPercent,
    priceUm,
    unitLabel: normalizeUnitLabel(rawUnit),
    packaging,
    imageUrl: extractImageUrl(raw),
    isPromo: isPromoFlag,
    promoLabel: promoLabel || null,
    inStock,
    categoryName,
    searchText,
  };
}

export function sortNormalizedProducts(
  products: IperalProduct[],
  sortBy: SortOption,
): IperalProduct[] {
  const copy = [...products];
  switch (sortBy) {
    case 'pri_um_asc':
      return copy.sort((a, b) => {
        const au = a.priceUm ?? Number.POSITIVE_INFINITY;
        const bu = b.priceUm ?? Number.POSITIVE_INFINITY;
        if (au !== bu) return au - bu;
        return (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY);
      });
    case 'pri_um_desc':
      return copy.sort((a, b) => {
        const au = a.priceUm ?? -1;
        const bu = b.priceUm ?? -1;
        return bu - au;
      });
    case 'pri_asc':
      return copy.sort(
        (a, b) =>
          (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY),
      );
    case 'pri_desc':
      return copy.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    case 'name_asc':
      return copy.sort((a, b) => a.name.localeCompare(b.name, 'it'));
    default:
      return copy;
  }
}
