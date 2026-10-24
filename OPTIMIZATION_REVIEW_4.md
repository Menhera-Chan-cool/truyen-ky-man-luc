# Rà soát trải nghiệm tiếp theo — 24/10/2026

Web phục vụ một sách VI/EN, khách đọc công khai và vài owner/editor biên tập. Lượt này kiểm tra bản production `dpl_FJBcGQUKnXxwJRpcRn2KFACTnRvr`, runtime `f7ee05bf28908ec111ae9f2b3b44e9adcb90bcee`; repository hiện ở commit bằng chứng `d4bc4989ff553ba8d58172d71807ca4f480aeea5`.

Đây là báo cáo, chưa sửa hoặc deploy thêm. Không ghi nội dung sách, không tạo tài khoản, không truy cập khu biên tập bằng mật khẩu owner. Phạm vi: reader trên Chromium desktop 1440×900/mobile 390×844, VI/EN; code tooltip, điều hướng, TTS, tìm chương và preview editor. Không phải audit bảo mật toàn hệ thống hoặc chứng nhận WCAG.

## Kết luận

Không thấy lỗi chặn đọc trong các luồng đã kiểm tra. Còn **2 P2 và 1 P3** đã tái hiện. Hai đề xuất tính năng ở cuối là tùy chọn, không tính là lỗi. Ưu tiên sửa 1–3 rồi dùng thử trên điện thoại thật trước khi mở rộng tính năng.

| Kiểm tra chọn lọc | Điểm /4 | Bằng chứng và giới hạn |
|---|---:|---|
| Accessibility | 3 | Các control có nhãn và panel đóng bằng Escape; Escape tại ô tìm chương/ghi chú bị bỏ qua. Chưa chứng nhận toàn bộ WCAG. |
| Performance | 3 | Chuyển chương 5–18 ms, 0 request; cuộn p95 18–19 ms. Lần mở đầu còn biến động theo mạng/backend, chưa có dữ liệu người dùng thực. |
| Responsive | 3 | VI/EN ở 390px không có page error trong ca kiểm tra; mục lục không đưa chương 20 vào vùng nhìn thấy. Chưa thử máy vật lý. |
| Theming | 3 | Giữ hệ giấy ngà/mực trầm và tokens đã duyệt; lượt này không kiểm tra lại mọi tổ hợp màu tùy biến. |
| Implementation integrity | 4 | Giữ mô hình một sách, điều hướng tại chỗ và không thêm framework/dependency. Ba file UI được gọi detector, exit 0, không có finding qua stdout; điều này không chứng minh mọi tương tác đều đúng. |
| Tổng tham khảo | 16/20 | Phạm vi chọn lọc khác các đợt trước; không dùng chênh lệch điểm làm thước đo tiến bộ hay điểm Core Web Vitals. |

## 1. P2 — Mục lục không tự hiện chương đang đọc

