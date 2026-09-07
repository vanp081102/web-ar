# WebAR MVP — Image Target Tracking trên Safari iPhone

Hệ thống WebAR chạy 100% trong Safari (không app, không Flutter): quét QR → mở
website → xin quyền Camera → nhận diện hình ảnh 2D trên bao bì (Image Target)
→ hiển thị và bám theo model `.glb` theo thời gian thực.

---

## 1. Kiến trúc

```
web-ar/
├── client/                     # Vite + TypeScript + Three.js + MindAR
│   ├── index.html
│   ├── src/
│   │   ├── main.ts             # bootstrap: product → permission → AR → HUD
│   │   ├── types.ts
│   │   ├── mind-ar.d.ts        # type declaration cho mind-ar (chưa có @types chính thức)
│   │   ├── ar/
│   │   │   ├── ARManager.ts          # vòng đời MindAR + Three.js render loop
│   │   │   ├── ImageTargetManager.ts # 1 anchor = 1 target: load/show/hide/dispose model
│   │   │   ├── ModelManager.ts       # GLTFLoader + Draco + cache + dispose GPU resources
│   │   │   └── CameraManager.ts      # capability check + phân loại lỗi permission
│   │   ├── ui/
│   │   │   ├── LoadingScreen.ts
│   │   │   ├── PermissionScreen.ts   # gồm cả màn hình "unsupported"
│   │   │   └── ARControls.ts         # HUD: trạng thái tracking + CTA
│   │   └── config/
│   │       └── products.ts     # static catalog ($0) hoặc Express API
│   └── public/
│       ├── data/products.json  # catalog static — không cần backend
│       ├── models/*.glb
│       └── targets/*.jpg|png + *.mind
└── server/                     # Express tuỳ chọn (bật bằng VITE_API_BASE_URL)
    ├── server.js
    └── data/products.json
```

**Vì sao tách như vậy:** `ARManager` chỉ biết về vòng đời engine (start/stop,
render loop). `ImageTargetManager` chỉ biết về *một* target cụ thể (found/lost,
model attach). `ModelManager` chỉ biết về loading/dispose GLTF. Nhờ vậy khi mở
rộng lên nhiều target đồng thời (`maxTrack > 1`), bạn chỉ cần tạo nhiều
`ImageTargetManager` — không phải sửa `ARManager` hay `ModelManager`.

---

## 2. Vì sao chọn MindAR thay vì 8th Wall

| | MindAR | 8th Wall |
|---|---|---|
| Giấy phép | Mã nguồn mở, miễn phí | Thương mại, tính phí theo view/tháng |
| Kỹ thuật | `getUserMedia` + WebGL + TensorFlow.js (Web Worker) | SLAM riêng, đóng gói SDK |
| Hỗ trợ iOS Safari | Có — **không cần WebXR** | Có |
| Image Target Tracking | Có (tính năng lõi) | Có |

Lý do quyết định: **Safari trên iPhone chưa hỗ trợ WebXR Device API** cho
`immersive-ar` (đã kiểm tra tại thời điểm viết tài liệu này). Bất kỳ giải
pháp nào dựa vào WebXR sẽ không chạy được trên Safari. MindAR **không** dùng
WebXR — nó tự chạy computer vision (feature matching) trên video từ
`getUserMedia`, nên hoạt động trên Safari iOS bình thường. 8th Wall cũng làm
tương tự (SLAM riêng, không cần WebXR) nên về mặt kỹ thuật cũng khả thi, nhưng
**yêu cầu license trả phí** cho production — trong khi MindAR miễn phí, mã
nguồn mở, và vẫn đang được duy trì. Vì vậy MVP này chọn MindAR để đáp ứng yêu
cầu "phải nói rõ nếu thư viện tính phí và đề xuất lựa chọn miễn phí".

Nếu sau này cần độ chính xác tracking cao hơn, nhiều target cùng lúc với hiệu
năng tốt hơn, hoặc SLAM 6DoF đầy đủ (world tracking, không chỉ image target),
8th Wall là lựa chọn nâng cấp hợp lý — nhưng cần ngân sách license.

---

## 3. Chi phí = 0 (mặc định)

Stack này **không cần trả phí thư viện AR** và **không bắt buộc backend**:

| Thành phần | Lựa chọn $0 | Ghi chú |
|---|---|---|
| Image tracking | **MindAR** (open-source) | Không dùng 8th Wall (tính phí theo view) |
| Render 3D | **Three.js** | MIT |
| Catalog sản phẩm | `client/public/data/products.json` | Client tự fetch — không cần Express |
| Hosting | Cloudflare Pages / Netlify / Vercel free | HTTPS sẵn, bắt buộc cho Camera |
| QR | Công cụ online / `npx qrcode` | Chỉ encode URL |

`server/` Express vẫn có sẵn nếu sau này bạn muốn API động — bật bằng
`VITE_API_BASE_URL`. Mặc định **không set** biến này → chạy thuần static.

---

## 4. Dependencies

**Client**
- `three` — render engine 3D
- `mind-ar` — image tracking engine (open-source)
- `vite`, `typescript`, `vite-plugin-mkcert` (HTTPS local dev)

