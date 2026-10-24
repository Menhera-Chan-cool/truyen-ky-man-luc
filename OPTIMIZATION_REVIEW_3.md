# Rà soát tiếp trải nghiệm đọc — 23/10/2026

Web phục vụ một sách VI/EN, khách đọc công khai và vài owner/editor nhập nội dung. Phạm vi này kiểm tra reader, TTS, tương tác chọn chữ, mở trang và đường nhập liệu của RichEditor; không giả định tải hàng triệu người dùng.

Đối tượng khảo sát: bản production `dpl_Hh1Gez4vmqoSKoiBSczrk1aSPP94`, runtime source `3ce0e049542439545a549b773e3141c2a5c8ab7b`. Các phát hiện dưới đây là mốc trước sửa. Người dùng đã duyệt sửa toàn bộ vào 24/10/2026; source hiện đã triển khai cả 5 mục. Trạng thái kiểm chứng/release mới nhất nằm trong `VERIFICATION.md`, `DEPLOYMENT.json` và `tasks/reader-reliability.md`. Không sửa sách thật hoặc schema Supabase.

## Kết quả chính

Chuyển chương và cuộn tiếp tục mượt trong mẫu mới. Ưu tiên tiếp theo là xử lý TTS bị ngắt, liên kết chú thích trong chế độ trang, bảng thao tác chọn chữ và độ ổn định khi mở sách. Không có căn cứ để thay framework hoặc viết lại editor.

| Hạng mục rà soát chọn lọc | Điểm /4 | Bằng chứng / giới hạn |
|---|---:|---|
| Khả năng truy cập | 3 | Control có tên, focus/Escape và sidebar ẩn đúng; trạng thái TTS khi bị ngắt chưa phản ánh đúng. Chưa audit WCAG toàn diện. |
| Hiệu năng | 3 | Chuyển chương 11–18 ms; cuộn p95 18 ms; còn xử lý dư HTML ngôn ngữ không được đọc. |
| Responsive | 3 | Desktop/390px hoạt động, không tràn ngang; popup chọn chữ còn mở khi đã chạm ra ngoài. Chưa thử bàn phím điện thoại vật lý. |
| Theme | 3 | Giữ hệ giấy ngà/mực trầm và các theme hiện có; lượt này không đo lại mọi tổ hợp màu tùy biến. |
| Tính nhất quán triển khai | 4 | Bố cục riêng cho một sách, giữ phong cách đã duyệt. Detector trên ba component trọng tâm trả `[]`; đây không phải chứng nhận toàn bộ UI không lỗi. |
| Tổng tham khảo | 16/20 | Sàng lọc kỹ thuật có giới hạn, không phải điểm Core Web Vitals thực địa hay chứng nhận AA. |

Phát hiện: **1 P1, 3 P2, 1 P3**. Không phát hiện P0 trong phạm vi kiểm tra.

## 1. P1 — TTS vẫn báo đang đọc khi lượt phát hiện tại bị ngắt

- **Tình huống:** phát một đoạn rồi API native báo `interrupted`. Trên cả desktop và mobile giả lập, nút vẫn là “Dừng đọc”, không có lượt đọc tiếp được xếp vào queue. Đây là kiểm thử mock sự kiện native, không phải khẳng định mọi cuộc gọi điện thoại đều sinh sự kiện này.
- **Nguyên nhân:** [useSpeech.ts:173](D:/codex/2026-10-22/p/outputs/truyen-ky-man-luc/src/components/useSpeech.ts:173) bỏ qua cả `interrupted`/`canceled` của session còn hiện hành. Guard generation đã phân biệt callback cũ, nên bỏ qua lỗi của session đang chạy làm UI giữ trạng thái sai.
- **Sửa nhỏ nhất:** phân biệt callback cũ với lượt phát hiện tại; khi lượt hiện tại bị ngắt, giữ chunk/boundary và chuyển sang trạng thái tạm dừng. Cung cấp “Tạm dừng / Tiếp tục” để người đọc chủ động nghe tiếp, không khởi động lại đầu chương. Giữ kiểm tra locale/revision và chống callback trễ.
- **Nếu để nguyên:** người nghe tưởng audio vẫn chạy, phải dừng/bắt đầu lại hoặc tự tìm đoạn vừa nghe. Không cam kết tự phát nền khi OS không cho phép.