- **Vị trí:** `src/components/Reader.tsx:1295` — danh sách có `aria-current` nhưng không cuộn tới phần tử hiện tại.
- **Tình huống:** Mở thẳng chương 20, rồi mở mục lục trên điện thoại; chương 20 nằm ngoài vùng nhìn thấy. VI desktop: phần tử ở y=1395–1441, khung danh sách kết thúc y=847; mobile kết thúc y=791. Cả VI/EN, desktop/mobile đều tái hiện, `scrollTop=0`.
- **Ảnh hưởng:** Người đang đọc các chương sau phải tự cuộn mục lục để tìm vị trí của mình.
- **Sửa nhỏ nhất:** Khi mở mục lục hoặc đổi chương/tab mục lục, cuộn phần tử hiện tại trong riêng danh sách bằng `block: nearest`; không cuộn vùng truyện, không giành focus hoặc reset vị trí người dùng đang lọc.
- **Nếu để nguyên:** Vẫn đọc được, nhưng mỗi lần mở mục lục ở cuối sách đều có thao tác thừa.
- **Tham khảo:** [Novel-Hub ReaderSidebar, dòng 691–699](https://github.com/AzenKain/Novel-Hub/blob/28b6972e5b4f749124e4e27200bd76c4b6168d38/web/src/components/reader/ReaderSidebar.tsx#L691) đã cuộn tới active chapter khi đổi chương/tab.
- **Hướng xử lý:** Impeccable adapt/harden; kiểm thử cả trực tiếp chương 20, Next/Previous và đổi tab ghi chú/mục lục.

## 2. P2 — Escape bị bỏ qua khi đang nhập tìm chương hoặc ghi chú

- **Vị trí:** `src/components/Reader.tsx:703–716` — guard bỏ qua input/textarea/select chạy trước xử lý Escape.
- **Tình huống:** Focus ô tìm chương rồi Escape: sidebar còn mở. Chọn chữ, gõ ghi chú rồi Escape: popup còn mở. Tái hiện cả VI/EN trên hai viewport bằng bàn phím mô phỏng. Control đối chứng: focus select trong bảng giọng đọc rồi Escape đóng panel thành công nhờ handler riêng trong `Ui.tsx`.
- **Ảnh hưởng:** Phím đóng không nhất quán giữa các bảng; người dùng bàn phím phải rời ô nhập hoặc tìm nút đóng.
- **Sửa nhỏ nhất:** Xử lý Escape trước guard dành cho phím điều hướng; bỏ qua khi đang IME composition. Chỉ xử lý đúng lớp UI đang mở, giữ nội dung ghi chú đang gõ theo quy tắc hiện có. Không để ArrowLeft/Right trong input lật trang.
- **Nếu để nguyên:** Không mất nội dung đã lưu, nhưng thao tác bàn phím bị gián đoạn. Đây là lỗi tương tác đã kiểm chứng, không quy kết vi phạm WCAG cụ thể khi chưa audit đầy đủ.
- **Hướng xử lý:** Impeccable harden; thêm ca Escape ở note/search, composition và đối chứng ArrowLeft/Right.

## 3. P3 — Tooltip giữ nhãn cũ khi nút thay trạng thái

- **Vị trí:** `src/components/Tooltips.tsx:39–57` — label chỉ được chụp khi show; cùng anchor bị return, không theo dõi `data-tooltip` thay đổi.
- **Tình huống:** Rê lên nút đọc rồi bấm, giữ con trỏ: nút đã là Pause nhưng tooltip vẫn “Đọc giọng nói”/“Read aloud”. Tái hiện desktop VI/EN; ảnh bằng chứng trong vùng QA. `aria-label` của nút đã đổi đúng.
- **Ảnh hưởng:** Tooltip mô tả hành động cũ, gây cảm giác UI chưa phản hồi dù giọng đã bắt đầu.
- **Sửa nhỏ nhất:** Đồng bộ label khi thuộc tính tooltip của anchor hiện tại đổi, hoặc đóng tooltip khi click rồi hiển thị trạng thái mới lần tiếp theo. Nếu tiếp tục dùng bubble chung, chỉ quan sát anchor đang mở; không quét toàn DOM mỗi frame.
- **Nếu để nguyên:** Chỉ sai phản hồi thị giác dưới con trỏ, không làm nút đọc mất chức năng.
- **Hướng xử lý:** Impeccable polish; kiểm tra đọc/tạm dừng/tiếp tục và các toggle khác, hover/focus/reduced motion.

## Hai tiện ích tùy chọn

4. **Tìm trong nội dung cả bản VI hoặc EN.** Hiện sidebar tìm tiêu đề chương hoặc ghi chú, chưa tìm câu trong truyện. [Novel-Hub ReaderInBookSearch](https://github.com/AzenKain/Novel-Hub/blob/28b6972e5b4f749124e4e27200bd76c4b6168d38/web/src/components/reader/ReaderInBookSearch.tsx) có luồng này. Với sách hiện tại, có thể tìm trong snapshot published đã nạp trên thiết bị, hiển thị chương + đoạn trích rồi đi tới neo đúng revision; không cần dịch vụ tìm kiếm hoặc database mới. Chưa phải lỗi trong kế hoạch gốc.

5. **Preview biên tập theo khung điện thoại/desktop.** `RichEditor.tsx:249–253` có HTML preview nhưng chưa có lựa chọn kích thước hoặc cùng typography với reader. [EPUB-Forge PreviewPanel](https://github.com/AzenKain/EPUB-Forge/blob/33120281bfc6faa51d43f5bd45dbbcab882da5d7/src/components/PreviewPanel.tsx) có thiết bị/theme/zoom. Nên thêm lựa chọn khung và tái dùng CSS đọc nếu owner thường thêm ảnh/bảng. Đây là khảo sát code preview, chưa phải kiểm thử bằng tài khoản trên admin thật trong đợt này.

## Hiệu năng đo lại và các điểm nên giữ

- 4 lần Next/Previous trên URL production: **18 / 5 / 14 / 14 ms**, **0 request chuyển chương**. Tính từ click tới tiêu đề mới ở animation frame kế tiếp, không phải INP chuẩn hoặc cam kết cho mọi máy.
- Cuộn 120 frame: p95 **18 ms desktop**, **19 ms mobile CPU chậm 4×**; mỗi mẫu 4 lần ghi tiến độ, không có long task trong đoạn cuộn. Không có tràn ngang hoặc page error trong hai mẫu này.
- Mẫu mở reader: desktop FCP/LCP 2,884 s, mobile CPU 4× 1,920 s. TTFB 1,182 s/0,369 s tương ứng. Mạng/backend không được kiểm soát; không diễn giải desktop chậm hơn là lỗi responsive. Hai long task lúc khởi tạo mobile 175/116 ms cần trace sâu trước khi quy cho component cụ thể.
- Không có bằng chứng để thay đường chuyển chương đã tối ưu hoặc viết lại editor. Giữ snapshot published theo locale, lazy-load công cụ nặng và coalescing ghi tiến độ hiện có. Không thêm cache server/Service Worker cho dữ liệu sách chỉ để làm đẹp số đo; cần giữ thu hồi/xuất bản đúng.
- Đã đọc lại hai repo qua `git fetch`; upstream vẫn là Novel-Hub `28b6972e5b4f749124e4e27200bd76c4b6168d38`, EPUB-Forge `33120281bfc6faa51d43f5bd45dbbcab882da5d7`. Không sao chép code trong lượt này. Cách serialize khi save của EPUB-Forge là tham khảo; phép đo editor trước đó chưa cho thấy cần thay Tiptap hiện tại.

## Bằng chứng và giới hạn

`verification/ux-followup-audit-4.json`, `verification/navigation-audit-4.json`, `verification/performance-audit-4.json`. Mỗi tổ hợp UI hoàn tất đều không có page error. Harness đã sửa selector tiếng Anh và một lượt navigation timeout trước lượt hoàn tất; đây không được tính là lỗi sản phẩm. Không chạy lại toàn bộ unit/E2E vì không sửa runtime. Kết quả 67 unit và 75 E2E của release hiện tại được lưu trong VERIFICATION.md, không gọi đó là lần chạy mới của audit này.

Chưa thử giọng bằng tai, Android/iOS vật lý, tắt màn hình/phát nền, môi trường mạng cố định, admin có đăng nhập hoặc audit bảo mật/WCAG toàn diện. Không khẳng định một giọng duy nhất trên điện thoại là lỗi app; danh sách vẫn do browser/OS cung cấp.

Thứ tự đề xuất: harden/adapt cho 1–2, polish cho 3; chỉ triển khai 4–5 nếu người dùng muốn thêm tiện ích. Có thể yêu cầu làm riêng từng mục hoặc cả nhóm.