**Server (tuỳ chọn)**
- `express`, `cors`

Không cần database ở MVP — JSON là data store.

> **Windows tip:** `mind-ar` kéo theo native package `canvas` (chỉ dùng khi
> compile target phía Node). Project đã `overrides` để bỏ qua nó; nếu
> `npm install` vẫn lỗi native build, chạy `npm install --ignore-scripts`.

---

## 5. Cài đặt

```bash
# Client (đủ để chạy MVP $0)
cd web-ar/client
npm install

# Server (tuỳ chọn — chỉ khi dùng VITE_API_BASE_URL)
cd ../server
npm install
```

---

## 6. Thêm một Image Target mới

1. Chuẩn bị ảnh gốc in trên bao bì, ví dụ `product-002.jpg`:
   - nhiều feature points (hoa văn, chi tiết — không phải mảng màu phẳng)
   - độ tương phản tốt, tránh vùng phản sáng/bóng gương
   - đặt vào `client/public/targets/product-002.jpg`
2. Biên dịch ảnh thành file `.mind` bằng công cụ chính thức của MindAR
   (chạy ngay trên trình duyệt, không cần cài gì):
   https://hiukim.github.io/mind-ar-js-doc/tools/compile
3. Tải file `.mind` về, đặt vào `client/public/targets/product-002.mind`.
4. Đo kích thước thật của ảnh in trên bao bì (mét) — dùng cho
   `physicalWidth`.

## 7. Thêm một model `.glb`

1. Export model từ Blender/Maya/… ở định dạng `.glb` (khuyến khích bật nén
   Draco nếu công cụ hỗ trợ).
2. Đặt vào `client/public/models/product-002.glb`.
3. Giữ dưới ~5MB, texture ≤ 2048×2048 để load nhanh trên mobile.

## 8. Thêm sản phẩm mới vào catalog

Chỉ cần thêm một object JSON vào **`client/public/data/products.json`**
(và mirror sang `server/data/products.json` nếu bạn dùng API) — **không cần
sửa code AR**:

```json
{
  "id": "product-002",
  "name": "Tên sản phẩm",
  "targetImage": "/targets/product-002.mind",
  "previewImage": "/targets/product-002.jpg",
  "model": "/models/product-002.glb",
  "physicalWidth": 0.12,
  "scale": 1,
  "position": { "x": 0, "y": 0.03, "z": 0 },
  "rotation": { "x": 0, "y": 0, "z": 0 }
}
```

Đây chính là cách hệ thống hỗ trợ **100+ sản phẩm** mà không cần build lại
client: mỗi QR trỏ đến `/ar/:id`, client đọc catalog (static JSON hoặc
`GET /api/products/:id`), và `ARManager` nhận toàn bộ transform/model/target
từ response — không có gì hard-code.

Repo đã kèm **demo** `product-001` (MindAR card sample + Khronos Duck) để
smoke-test ngay. In ảnh `client/public/targets/product-001.png` ra giấy để
test tracking.

## 9. Tạo QR Code

QR **không phải** Image Target — nó chỉ chứa URL:

```
https://your-domain.com/ar/product-001
```

Dùng bất kỳ công cụ tạo QR nào (ví dụ `qrcode` npm package, hoặc trang tạo
QR online) để encode URL này. Camera mặc định của iPhone tự nhận diện QR và
mở Safari — không cần code thêm gì phía client cho bước này.

Ví dụ script nhanh nếu muốn tạo QR bằng Node:

```bash
npx qrcode "https://your-domain.com/ar/product-001" -o product-001-qr.png
```

## 10. Chạy local với HTTPS (bắt buộc để test Camera trên iPhone thật)

Safari chỉ cấp quyền Camera (`getUserMedia`) trong "secure context" — nghĩa
là HTTPS hợp lệ hoặc `localhost`. `vite.config.ts` đã cấu hình
`vite-plugin-mkcert` để tự tạo chứng chỉ HTTPS local:

```bash
# MVP $0 — chỉ cần frontend (catalog static)
cd web-ar/client
npm run dev

# Mở: https://<LAN-IP>:5173/ar/product-001
# hoặc: https://localhost:5173/?product=product-001
```

Tuỳ chọn — chạy Express API song song:

```bash
# Terminal 1
cd web-ar/server && npm run dev

# Terminal 2 — tạo client/.env với:
# VITE_API_BASE_URL=http://localhost:3000/api
cd web-ar/client && npm run dev
```

Lần đầu chạy, mkcert sẽ yêu cầu quyền cài root certificate. Terminal in ra:

```
➜  Network: https://192.168.1.xxx:5173/
```

> **Lưu ý:** chứng chỉ mkcert chỉ được máy tính tin cậy theo mặc định. Để
> iPhone tin cậy khi test LAN, cài root CA mkcert vào iPhone, hoặc deploy
> staging HTTPS thật (Cloudflare Pages / Netlify / Vercel free) và test trên
> đó — cách này nhanh hơn cho MVP.

## 11. Test trên iPhone — checklist

