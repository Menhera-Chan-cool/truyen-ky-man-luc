# Rà soát trải nghiệm đọc lâu — 27/10/2026

Production xác nhận READY `dpl_3QKCyPvofZHDpMRbtkPwga2K1Saj`, runtime source `d93f93bfb5f4ea629d0e67c29cc884280aaef35f`, Git HEAD bằng chứng `a92d326`. Bản runtime chưa đổi từ release sửa tìm kiếm/lớp công cụ. Lượt này chỉ khảo sát; không sửa runtime, deploy, nội dung sách hoặc dữ liệu quản trị.

**Đính chính phép thử lifecycle trong lúc triển khai:** CDP frozen trên page headless vẫn visible đã không đóng băng trang: probe sau đó ghi nhận 72 RAF trong 1,2 giây và không có freeze/resume event. Vì vậy, số 232px bên dưới là cuộn bình thường trong thời gian đó, không chứng minh bước nhảy sau đóng băng. Không dùng cột này làm bằng chứng lỗi. Rủi ro timestamp không giới hạn được kiểm tra riêng bằng fixture tăng timestamp RAF; luồng hidden/freeze/resume/pagehide dùng mock tại ranh giới DOM. Xem `verification/auto-lifecycle-calibration.json`; đóng băng OS/trình duyệt thật chưa được xác minh.

## Kết luận

Đường chuyển chương vẫn nhanh trong mẫu đo mới: **10 / 14 / 16 / 14 ms, 0 request chuyển chương**. Nhóm nên xử lý tiếp là **tự cuộn**, với ba phát hiện đã tái hiện ở VI/EN trên desktop và viewport điện thoại. Không có bằng chứng mới cần thêm tính năng hoặc viết lại editor.

## 1. P2 — Tự cuộn thiếu bảo vệ khi có khoảng ngắt khung hình/lifecycle

- **Vị trí:** `src/components/Reader.tsx:740–776`, đặc biệt `delta = ((now-last)/1000)*settings.scrollSpeed` tại dòng 750. Biến last không được reset khi có khoảng ngắt lifecycle, delta không có giới hạn. Handler visibility hiện chỉ flush tiến độ.
- **Quan sát ban đầu đã đính chính:** CDP frozen/active cách nhau 2.200 ms, đọc vị trí sau 80 ms thấy tăng 232px, nhưng page vẫn visible và không thực sự ngừng RAF. Không thể suy từ đây rằng app đã nhảy khi khôi phục. Code vẫn không có guard cho khoảng timestamp lớn; regression riêng với timestamp RAF tăng 10.000 ms ở bản cũ cho thấy auto không dừng, và mock hidden/pagehide cũng không dừng auto.
- **Ảnh hưởng:** Sau khoảng gián đoạn, nội dung có thể nhảy qua đoạn người đọc chưa xem. Khoảng ngắt càng dài càng dễ chạy tới cuối chương và ghi tiến độ mới.
- **Sửa nhỏ nhất:** Tạm dừng khi trang ẩn/freeze, reset timestamp khi khôi phục và chặn delta quá lớn để không chạy bù thời gian không hiển thị. Dùng listener/RAF hiện có, không cần thư viện lifecycle hoặc timer nền mới. Quy định rõ người đọc tự bật tiếp hay tiếp tục từ cùng vị trí; ưu tiên giữ chỗ đang đọc.
- **Cơ sở:** [Chrome Page Lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) mô tả freeze/resume; [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) giải thích callback thường bị tạm ngừng ở tab nền. Nguy cơ khi chuyển app là suy luận từ cơ chế này và phép freeze đã đo, chưa phải kết quả Android/iOS vật lý.

## 2. P2 — Cuộn tay chưa dừng tự cuộn

