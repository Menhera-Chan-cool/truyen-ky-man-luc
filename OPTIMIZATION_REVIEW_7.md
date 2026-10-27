# Rà soát sau bản sửa tự cuộn — 27/10/2026

Production xác nhận READY `dpl_GR76YBjbPNzbftqbmtsaawbVhbbJ`, runtime source `c10b63d78f3a03fc7f97489ecea6aaae912ad102`; Git HEAD bằng chứng `2aed861`. Không có runtime mới từ đợt sửa tự cuộn. Đây là audit, chưa sửa/deploy thêm hoặc ghi dữ liệu sách/quản trị.

> Đây là bằng chứng trước sửa. Người dùng đã duyệt hai mục; bản sửa và kết quả mới được ghi ở đầu VERIFICATION.md. Phép thử bổ sung `verification/keyboard-calibration.json` cho thấy headless Chrome không kích hoạt browser chrome accelerators ngay cả trên trang không có handler: kết luận lỗi dựa vào preventDefault và việc lật trang sai; không dùng URL đứng yên làm bằng chứng riêng rằng native Back hỏng.

## Kết luận

Có **hai P2 cần xử lý**: bảo toàn vị trí mới nhất khi đổi phông trên mạng chậm, và nhường phím Back của trình duyệt trong chế độ trang. Không đề xuất thêm tiện ích. Chuyển chương đo mới vẫn **17 / 17 / 15 / 15 ms, 0 request chuyển chương**.

## 1. P2 — Phông đến muộn có thể kéo người đọc về đoạn trước

- **Vị trí:** `Reader.tsx:498–594` (restore/đợi fonts), `Reader.tsx:606` (không cập nhật tiến độ trang khi chưa restored), `Reader.tsx:893` (pendingAnchor lúc đổi cài đặt).
- **Tình huống:** Đang ở trang 3 chế độ trang đơn, chọn Lora và giữ request WOFF2 mới bằng browser route. Sau 1,2 giây, document.fonts.status=loading và data-ready=false. Nút lật trang vẫn nhận thao tác; lật tới trang 8 rồi thả request font. Khi font hoàn tất, Reader dùng neo cũ và đưa về trang 2 hoặc 3.
- **Bằng chứng không chỉ dựa số trang:** Cùng nội dung DOM, đo offset UTF-16 của ký tự đầu đang nhìn thấy. VI desktop: người đọc đã đi tới offset 6164, sau font về offset 927. VI mobile: 3016→587; EN mobile: 3295→759. Văn bản/offset gốc và sau font trong JSON khớp đoạn cũ, không khớp đoạn vừa chủ động mở.
- **Ảnh hưởng:** Người đọc đổi phông rồi lật tiếp trên mạng chậm có thể bị kéo ngược và lưu lại chỗ cũ. Không mất nội dung sách hoặc ghi chú, nhưng vị trí đọc mới nhất bị bỏ qua.
- **Nguyên nhân:** Pipeline chờ fonts.load rồi toàn bộ document.fonts.ready chưa có giới hạn chờ; pendingAnchor được chụp trước thao tác mới. Trong lúc chưa restored, các nút vẫn có thể đổi page nhưng page/progress effect không cập nhật neo mới. Khi font đến, restore quay lại pendingAnchor cũ.
- **Khuyến nghị:** Cho phép dùng font dự phòng sau thời gian chờ có giới hạn, đo layout fallback và theo dõi neo hiện tại; khi font đến muộn, reflow theo đoạn đang xem mới nhất. Trong giai đoạn thật sự chưa đo được layout, cần phản ánh busy và tránh nhận lệnh điều hướng rồi âm thầm bỏ ý định đó. Tái dùng visibleTextOffset/pendingAnchor/ResizeObserver hiện có. Không chỉ tăng timeout kiểm thử hoặc giữ vô hạn mọi tương tác chờ font.
- **Tiêu chí sau sửa:** Font bị trì hoãn hoặc không tải được vẫn có luồng đọc rõ ràng; khi font xuất hiện muộn, đoạn mới nhất được giữ. Kiểm tra bằng offset/văn bản chứ không đòi số trang bất biến vì phông đổi sẽ đổi số trang.
- **Nguồn API:** [FontFaceSet.ready](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/ready) chỉ giải quyết khi font/layout hoàn tất; thời hạn chờ và hành vi fallback là trách nhiệm của ứng dụng.

