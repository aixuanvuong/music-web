# Music Web — Website phát nhạc trực tiếp lấy nguồn từ YouTube

Dự án học tập: website nghe nhạc trực tuyến dùng YouTube/YouTube Music làm nguồn dữ liệu và stream, phát triển dựa trên nghiên cứu dự án mã nguồn mở [SimpMusic](https://github.com/maxrave-dev/SimpMusic) (GPL-3.0). Toàn bộ mã trong repo này được viết mới; phần phân tích SimpMusic nằm trong tài liệu kiến trúc.

## Cấu trúc repo

| Thư mục | Nội dung |
|---|---|
| `backend/` | Server Node.js (không phụ thuộc thư viện ngoài) + frontend player. Engine trích xuất dùng **yt-dlp**: tìm kiếm, lấy stream, proxy audio về trình duyệt kèm forward `Range` (trả 206, tua bài được), cache URL stream, lời nhạc từ LRCLIB. |
| `web-test/` | Bản web test **không cần server**: 1 file HTML duy nhất chạy thẳng trong trình duyệt, lấy dữ liệu/stream qua Invidious instance công cộng (`yt.chocolatemoo53.com`, có instance dự phòng). |
| `docs/` | Tài liệu kiến trúc và kế hoạch triển khai (bản text trích từ PDF): quyết định kiến trúc, thiết kế stream proxy, danh mục API, rủi ro (chặn IP datacenter, PO Token/SABR, pháp lý), kế hoạch 5 giai đoạn. |

## Chạy bản backend

Yêu cầu: Node.js 18+ và [yt-dlp](https://github.com/yt-dlp/yt-dlp).

```bash
pip install yt-dlp
cd backend
YTDLP_BIN=yt-dlp node server.js
# mở http://localhost:8787
```

Biến môi trường: `PORT` (mặc định `8787`), `YTDLP_BIN` (đường dẫn tới yt-dlp, ví dụ trong venv: `YTDLP_BIN=$PWD/.venv/bin/yt-dlp`).

API: `GET /api/home`, `GET /api/search?q=`, `GET /api/stream/:videoId`, `GET /api/lyrics?q=`, `GET /api/health`.

## Chạy bản web test

Mở trực tiếp `web-test/index.html` bằng trình duyệt, hoặc phục vụ tĩnh:

```bash
npx serve web-test
```

## Trạng thái & giới hạn đã biết

- Đã kiểm chứng (26/10/2026): tìm kiếm, phát nhạc qua proxy, tua bài (206/Content-Range), lời nhạc đồng bộ — với bản backend chạy trên máy chủ thử nghiệm.
- URL stream của googlevideo gắn với IP máy chủ và có thời hạn: backend phải là nơi resolve URL; đổi IP phải resolve lại (đã có cơ chế tự làm mới khi gặp 403/410).
- Bản web test phụ thuộc instance Invidious công cộng của bên thứ ba: có thể chậm/quá tải, trang sẽ tự thử instance dự phòng.
- Chưa có: tài khoản người dùng, playlist cá nhân, cơ sở dữ liệu (Giai đoạn 3 trong tài liệu), rate limit/monitoring hoàn chỉnh (Giai đoạn 4).

## Lưu ý pháp lý

Chỉ phục vụ học tập và thử nghiệm cá nhân. Việc phát nội dung tách khỏi trình phát chính thức của YouTube vi phạm Điều khoản dịch vụ của YouTube; không dùng dự án này cho mục đích thương mại hay phát hành rộng rãi. Tôn trọng bản quyền của nghệ sĩ — hãy ủng hộ họ qua YouTube Premium/Spotify khi có thể.