- **Vị trí:** Vòng tự cuộn trong Reader; vùng `.reading-scroll` chỉ có onScroll lưu tiến độ, không có điều kiện dừng theo wheel/touchmove.
- **Tình huống:** Khi auto đang chạy, cuộn lên bằng wheel thật trong Chromium desktop hoặc gesture touch qua CDP ở mobile viewport. Sau thao tác, icon auto vẫn aria-pressed=true; nội dung tiếp tục đi thêm **35–37 px trong 350 ms**. Đối chứng: bấm Dừng tự cuộn rồi chờ cùng 350 ms, dịch chuyển **0 px**.
- **Ảnh hưởng:** Người đọc kéo ngược để đọc lại nhưng trang tiếp tục trôi xuống, phải mở bảng để dừng thủ công. Không mất nội dung sách, nhưng thao tác tay phải cạnh tranh với tự cuộn.
- **Sửa nhỏ nhất:** Dừng auto khi có wheel/touchmove chủ động trong vùng truyện; có thể dừng khi bắt đầu chọn chữ. Không dùng chính scroll event để suy ra ý định vì nó cũng phát ra từ tự cuộn. Chỉnh tốc độ trong panel vẫn cần hoạt động bình thường.
- **Tham khảo:** [Novel-Hub useAutoScroll](https://github.com/AzenKain/Novel-Hub/blob/28b6972e5b4f749124e4e27200bd76c4b6168d38/web/src/hooks/useAutoScroll.ts#L53) đã dùng wheel/touchmove với listener passive trên vùng nội dung. Học cơ chế dừng theo thao tác tay này, kết hợp xử lý khoảng ngắt đã đo riêng trong app.

## 3. P2 — Thanh tốc độ tự cuộn thiếu tên cho công cụ hỗ trợ

- **Vị trí:** `Reader.tsx:2121–2136`: label chứa output trước input range, không có liên kết for/id hoặc aria-label cho slider.
- **Bằng chứng:** Input.labels là [], aria-label=null. Accessibility snapshot hiện `status "Scroll speed 28"` nhưng chỉ `slider: "28"`, không có tên slider. Cả VI/EN trên hai viewport đều tái hiện. Locator slider theo tên không tìm được; đổi sang CSS locator thì vẫn chỉnh tốc độ được.
- **Ảnh hưởng:** Người nhìn màn hình vẫn thấy chữ tốc độ; người dùng trình đọc màn hình gặp thanh trượt không có tên rõ ràng.
- **Nguyên nhân:** Nhãn ngầm gắn vào output là phần tử labelable đầu tiên. Quy tắc này được định nghĩa trong [HTML Standard — label](https://html.spec.whatwg.org/multipage/forms.html#the-label-element).
- **Sửa nhỏ nhất:** Gắn aria-label VI/EN trực tiếp cho range, hoặc liên kết label với input bằng for/id. Kiểm tra lại role/name và thao tác bàn phím, giữ output hiển thị giá trị.

## Số đo kiểm tra

| Tổ hợp | Auto bình thường /250 ms | Cuộn qua CDP attempt 2,2 s +80 ms (không thực sự freeze) | Trôi tiếp sau cuộn tay /350 ms | Sau bấm Dừng /350 ms |
|---|---:|---:|---:|---:|
| Desktop VI | 26 px | 232 px | 37 px | 0 px |
| Desktop EN | 28 px | 232 px | 36 px | 0 px |
| Mobile viewport VI | 26 px | 232 px | 35 px | 0 px |
| Mobile viewport EN | 26 px | 232 px | 37 px | 0 px |

Desktop dùng native wheel; mobile dùng CDP touch scroll. Không có page error trong bốn ca hoàn tất. Harness đầu tiên dùng accessible name cho slider đã dừng vì slider thực sự không có tên; lần hoàn tất dùng CSS locator và lưu cả labels/aria snapshot. Số đo px có thể khác theo tốc độ/frame, mục tiêu là phân biệt khoảng nhảy và chứng minh auto chưa dừng.

## Đối chiếu nguồn và giới hạn

- Hai repo được git fetch lại: Novel-Hub vẫn `28b6972e5b4f749124e4e27200bd76c4b6168d38`, EPUB-Forge vẫn `33120281bfc6faa51d43f5bd45dbbcab882da5d7`. Đọc lại useAutoScroll/useTTS và [PreviewPanel](https://github.com/AzenKain/EPUB-Forge/blob/33120281bfc6faa51d43f5bd45dbbcab882da5d7/src/components/PreviewPanel.tsx)/EditChapterModal. Không sao chép hay chạy lại backend hai repo trong lượt này.
- Bằng chứng mới: `verification/reading-audit-6.json`, `verification/navigation-audit-6.json`. Bộ 73 unit và 103 ca đã xác minh của release hiện tại được giữ trong VERIFICATION.md; không tính là đã chạy lại lần này vì không đổi runtime.
- Không đăng nhập admin, tạo nháp, thay đổi sách hoặc deploy. Chưa kiểm tra điện thoại vật lý, âm thanh bằng tai, lifecycle thực của Safari/Android hoặc audit WCAG/security toàn diện. Không khẳng định mọi lần chuyển app đều gây nhảy.

Ưu tiên sửa hai hành vi tự cuộn và nhãn slider trong cùng một thay đổi nhỏ, rồi kiểm thử lifecycle, wheel/touch, paged/scroll và tốc độ. Các tối ưu đã đo tốt nên giữ ổn định.