| Tổ hợp | Trước đổi phông | Người đọc đã lật tới | Sau font tải xong | Offset mới nhất → sau font |
|---|---|---|---|---|
| Desktop VI | 3/19 | 8/19 | 3/19 | 6164 → 927 |
| Desktop EN | 3/24 | 8/24 | 2/24 | 7638 → 759 |
| Mobile viewport VI | 3/42 | 8/42 | 3/41 | 3016 → 587 |
| Mobile viewport EN | 3/59 | 8/59 | 3/58 | 3295 → 759 |

Các total page khác nhau sau font là bình thường; lỗi được kết luận từ việc neo quay về đoạn cũ trong khi người đọc đã di chuyển xa hơn. Mỗi ca có 1–3 request font bị giữ, không phải giả định mạng chậm mà không kiểm tra request.

## 2. P2 — Alt+← bị ứng dụng chặn thành lật trang

- **Vị trí:** `Reader.tsx:833–842`: handler chỉ kiểm tra key và paged, không bỏ qua Alt/Ctrl/Meta/Shift.
- **Tình huống:** Mở chương 2 rồi chuyển chương 1 để tạo history, bật trang đơn và mở trang 2. Bấm Alt+←: event có altKey=true, defaultPrevented=true; URL vẫn chương 1, counter về 1. Đối chứng page.goBack() vẫn về chương 2, nên history có tồn tại.
- **Ảnh hưởng:** Phím Back quen thuộc bị đổi thành thao tác khác trong Reader. Người dùng phải dùng nút Back hoặc chuột để thoát về lịch sử.
- **Khuyến nghị:** Chỉ xử lý ArrowLeft/Right không kèm modifier, không IME và không trong trường nhập liệu; nhường các tổ hợp hệ thống/trình duyệt. Giữ phím mũi tên đơn để lật trang và dừng auto như hiện tại.
- **Bằng chứng:** Cả VI/EN, desktop và viewport 390px đều giữ URL chương 1, lật 2→1 và ghi event bị preventDefault. Phép bàn phím trên viewport mobile không phải thử bàn phím vật lý iOS/Android.
- **Nguồn hành vi mong đợi:** [Chrome keyboard shortcuts](https://support.google.com/chrome/answer/157179?hl=en) quy định Alt+Left arrow là về trang trước trong history trên Windows/Linux.

## Đối chiếu hai repo

- Git fetch lại Novel-Hub `28b6972e5b4f749124e4e27200bd76c4b6168d38`, EPUB-Forge `33120281bfc6faa51d43f5bd45dbbcab882da5d7`; upstream chưa đổi trong lượt kiểm tra.
- Đọc lại [Novel-Hub ReaderWorkspace](https://github.com/AzenKain/Novel-Hub/blob/28b6972e5b4f749124e4e27200bd76c4b6168d38/web/src/pages/reader/ReaderWorkspace.tsx#L1449), useAutoScroll và ReaderInBookSearch. Handler mũi tên của repo tham khảo cũng không chứng minh các tổ hợp modifier đã được xử lý đúng; khuyến nghị ở đây dựa vào phép thử app và hành vi Chrome.
- Đọc lại [EPUB-Forge PreviewPanel](https://github.com/AzenKain/EPUB-Forge/blob/33120281bfc6faa51d43f5bd45dbbcab882da5d7/src/components/PreviewPanel.tsx): khung iframe và onLoad áp style. Lượt này không có bằng chứng mới cần thêm thiết bị preview hoặc sửa editor; trường hợp Reader giữ vị trí khi font đến muộn cần kiểm tra riêng.

## Bằng chứng và giới hạn

- `verification/reading-audit-7.json`: bốn tổ hợp, keyboard event/default behavior, request font bị giữ, offset/văn bản và page counters. Không có page error trong bốn ca hoàn tất.
- `verification/navigation-audit-7.json`: bốn mẫu điều hướng hiện tại. Đây là lab Chromium, không phải INP/Core Web Vitals người dùng thật.
- Font được giữ qua route interception và keyboard được gửi qua Playwright. Một attempt chụp screenshot trong lúc giữ font đã timeout vì công cụ chụp cũng chờ font; ca hoàn tất dùng DOM/range để đo và không tính lỗi đó là lỗi app.
- Không sửa runtime, deploy, database, quyền hoặc tài khoản. Không chạy lại 128 ca vì không có code đổi; kết quả release trước được giữ trong VERIFICATION.md. Chưa thử điện thoại/bàn phím vật lý, mạng người dùng thực, editor có đăng nhập hoặc audit WCAG/security toàn diện.
