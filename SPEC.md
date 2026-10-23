# Đặc tả được chốt

## Mục tiêu

Web của đúng một quyển **Truyền kỳ mạn lục — Nguyễn Dữ**, truy cập thẳng trang giới thiệu, đọc công khai bằng VI/EN. Người đọc không cần tài khoản; chỉ owner/editor được mời mới đăng nhập. Ngôn ngữ đổi đồng thời giao diện, giới thiệu, mục lục và bản truyện đã chuẩn bị, giữ ID chương. Không tự dịch sách và không trộn VI vào phần EN chưa dịch.

## Các phần và thứ tự xây dựng

| Phần | Trách nhiệm | Phụ thuộc |
|---|---|---|
| content | Metadata VI/EN, ID chương ổn định, nội dung và phiên bản | — |
| access | Supabase Auth, owner/editor, RLS, file riêng tư | — |
| editing | Nhập chọn chương, Tiptap/HTML, ảnh/bìa, nháp/xuất bản/lịch sử | content, access |
| reading | Trang sách, trình đọc, trạng thái và ghi chú trên thiết bị | content |
| deployment | Build, kiểm thử, Vercel, tài liệu cấu hình | editing, reading |

Xây content/access trước, hoàn thiện reading/editing, rồi kiểm chứng và deploy.

## Hành vi bắt buộc

- Nhập EPUB/DOCX/TXT/HTML/PDF: chọn một, nhiều hoặc toàn bộ chương; sửa tiêu đề/ghép ID và duyệt trước khi lưu nháp. Thay thế phải xác nhận. File nguồn giữ riêng, không sửa bản trên máy.
- EPUB theo spine/TOC, giữ chú thích và ảnh. DOCX giữ đoạn và định dạng cơ bản. PDF đọc bố cục gốc, chia theo khoảng trang hoặc trích lớp chữ để duyệt; không OCR. PDF xuất bản từng phần không chứa các trang chưa chọn.
- Bìa trước/sau theo VI/EN hoặc dùng chung. Ảnh có thể chèn trong chương hoặc thành trang minh họa giữa chương. Không chế bìa sau/minh họa khi chưa có tài nguyên.
- Owner/editor đều sửa/xuất bản/thu hồi. Chỉ owner quản lý membership. Không có signup công khai hoặc owner mặc định; bootstrap bằng lệnh server và liên kết một lần, không tự gửi email.
- Bản nháp và bản công khai tách biệt. Save/publish kiểm tra revision; nhập hoặc xuất bản nhiều chương dùng transaction. Lịch sử có phân trang metadata; chỉ lấy body khi xem/khôi phục, tránh tải toàn bộ bản dài một lúc.
- Trình đọc có mục lục/tìm chương, trước/sau, tiến độ, cuộn/trang đơn/trang đôi, font/cỡ/giãn dòng/chiều rộng/căn lề, tám chủ đề, màu riêng, toàn màn hình.
- Tô màu/ghi chú cho chữ và ảnh, tìm/lọc, sao chép, trích dẫn PNG; đọc đoạn chọn/từ đây, chọn giọng/tốc độ, tự cuộn, âm thanh nền và file âm thanh cục bộ. Dịch đoạn chọn mở Google Translate khi bấm.
- Tiến độ/cài đặt/ghi chú dùng IndexedDB, riêng từng bản. Ghi chú cũ không tự bám vào văn bản mới nếu revision hoặc nội dung neo thay đổi.
- Thiếu bản dịch hiển thị thông báo và nút sang bản còn lại. Dừng TTS khi đổi chương/ngôn ngữ. Điện thoại biến trang đôi thành trang đơn; các nút điện thoại có vùng bấm tối thiểu 40px.

## Giao diện và API

Next.js/TypeScript, Supabase PostgreSQL/Auth/Storage, Vercel. `/vi`, `/en`, `/[locale]/read/[chapterId]`, `/admin`, `/admin/activate`; API quản trị dưới `/api/admin`, tài nguyên qua `/api/assets`. Locale chỉ `vi | en`. Dữ liệu chính: Book, Chapter, ChapterVersion, ChapterEdition, Asset, Member.

Default giấy ngà/mực trầm/điểm nhấn đỏ, bố cục và thao tác tham khảo Novel-Hub; dùng bìa thật. Tên tác giả dưới tên sách. Không có thư viện nhiều sách, sách liên quan, ngày xuất bản, nhà xuất bản hoặc dòng metadata ngôn ngữ. Nền tối là lựa chọn của người đọc.

## Quy ước, lệnh và kiểm chứng

`app/` chứa route; `src/components/` giao diện; `src/lib/` logic chung; `supabase/migrations/` schema; `scripts/` lệnh nhập/setup; `tests/` Vitest; `e2e/` Playwright. Dùng TypeScript strict, kiểu riêng cho locale/edition, component theo hành vi, chuẩn định dạng Prettier. Ví dụ kiểu chung: `type Locale = "vi" | "en"`.

```powershell
npm run dev
npm test
npm run typecheck
npm run check:sources
npm run build
npm run test:e2e
```

Tiêu chí nghiệm thu: 20 chương VI + lời tựa, 20 EN, đúng thứ tự và không mất đoạn; switch đúng bản; ghi chú/cài đặt còn sau reload; PDF/chỉnh sửa hoạt động trên trình duyệt; SQL/RLS chống khách, editor bị thu hồi và mất owner cuối cùng; giao diện desktop/mobile không tràn và có focus; build và URL Vercel đọc được. Auth/Storage/Supabase thật phải được kiểm tra riêng sau khi người dùng tạo project và cấu hình khóa.

Luôn giữ nguyên nguồn, làm sạch HTML, xác minh quyền tại server và database, bảo toàn nội dung đang công khai khi lỗi. Không commit khóa, tự gửi email, tạo dịch vụ trả phí hoặc đăng ký tài khoản bên ngoài thay người dùng. Không thêm OCR, dịch toàn truyện, ebook export, tài khoản người đọc hay đồng bộ nhiều thiết bị vào phạm vi này.
