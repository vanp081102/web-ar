import express from 'express';
import cors from 'cors';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = path.join(__dirname, 'data', 'products.json');
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN; // e.g. https://your-app.pages.dev

const app = express();
app.use(
  cors(
    CORS_ORIGIN
      ? { origin: CORS_ORIGIN.split(',').map((s) => s.trim()) }
      : undefined, // MVP/dev: allow all; set CORS_ORIGIN in production
  ),
);
app.use(express.json());

/**
 * MVP data layer: a single JSON file acting as the product catalog.
 * Optional — the client defaults to static /data/products.json for $0 hosting.
 * Swap this loader for a real DB later without touching route contracts.
 */
async function loadProducts() {
  const raw = await readFile(PRODUCTS_FILE, 'utf-8');
  return JSON.parse(raw);
}

async function getProductById(id) {
  const products = await loadProducts();
  return products.find((p) => p.id === id) ?? null;
}

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: `Không tìm thấy sản phẩm: ${req.params.id}` });
    }
    res.json(product);
  } catch (error) {
    console.error('GET /api/products/:id failed:', error);
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ.' });
  }
});

app.get('/api/products', async (_req, res) => {
  try {
    const products = await loadProducts();
    res.json(products.map(({ id, name, previewImage }) => ({ id, name, previewImage })));
  } catch (error) {
    console.error('GET /api/products failed:', error);
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ.' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`WebAR API server listening on http://localhost:${PORT}`);
});
