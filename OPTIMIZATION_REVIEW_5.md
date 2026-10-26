# Kiểm tra sau release chỗ nghe/tìm sách — 24/10/2026

Mốc audit trước sửa: production READY `dpl_6VxqBvENmJkCCLKvsYcYZoo7YpxM`, runtime source `422d36cd8a1a3a0316bc750ddb8e73383e942989`. Sau khi người dùng duyệt sửa cả ba mục, đã triển khai vào 26/10/2026 tại `dpl_3QKCyPvofZHDpMRbtkPwga2K1Saj`; xem đầu VERIFICATION.md và DEPLOYMENT.json cho kết quả mới. Những phát hiện/số đo bên dưới vẫn là bằng chứng trước sửa; không ghi nội dung sách trong audit hoặc đợt sửa này.

Web dành cho một sách VI/EN, đọc công khai, vài editor biên tập. Phạm vi mới: mở/tìm/đổi từ khóa, các bảng công cụ chồng nhau, code nghe tiếp và preview; không phải audit bảo mật, WCAG toàn diện hay tải lớn. Hai repo được git fetch lại, upstream vẫn là Novel-Hub `28b6972e5b4f749124e4e27200bd76c4b6168d38`, EPUB-Forge `33120281bfc6faa51d43f5bd45dbbcab882da5d7`.

## Kết luận

Có **2 P2 và 1 P3** tái hiện được trong luồng dùng bình thường. Không có P0/P1 được xác nhận trong phạm vi này. Thứ tự nên làm: tránh panel che mục lục trên điện thoại → giảm khựng khi mở tìm kiếm → xóa highlight tìm kiếm đã cũ. Không đề xuất thêm tiện ích mới trong đợt này.

## 1. P2 — Bảng giọng đọc che mục lục trên điện thoại

- **Vị trí:** `Reader.tsx:866` (togglePanel), `Reader.tsx:1337` (toggleSidebar); CSS `.reader-panel` z-index 70 và sidebar có lớp riêng.
- **Tình huống:** Ở 390×844, mở Giọng đọc & tốc độ rồi bấm Mở mục lục. Cả hai trạng thái cùng mở; elementFromPoint ở giữa ô tìm chương thuộc reader-panel, không phải ô tìm chương. Tái hiện ở cả VI/EN. Ảnh QA cho thấy panel giọng đọc che ô tìm và phần lớn danh sách; desktop 1440px không che ô tìm.
- **Ảnh hưởng:** Nút menu đã phản hồi nhưng người dùng không thao tác được ngay trong mục lục, phải tự đóng bảng giọng đọc trước. Có workaround, không mất dữ liệu.
- **Sửa nhỏ nhất:** Trong viewport dùng sidebar dạng overlay, mở sidebar thì đóng panel đang mở; mở panel thì đóng sidebar. Dùng trạng thái/handler hiện có, khớp breakpoint thực tế. Desktop vẫn có thể giữ sidebar cạnh vùng đọc. Kiểm tra chiều ngược lại và các panel cài đặt/âm thanh/tự cuộn.
- **Tham khảo:** Novel-Hub quản lý các lớp công cụ ở ReaderWorkspace/ReaderTopBar và đóng từng lớp khi Escape. Không giả định repo tham khảo tự giải quyết mọi trường hợp overlap; lỗi ở đây được xác minh trên app hiện tại.

## 2. P2 — Chuẩn bị chỉ mục tìm kiếm chặn main thread, còn làm lại khi đổi tab

- **Vị trí:** `Reader.tsx:1272–1297` và `src/lib/book-search.ts`. Khi tab là search, useMemo parse HTML từng chương và chuẩn hóa từng ký tự để giữ map offset; chuyển tab khác trả [], quay lại search tạo lại toàn bộ.
- **Đo:** Từ click tab tới hai animation frame tiếp theo, không tính tải trang/mạng. Mỗi locale/viewport một mẫu, browser đã tải font. Đây là phép đo tương tác riêng, không phải INP thực địa.

| Mẫu | Mở đầu | Mở lại sau đổi tab | Gõ từ khóa khi đã mở |
|---|---:|---:|---:|
| Desktop VI | 69 ms | 59 ms | 20 ms |
| Desktop EN | 55 ms | 58 ms | 23 ms |
| 390px, CPU chậm 4×, VI | 321 ms | 306 ms | 155 ms |
| 390px, CPU chậm 4×, EN | 301 ms | 284 ms | 72 ms |