Đối chiếu [Novel-Hub useTTS](https://github.com/AzenKain/Novel-Hub/blob/28b6972e5b4f749124e4e27200bd76c4b6168d38/web/src/hooks/useTTS.ts): có pause/resume, giữ chunk và word boundary, xử lý riêng interrupted. Nên áp dụng ý tưởng quản lý session; không mặc định mọi nhánh của repo tham khảo đều thích hợp cho browser/giọng hiện tại.

## 2. P2 — Chú thích dạng liên kết chưa đồng bộ trang và tiến độ

- **Tình huống:** trong trang đơn, bấm link `#id` tới chú thích cuối chương. Fixture browser sau khi đo lại layout: desktop từ `1/14` vẫn hiển thị `1/14` dù đã tới chú thích cuối, `scrollLeft=10.764`; mobile từ `1/30` vẫn là `1/30`, `scrollLeft=11.339`.
- **Nguyên nhân:** [Reader.tsx:1348](D:/codex/2026-10-22/p/outputs/truyen-ky-man-luc/src/components/Reader.tsx:1348) chỉ xử lý click ảnh; link nội bộ để browser tự cuộn ngang container. Reader đã có đường điều hướng đúng cho TTS/đánh dấu nhưng chưa dùng nó cho link chú thích.
- **Sửa nhỏ nhất:** bắt link nội bộ có target trong chương và dùng chung logic reveal/page của Reader, xử lý cả link trở lại; giữ link ngoài và thao tác mở tab mới đúng hành vi browser. Lưu tiến độ theo trang đích.
- **Nếu để nguyên:** vị trí thật và bộ đếm/tiến độ khác nhau khi dùng chú thích dạng link. Ca này dùng fixture trong browser riêng; chương 1 công khai kiểm tra được có 0 link neo, nên không nói rằng chú thích hiện tại của cả sách đều hỏng.

## 3. P2 — Popup chọn chữ còn che trang sau khi đã chạm ra ngoài

- **Tình huống:** chọn đoạn → bảng thao tác hiện → bỏ vùng chọn và chạm vào tiêu đề ngoài bảng. Native selection đã collapsed nhưng bảng vẫn hiển thị ở cả desktop/mobile.
- **Nguyên nhân:** [Reader.tsx:548](D:/codex/2026-10-22/p/outputs/truyen-ky-man-luc/src/components/Reader.tsx:548) return khi selection rỗng mà không xét thao tác bên ngoài. Hiện có thể đóng bằng X/Escape.
- **Sửa nhỏ nhất:** đóng khi chạm/click bên ngoài bảng, giữ bảng khi người đọc nhập ghi chú hoặc bấm nút bên trong. Không đóng ngay mọi lần selection collapse vì focus vào ô ghi chú cũng có thể làm vùng chọn native mất đi.
- **Nếu để nguyên:** bảng tiếp tục chiếm vùng đọc, nhất là đáy màn hình điện thoại; người đọc phải đóng thủ công.

Đối chiếu [Novel-Hub useReaderSelection](https://github.com/AzenKain/Novel-Hub/blob/28b6972e5b4f749124e4e27200bd76c4b6168d38/web/src/hooks/useReaderSelection.ts): tách thao tác trong toolbar/modal khỏi thao tác bên ngoài và làm sạch selection không hợp lệ.

## 4. P2 — Lỗi tạm thời khi tải sách vẫn đẩy cả trang vào màn hình lỗi

- **Bằng chứng:** [server.ts:48](D:/codex/2026-10-22/p/outputs/truyen-ky-man-luc/src/lib/server.ts:48) gọi RPC đọc sách một lần rồi throw. Lượt QA vừa trước đã ghi nhận trang “Unable to load this page” ở một ca backup; cùng ca chạy riêng lại đạt. Xem `verification/tts-pauses-local.json`. Đây là bằng chứng QA đã lưu và đường code hiện tại, không phải một sự cố mới được cố tình gây lên Supabase.
- **Sửa nhỏ nhất:** thử lại có giới hạn đúng một lần với lỗi kết nối/429/5xx của RPC chỉ đọc; nếu vẫn lỗi, giữ thông báo và nút Retry. Không retry mutation, không lấy seed hoặc nội dung đã thu hồi làm fallback.
- **Nếu để nguyên:** một lỗi kết nối ngắn có thể buộc người đọc bấm tải lại dù phiên và nội dung vẫn hợp lệ. Phân loại đúng lỗi cũng tránh retry lỗi cấu hình/quyền vô ích.

## 5. P3 — Mỗi lần mở reader còn làm sạch cả bản ngôn ngữ không dùng

- **Bằng chứng:** [server.ts:55](D:/codex/2026-10-22/p/outputs/truyen-ky-man-luc/src/lib/server.ts:55) làm sạch VI và EN. Sau đó [ReaderPage](D:/codex/2026-10-22/p/outputs/truyen-ky-man-luc/app/[locale]/read/[chapterId]/page.tsx:24) bỏ HTML của ngôn ngữ còn lại trước khi gửi xuống client.
- **Đo cục bộ với dữ liệu nguồn:** 3 lượt chuẩn bị cả 41 bản nội dung: 323 / 254 / 228 ms. Chỉ chuẩn bị VI: 124 / 120 / 120 ms. Đây là benchmark CPU fixture, không phải tiết kiệm thời gian mạng hay số đo server Vercel.
- **Sửa nhỏ nhất:** reader chỉ chuẩn bị/làm sạch HTML của locale được đọc, vẫn giữ metadata mục lục hai ngôn ngữ và làm sạch mọi HTML thực sự được hiển thị. Giữ đường đọc đầy đủ cho caller cần cả hai.
- **Nếu để nguyên:** tiếp tục mất khoảng 0,1–0,2 giây CPU dư trong mẫu này. Đây là tối ưu mở đầu, không phải thay cơ chế chuyển chương đã mượt.

## Những phần nên giữ

- Mẫu chuyển chương mới: **18 / 11 / 14 / 15 ms**, cả bốn **0 request chuyển chương**.
- Cuộn 120 frame: **4 lần put tiến độ**, p95 **18 ms**, không long task trong lúc cuộn, cả desktop và mobile CPU chậm 4×.
- Reader khoảng **219.843 byte JS nén**; CLS desktop khoảng **0,0036**, mobile **0** trong mẫu này. Không tràn ngang hoặc page error ở các probe.
- Mở đầu có biến động: mẫu reader desktop FCP 2,43 s, mobile CPU 4× FCP 7,33 s, TTFB mobile 2,81 s. Chưa khóa mạng nên không gán toàn bộ chậm này cho React/sanitizer hoặc cam kết mức cải thiện cố định.
- Chưa có căn cứ ưu tiên viết lại editor. Fixture RichEditor thật dùng chương nguồn lớn nhất 29.002 ký tự HTML, parent state tối thiểu và 21 nút chương: 35 lần chèn chữ có p95 tới frame 18,2 ms ở CPU bình thường và 51,9 ms ở CPU 4×. Đây không phải đo toàn bộ `/admin` được xác thực hay tách riêng thời gian serialize. [EPUB-Forge EditChapterModal](https://github.com/AzenKain/EPUB-Forge/blob/33120281bfc6faa51d43f5bd45dbbcab882da5d7/src/components/EditChapterModal.tsx) đọc HTML khi lưu/đổi chế độ, còn onInput chủ yếu cập nhật alignment; chỉ đáng học cách giảm serialize nếu đo trên Admin thật xác nhận chi phí lớn.

## Bằng chứng và giới hạn

Hai repo được fetch lại. Remote HEAD: Novel-Hub `28b6972e5b4f749124e4e27200bd76c4b6168d38`; EPUB-Forge `33120281bfc6faa51d43f5bd45dbbcab882da5d7`. Không chạy lại toàn bộ hai ứng dụng tham khảo trong lượt này.

- `verification/ux-followup-audit-3.json`: TTS interrupted, đóng selection và neo chú thích, desktop/mobile.
- `verification/navigation-audit-3.json`, `verification/performance-audit-3.json`: mẫu trên URL thật.
- `verification/sanitization-audit-3.json`, `verification/editor-input-audit-3.json`: benchmark fixture cục bộ.
- Script trong `D:/codex/2026-10-22/p/work/`, ảnh probe trong `.impeccable/review/audit-3/`; detector regex trên Reader/RichEditor/ReaderSettings trả `[]`.

Không đăng nhập owner/editor thật, không ghi server, không sửa sách. Ghi chú/tiến độ và nội dung fixture chỉ nằm trong browser context QA riêng. Chưa kiểm tra Android/iOS vật lý, chất lượng âm thanh, bàn phím ảo thật, mọi custom theme, tải đồng thời lớn hoặc security/RLS toàn diện. Không chạy lại toàn bộ unit/E2E vì không thay runtime.

Thứ tự đã duyệt: 1 → 2 → 3 → 4 → 5. Phạm vi triển khai được ghi tại `tasks/reader-reliability.md`; số đo và các lỗi phía trên vẫn giữ làm bằng chứng trước sửa. Xem `VERIFICATION.md` cho kết quả sau sửa.
