# Truyền kỳ mạn lục

Web đọc một quyển sách bằng tiếng Việt và tiếng Anh. Mở `/vi` hoặc `/en` để đọc; `/admin` dành cho owner/editor. Mặc định giấy ngà, có giao diện tối và các cài đặt đọc riêng trên thiết bị.

Source được quản lý tại repository private [Menhera-Chan-cool/truyen-ky-man-luc](https://github.com/Menhera-Chan-cool/truyen-ky-man-luc). Repo không chứa `.env.local`, khóa dịch vụ, thư mời, dữ liệu sao lưu riêng hay dependency/build output. Biến môi trường trên Vercel được cấu hình riêng; push GitHub không tự triển khai khi chưa nối Git integration.

Bản tối ưu yêu cầu chạy thêm `supabase/migrations/003_public_book_index.sql` sau 001/002. Xem `SUPABASE_SETUP.md`. Không chạy lại migration tạo bảng trên database đã có nội dung.

Bản public đã kiểm tra: [truyen-ky-man-luc.vercel.app](https://truyen-ky-man-luc.vercel.app/vi). Project hiện tại đã nối Supabase, nhập sách và kích hoạt owner; `/admin` dành cho owner/editor được mời. Owner tự đặt mật khẩu, ứng dụng không gửi email mời.

## Chạy trên máy

Yêu cầu Node.js 22 trở lên (đã kiểm tra bằng Node 24).

```powershell
npm install
$env:NEXT_TELEMETRY_DISABLED='1'
npm run dev
```

Mở http://localhost:3000 để dùng cùng origin canonical của Next.js khi biên tập trên máy. Nếu chưa cấu hình Supabase, web đọc dùng bản sách thật đã nhập sẵn và khu biên tập đóng. Đây là chế độ đọc tĩnh, không giả lập việc lưu lên máy chủ.

```powershell
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

`NEXT_TELEMETRY_DISABLED` tránh lỗi ghi cấu hình telemetry trên một số máy Windows; không ảnh hưởng nội dung web. `scripts/copy-worker.mjs` đưa PDF.js worker cùng phiên bản vào public; chạy khi cài dependency.

## Bật biên tập dùng chung

Editor chỉ mở Tiptap khi ID chương, ngôn ngữ và revision khớp dữ liệu form. Trong lúc lưu/upload, vùng nhập bị khóa để không chuyển chương hoặc ghi tiếp vào bản đang gửi. Lịch sử cũ không bị xóa. Kiểm thử hồi quy `npm run verify:editor` cần cấu hình Supabase và `BASE_URL` trỏ tới app đã chạy: tạo tài khoản/chương nháp tạm, dán và lưu ba chương ở cả VI/EN, kiểm tra sau reload rồi xóa dữ liệu thử; không gửi email và không xuất bản chương thử.

Làm theo [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Không có mật khẩu mặc định, đăng ký công khai hay bootstrap owner từ trình duyệt. Chỉ lệnh server `setup:owner` cấp owner ban đầu. Chỉ owner tạo liên kết mời; ứng dụng không tự gửi email. Các API xác minh tài khoản trên server và quyền hiện tại trong database; RLS bảo vệ cả truy cập trực tiếp.

## Nội dung và nguồn

- `src/data/book.json`: 20 chương Việt, 20 chương Anh và lời tựa VI, đã nhập từ nguồn người dùng cung cấp.
- `public/book/cover.jpg`: bìa lấy từ EPUB. Chưa có bìa sau hay minh họa rời được cung cấp; editor có thể thêm sau.
- EPUB gốc ghi nguồn `www.dtv-ebook.com`. Các dòng tên sách/tác giả/nguồn và tiêu đề bị lặp trước mỗi chương được tách khỏi thân truyện; file nguồn, văn truyện và chú thích được giữ nguyên.
- `src/lib/importer.ts`: EPUB/DOCX/TXT/HTML/PDF, giới hạn 50 MB/file, giải nén tối đa 200 MB và 2.500 mục. Ảnh tối đa 10 MB. Chỉ editor được nhập file.
- `supabase/migrations/001_book.sql`: migration PostgreSQL, RLS, Storage policies và các transaction xuất bản.
- `tests/`: kiểm thử nhập sách, HTML an toàn, speech/paging và PostgreSQL thực bằng PGlite. PGlite kiểm tra logic SQL/RLS cục bộ; không thay cho kiểm tra Supabase Auth/Storage thật.
- `e2e/`: kiểm thử Chromium desktop/mobile.

Nhập lại sách từ nguồn gốc (không sửa file nguồn):

```powershell
npm run seed:book -- "C:\Users\Admin\Downloads\Truyen Ky Man Luc - Nguyen Du.epub" "D:\truyenkimanluc"
```

Owner/editor nhập → xem trước → ghép chương → lưu nháp → xuất bản. Thay thế phải xác nhận; các bản nháp được lưu theo phiên bản và kiểm tra optimistic concurrency. Xuất bản nhiều chương chạy trong một transaction. Thu hồi không xóa lịch sử. Xóa chương là ẩn cả hai bản; lịch sử vẫn còn trong database.

Ảnh minh họa và bìa có thể dùng chung hoặc riêng VI/EN. Với PDF, mỗi chương chứa bản PDF mới chỉ có khoảng trang được chọn; file nguồn luôn riêng tư. PDF có lớp chữ có thể trích ra để duyệt/sửa, không có OCR. Các file tải trực tiếp vào Supabase, không đi qua giới hạn payload Vercel Functions. Tài nguyên chỉ được đọc công khai khi đang được một bản đã xuất bản tham chiếu; signed URL tồn tại tối đa 60 giây sau khi cấp.

## Người đọc

Có Literata, Lora, Merriweather, Georgia, Be Vietnam Pro, Inter, Roboto, OpenDyslexic và JetBrains Mono. Các phông bổ sung tự host, chỉ tải file phông khi trình duyệt cần sử dụng. Tooltip dùng chung hỗ trợ hover/focus, Escape và reduced motion. Màu tùy biến hiển thị swatch/mã HEX trong bảng nền tối; native controls theo độ sáng màu nền đã chọn.

Tiến độ, cài đặt, tô màu, đánh dấu và ghi chú lưu trong IndexedDB trên thiết bị. Đổi VI/EN giữ ID chương và vị trí riêng của từng bản. Không tự dịch sách; phần chưa có bản dịch hiển thị thông báo. Nút dịch đoạn chọn chỉ mở Google Translate sau khi người đọc bấm.

Trong Cài đặt trình đọc → **Dữ liệu đọc trên thiết bị**, dùng **Xuất bản sao JSON** để giữ bản sao trước khi đổi máy hoặc xóa dữ liệu trình duyệt. Nhập file (tối đa 10 MB) sẽ hiện số ghi chú/vị trí trước khi bạn bấm Khôi phục. Ghi chú được gộp, giữ riêng các bản khác nội dung; tùy chọn khôi phục cài đặt/tiến độ sẽ thay các giá trị tương ứng. File chỉ được xử lý trên thiết bị, không tải lên server. Đây là thao tác sao lưu thủ công, không phải đồng bộ tài khoản.

Thay phông, cỡ chữ, giãn dòng, chiều rộng hoặc chế độ đọc giữ đoạn đang xem, thay vì giữ số trang cũ. Bấm ghi chú thuộc chương khác mở thẳng đoạn đã đánh dấu nếu đúng phiên bản. PDF nhớ trang/zoom riêng. Khi đổi giọng hoặc tốc độ lúc đang nghe, TTS tiếp tục từ từ đang đọc nếu trình duyệt có boundary; nếu không, đọc lại đoạn ngắn hiện tại.

Trình đọc nạp sẵn nội dung đã xuất bản của ngôn ngữ đang chọn vào bộ nhớ cho quyển sách này. Next/Previous, mục lục và liên kết cuối chương đổi nội dung tại chỗ, cập nhật URL/lịch sử trình duyệt và khôi phục vị trí riêng của chương, không gọi lại server. Làm mới trang hoặc đổi ngôn ngữ sẽ đọc lại bản công khai mới nhất; ảnh/PDF vẫn tải khi cần. Không lưu bản nháp hay HTML cả sách vào IndexedDB.

Giọng đọc dùng Web Speech API, phụ thuộc giọng mà trình duyệt/hệ điều hành cung cấp. Một số giọng “online” của thiết bị có thể dùng dịch vụ hệ điều hành; web không có API TTS riêng. Nhiễu trắng/hồng/nâu và tiếng mưa được tạo tại thiết bị bằng Web Audio. File âm thanh riêng không được tải lên server.

Trong **Giọng đọc & tốc độ**, **Ngắt nghỉ ngắn** mặc định bật: gộp các câu ngắn vào cùng lượt đọc và làm nhẹ dấu `. : ; …`/gạch ngang trong bản chữ gửi cho giọng đọc. Nội dung sách, ghi chú và vị trí từ vẫn giữ nguyên; số thập phân, giờ và các viết tắt thông dụng được bảo vệ. Tắt tùy chọn để dùng nhịp gốc. Không đặt được thời lượng nghỉ chính xác bằng Web Speech; mức nghỉ thực tế tùy giọng/thiết bị. Cài đặt lưu trên thiết bị và bản sao JSON cũ vẫn nhập được.

Mục lục đếm tổng câu chuyện, không trừ chương chỉ thiếu bản dịch ở ngôn ngữ đang chọn. Bảng giọng đọc chỉ liệt kê giọng phù hợp VI/EN hiện tại, báo rõ khi danh sách trống hoặc chỉ có một giọng; hỗ trợ Làm mới, voiceschanged, quay lại tab và ba lần kiểm tra muộn có giới hạn. Khi điện thoại chỉ hiện “Tự động”, dùng hướng dẫn Android trong bảng để cài dữ liệu giọng đọc rồi Làm mới. Cài thêm gói không bảo đảm browser sẽ liệt kê thêm giọng. Xem [hướng dẫn Android](https://support.google.com/accessibility/android/answer/6006983?hl=vi).

Ghi chú gắn với ngôn ngữ, revision và vị trí văn bản. Khi nội dung đổi, ghi chú cũ vẫn giữ nguyên trong danh sách và được đánh dấu cũ; không tự gắn vào đoạn khác. PDF nguyên trang có zoom riêng và không áp dụng thay phông/cỡ chữ của nội dung văn bản.

## Triển khai

Vercel: framework Next.js, Node 24, build `npm run build`, install `npm ci`. Không đưa `.env.local`, `.owner-invitation.txt`, file nguồn riêng, dữ liệu trình duyệt hay token vào Git/deployment. Khi nối Supabase, thêm đủ các biến môi trường ở Vercel rồi redeploy. Không cần chuyển backend Go của các repo tham khảo lên Vercel.

Vercel cần biến Config `NODE_OPTIONS=--experimental-require-module` cho production/preview/development: runtime mặc định tắt `require(ESM)`, trong khi DOMPurify/jsdom dùng dependency ESM. Đã cấu hình trên project hiện tại. Nếu tạo project Vercel khác, thêm biến này rồi deploy theo [hướng dẫn Node.js của Vercel](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration).

Không bao gồm: OCR, thư viện nhiều sách, tài khoản người đọc/đồng bộ nhiều thiết bị, tự dịch toàn truyện, xuất EPUB/PDF mới. Xem [VERIFICATION.md](VERIFICATION.md) để biết chính xác những gì đã và chưa kiểm chứng.

## Tham khảo và giấy phép

Tham khảo thao tác của [EPUB-Forge](https://github.com/AzenKain/EPUB-Forge) và [Novel-Hub](https://github.com/AzenKain/Novel-Hub). Hai repo được clone riêng trong `work/references`, không bundle backend/binary vào web. Xem [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