- Có long task 265–297 ms ở các lần mở tab mobile mô phỏng. Gõ thử từ thông dụng trả 100 kết quả; độ trễ thấp hơn bước chuẩn bị. Không suy ra mọi bàn phím/điện thoại sẽ có cùng số đo.
- **Ảnh hưởng:** Mở tìm kiếm có cảm giác khựng trên máy chậm; đổi qua mục lục/ghi chú rồi quay lại vẫn mất công chuẩn bị đó.
- **Sửa nhỏ nhất:** Giữ chỉ mục đã chuẩn bị trong vòng đời snapshot book/locale hiện tại sau lần dùng đầu; hủy khi snapshot/locale thay đổi. Lần đầu chia công việc thành phần có nhường main thread, có trạng thái đang chuẩn bị. Chỉ bọc cùng phép tính đồng bộ trong useMemo/useTransition không tự làm long task biến mất. Không cần dịch vụ tìm kiếm/server cache mới.
- **Nếu để nguyên:** Đổi chương/đọc thường vẫn nhanh; phần tìm kiếm trên thiết bị chậm còn giật mỗi lần quay lại tab.
- **Tham khảo:** [Novel-Hub ReaderInBookSearch](https://github.com/AzenKain/Novel-Hub/blob/28b6972e5b4f749124e4e27200bd76c4b6168d38/web/src/components/reader/ReaderInBookSearch.tsx) có trạng thái loading và tìm khi submit. Với sách đơn hiện tại, giữ tìm local là phù hợp; có thể học cách phản hồi đang xử lý, không cần bê backend tìm kiếm sang.

## 3. P3 — Kết quả tìm cũ vẫn được tô sáng sau khi đổi từ khóa

- **Vị trí:** `Reader.tsx:1111–1148`, `Reader.tsx:1503`. Registry key search-result chỉ bị xóa khi đổi chapter/locale/revision, không theo query.
- **Tình huống:** Tìm một từ, chọn kết quả, rồi thay bằng `zzzznoresultxyz`. Sidebar hiện 0 kết quả nhưng CSS.highlights vẫn chứa range search-result của từ cũ. Cả VI/EN trên hai viewport đều tái hiện.
- **Ảnh hưởng:** Chữ vàng trên trang không còn ứng với từ đang tìm, tạo cảm giác kết quả không đồng bộ. Không đổi HTML, ghi chú hoặc offset đã lưu.
- **Sửa nhỏ nhất:** Xóa riêng search-result khi đổi/xóa query; tạo lại khi chọn kết quả mới. Giữ các registry highlight ghi chú. Đóng sidebar sau khi chọn kết quả trên phone vẫn nên giữ highlight đúng của lựa chọn đó.

## Những phần đang tốt và nên giữ

- Đo lại Next/Previous trên production: **16 / 14 / 15 / 15 ms**, **0 request chuyển chương**. Không thấy lý do sửa đường chuyển chương từ các mẫu này.
- Bốn tổ hợp UI VI/EN × desktop/mobile mô phỏng hoàn tất không có page error. Tìm kiếm lúc đã mở nhanh hơn chuẩn bị; tập trung vào đúng bước bị chặn.
- Luồng nghe tiếp đã có phân biệt locale/revision và không tự phát khi load. Release trước có kiểm chứng 71 unit / 88 E2E; các con số đó là bằng chứng release, không phải bộ chạy lại trong audit này.
- Đọc lại [EPUB-Forge PreviewPanel](https://github.com/AzenKain/EPUB-Forge/blob/33120281bfc6faa51d43f5bd45dbbcab882da5d7/src/components/PreviewPanel.tsx): dùng iframe và khung thiết bị để preview. App hiện tại đã có khung 390/780px và sanitizer; chưa có bằng chứng mới cần thêm tablet/Kindle/zoom hoặc viết lại editor. Chỉ khảo sát code preview lần này, không đăng nhập và lưu nháp mới.

## Bằng chứng / giới hạn

- `verification/ux-followup-audit-5.json`: timing, long tasks, highlight cũ và kiểm tra phần tử bị panel che. Ảnh mobile trong vùng QA bị loại khỏi source/deployment.
- `verification/navigation-audit-5.json`: bốn mẫu chuyển chương hiện tại.
- Không chấm điểm tổng toàn bộ app từ một audit chọn lọc các luồng mới; không dùng các số lab này để tuyên bố Core Web Vitals của người dùng thật.
- Không sửa runtime, dependency, schema, nội dung published hoặc tài khoản. Không chạy lại toàn bộ unit/E2E vì không có code thay đổi. Chưa thử Android/iOS vật lý, giọng bằng tai, phát nền/khóa màn hình, import lớn hoặc audit security/WCAG toàn diện.
