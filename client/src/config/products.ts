import type { ProductConfig } from '../types';

/**
 * Data source for product config.
 *
 * Zero-cost default: static JSON at `/data/products.json` (served with the
 * Vite build on Cloudflare Pages / Netlify / Vercel / GitHub Pages — no
 * backend required).
 *
 * Optional API mode: set `VITE_API_BASE_URL` to your Express origin ending
 * in `/api` (e.g. `https://api.example.com/api` or `http://localhost:3000/api`).
 */
const API_BASE_URL: string | undefined = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');

/** Vite `base` (always ends with `/`) — required for GitHub Pages subpaths. */
export function withBase(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = import.meta.env.BASE_URL || '/';
  const normalized = path.replace(/^\//, '');
  return `${base}${normalized}`;
}

const STATIC_CATALOG_URL = withBase('data/products.json');

/**
 * Fetches a single product's AR configuration by id.
 * Never hard-code product data in the AR engine — everything the
 * tracking/render pipeline needs comes from this object.
 */
export async function fetchProduct(productId: string): Promise<ProductConfig> {
  if (API_BASE_URL) {
    return fetchProductFromApi(productId);
  }
  return fetchProductFromStaticCatalog(productId);
}

async function fetchProductFromApi(productId: string): Promise<ProductConfig> {
  const response = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productId)}`);

  if (!response.ok) {
    throw new Error(
      `Không tải được cấu hình sản phẩm "${productId}" (HTTP ${response.status})`,
    );
  }

  const data = (await response.json()) as ProductConfig;
  validateProductConfig(data);
  return resolveProductAssets(data);
}

async function fetchProductFromStaticCatalog(productId: string): Promise<ProductConfig> {
  const response = await fetch(STATIC_CATALOG_URL);
  if (!response.ok) {
    throw new Error(`Không tải được catalog sản phẩm (HTTP ${response.status})`);
  }

  const products = (await response.json()) as ProductConfig[];
  if (!Array.isArray(products)) {
    throw new Error('Catalog sản phẩm không hợp lệ (cần là mảng JSON).');
  }

  const product = products.find((item) => item.id === productId);
  if (!product) {
    throw new Error(`Không tìm thấy sản phẩm: ${productId}`);
  }

  validateProductConfig(product);
  return resolveProductAssets(product);
}

/** Rewrite asset paths so GitHub Pages / subpath deploys still resolve. */
function resolveProductAssets(product: ProductConfig): ProductConfig {
  return {
    ...product,
    targetImage: withBase(product.targetImage),
    previewImage: withBase(product.previewImage),
    model: withBase(product.model),
  };
}

/** Basic runtime validation so a malformed catalog entry fails loudly. */
function validateProductConfig(product: Partial<ProductConfig>): asserts product is ProductConfig {
  const required: (keyof ProductConfig)[] = [
    'id',
    'name',
    'targetImage',
    'model',
    'physicalWidth',
  ];

  for (const key of required) {
    if (product[key] === undefined || product[key] === null) {
      throw new Error(`Cấu hình sản phẩm thiếu trường bắt buộc: "${key}"`);
    }
  }

  if (typeof product.physicalWidth !== 'number' || product.physicalWidth <= 0) {
    throw new Error('physicalWidth phải là số dương (đơn vị: mét)');
  }

  // Fill safe defaults so catalog entries can omit transform fields.
  product.scale ??= 1;
  product.position ??= { x: 0, y: 0, z: 0 };
  product.rotation ??= { x: 0, y: 0, z: 0 };
  product.previewImage ??= product.targetImage;
}

/**
 * Reads the product id from the current URL.
 * Supports both /ar/:id (via hosting rewrite) and ?product=:id (static hosting).
 * Also supports GitHub Pages subpaths: /web-ar/ar/:id
 */
export function getProductIdFromLocation(): string | null {
  const path = window.location.pathname;
  const match = path.match(/\/ar\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  const params = new URLSearchParams(window.location.search);
  return params.get('product');
}
