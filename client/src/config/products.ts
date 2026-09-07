import type { ProductConfig } from '../types';

/**
 * Data source for product config.
 *
 * Zero-cost default: static JSON at `/data/products.json`.
 * Optional API: set `VITE_API_BASE_URL` ending in `/api`.
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

function resolveProductAssets(product: ProductConfig): ProductConfig {
  return {
    ...product,
    targetImage: withBase(product.targetImage),
    previewImage: withBase(product.previewImage),
    model: product.model ? withBase(product.model) : undefined,
  };
}

function validateProductConfig(product: Partial<ProductConfig>): asserts product is ProductConfig {
  const required: (keyof ProductConfig)[] = ['id', 'name', 'targetImage', 'previewImage', 'physicalWidth'];

  for (const key of required) {
    if (product[key] === undefined || product[key] === null) {
      throw new Error(`Cấu hình sản phẩm thiếu trường bắt buộc: "${key}"`);
    }
  }

  if (typeof product.physicalWidth !== 'number' || product.physicalWidth <= 0) {
    throw new Error('physicalWidth phải là số dương (đơn vị: mét)');
  }

  product.display ??= product.model ? 'model' : 'image-3d';
  if (product.display === 'model' && !product.model) {
    throw new Error('display=model yêu cầu trường "model" (.glb)');
  }

  product.scale ??= 1;
  product.position ??= { x: 0, y: 0, z: 0 };
  product.rotation ??= { x: 0, y: 0, z: 0 };
}

/**
 * Reads the product id from the current URL.
 * Supports /ar/:id, GitHub Pages /web-ar/ar/:id, and ?product=:id.
 */
export function getProductIdFromLocation(): string | null {
  const path = window.location.pathname;
  const match = path.match(/\/ar\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  const params = new URLSearchParams(window.location.search);
  return params.get('product');
}