1. Mở Camera mặc định iPhone.
2. Quét QR code.
3. Safari mở đúng URL `/ar/product-001`.
4. Màn hình loading hiện "Đang khởi tạo AR...".
5. Màn hình xin quyền Camera hiện đúng nội dung.
6. Nhấn "Cho phép Camera" → Safari hiện native prompt.
7. Cấp quyền → camera realtime hiển thị full màn hình.
8. Đưa camera vào đúng ảnh Image Target in trên bao bì.
9. Model 3D xuất hiện đúng vị trí ảnh, trạng thái HUD đổi thành "Đã nhận
   diện sản phẩm".
10. Di chuyển iPhone qua lại — model bám đúng theo ảnh, thay đổi
    position/perspective theo góc nhìn thực tế (không phải CSS giả lập).
11. Xoay iPhone quanh ảnh — model xoay theo góc nhìn.
12. Đưa ảnh ra khỏi khung hình — sau ~0.6s model ẩn, HUD quay lại "Đưa
    camera vào sản phẩm" (grace period tránh nhấp nháy khi mất tracking
    tạm thời).
13. Đưa ảnh lại vào khung hình — model xuất hiện lại, tracking tiếp tục.
14. Rời trang / tắt màn hình — camera tắt hẳn (kiểm tra đèn báo camera của
    iPhone tắt), không tiếp tục chạy nền.
15. Test trường hợp từ chối quyền Camera — app hiện thông báo lỗi rõ ràng,
    có thể thử lại.
16. Test trên trình duyệt/thiết bị cũ không đủ điều kiện (giả lập bằng cách
    tắt WebGL trong DevTools nếu cần) — hiện đúng màn hình "unsupported" với
    nút "Xem sản phẩm 3D" (fallback viewer không dùng camera).

## 12. Deploy production ($0)

**Khuyến nghị MVP:** chỉ deploy frontend static — không cần backend.

```bash
cd web-ar/client
npm run build   # xuất ra client/dist
```

Deploy `dist/` lên **Cloudflare Pages / Netlify / Vercel** (free tier, HTTPS
sẵn). Repo đã có sẵn:
- `client/vercel.json` — SPA rewrite `/ar/:id → index.html`
- `client/netlify.toml` + `public/_redirects` — tương tự cho Netlify / CF Pages

**Không** set `VITE_API_BASE_URL` khi build nếu dùng catalog static.

**Backend (tuỳ chọn):** deploy `server/` lên Render free / Fly.io / VPS.
Set `CORS_ORIGIN=https://your-frontend-domain.com` và build client với
`VITE_API_BASE_URL=https://your-api-domain/api`.

**Domain / QR cuối cùng:**
```
https://ar.your-domain.com/ar/product-001
```

## 13. Bảo mật

- Camera chỉ bật sau khi user bấm nút xin quyền (user gesture) — không tự
  động bật ngầm.
- Không có bất kỳ đoạn code nào upload camera frame lên server; toàn bộ
  tracking chạy trong trình duyệt (client-side).
- Không lưu trữ camera stream ở đâu cả — `renderer.setAnimationLoop(null)`
  và `mindarThree.stop()` dừng hẳn `MediaStream` khi rời trang.
- Bắt buộc HTTPS ở production (yêu cầu của chính trình duyệt, không phải
  tùy chọn).

## 14. Hiệu năng

- Model được cache theo URL trong `ModelManager` — không tải lại khi
  target found/lost lặp lại.
- GPU resources được giải phóng trong `clearCache()` (không dispose geometry
  shared của clone — tránh bug đen model / WebGL invalid).
- Draco decoder được cấu hình sẵn cho `.glb` nén Draco.
- `devicePixelRatio` bị giới hạn tối đa 2 để giảm nóng máy.
- Khuyến nghị asset: dưới 5MB / dưới 50k triangles / texture ≤ 2048px.

## 15. Mở rộng từ 1 sản phẩm sang nhiều sản phẩm

Kiến trúc đã hỗ trợ sẵn — không cần thay đổi cấu trúc:

1. Mỗi sản phẩm là 1 entry trong `products.json` (mục 8).
2. Mỗi entry có `.mind` + `.glb` + transform riêng.
3. URL `/ar/:id` xác định sản phẩm — `main.ts` đọc `id` rồi load catalog,
   không hard-code trong `ARManager` / `ImageTargetManager`.
4. Nhiều ảnh cùng lúc: tăng `maxTrack`, `addAnchor(i)` cho từng target trong
   `.mind` đa-target, một `ImageTargetManager` mỗi anchor.
5. Catalog lớn (>100) + cần CMS: bật Express + DB; client chỉ cần
   `VITE_API_BASE_URL`.

---

## Giới hạn đã biết của MVP

- Certificate HTTPS local (mkcert) cần trust thủ công trên iPhone khi test
  LAN — xem mục 10. Cách nhanh: deploy staging HTTPS free.
- Draco decoder mặc định lấy từ CDN Google (`gstatic.com`) — có thể tự host
  trong `public/draco/` nếu cần offline.
- Asset demo (`product-001`) chỉ để smoke-test; thay bằng artwork + model
  thật trước khi lên production.
