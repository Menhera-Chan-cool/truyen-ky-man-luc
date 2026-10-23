# Đánh giá độ mượt và trải nghiệm — 23/10/2026

Đã kiểm tra trực tiếp https://truyen-ky-man-luc.vercel.app và đối chiếu hai repo. Các số liệu dưới đây là mốc **trước tối ưu**. Sau khảo sát, năm thay đổi đã được triển khai trong source; trạng thái kiểm chứng/triển khai mới được ghi trong `VERIFICATION.md` và `DEPLOYMENT.json`.

## Cách đo và giới hạn

- Chromium, cửa sổ 1440×900 và 390×844; lần mở mới với bộ nhớ đệm trình duyệt trống cho từng trang. Mẫu điện thoại dùng CPU chậm 4 lần; không giả lập giới hạn băng thông.
- Đo `/vi`, `/vi/read/chapter-1`, `/admin?lang=vi`; mỗi cấu hình một lượt hoàn chỉnh. Có lượt riêng kiểm tra dịch chuyển bố cục và chuyển chương.
- Các phép đo là mẫu trong phòng thử nghiệm, không phải điểm Lighthouse, số liệu Core Web Vitals của người dùng thật hoặc cam kết tốc độ trên Android. LCP/CLS có thể thay đổi theo mạng, cache, font và nội dung đã lưu.
- Không đăng nhập owner, sửa bản nháp, xuất bản hoặc thu hồi nội dung trong đợt khảo sát. Nhận xét về tải dữ liệu editor dựa trên code API và nơi gọi.

## Kết quả hiện tại

| Phép đo | Desktop | Mô phỏng điện thoại, CPU chậm 4 lần |
|---|---:|---:|
| Trang sách: JavaScript nén | 193.019 byte | 193.019 byte |
| Trình đọc: JavaScript nén | 212.970 byte | 212.970 byte |
| Trang đăng nhập quản trị: JavaScript nén | 652.477 byte | 652.477 byte |
| Trang đăng nhập: JavaScript sau giải nén | 1.918.609 byte | 1.918.609 byte |
| Trình đọc: CLS lúc mở | 0,203 | 0 |
| Trang đăng nhập: CLS lúc mở | 0,254 | 0,027 |
| Ghi tiến độ trong 120 khung cuộn, khoảng 2 giây | 240 lần `put` | 240 lần `put` |
| Thời gian khung hình cuộn ở phân vị 95 | 18 ms | 18 ms |

Không có lỗi JavaScript hoặc tràn ngang trong sáu lượt đo. Không ghi nhận tác vụ dài trên main thread trong bài cuộn này; vì vậy chưa có bằng chứng kết luận việc ghi tiến độ đang gây giật trên điện thoại thật.

Chuyển chương có bốn mẫu **19 / 13 / 10 / 12 ms**, tất cả **0 yêu cầu tải chương từ server**. Nên giữ cách chuyển chương hiện tại cho quy mô sách này.

## Thứ tự cải thiện đề xuất

### 1. Giảm công việc khi cuộn, giữ việc lưu vị trí an toàn

`Reader.tsx:onScroll` cập nhật state React và gọi `writeProgress` mỗi sự kiện. Mỗi lần lưu mở một transaction IndexedDB, ghi hai khóa: vị trí cuối của ngôn ngữ và vị trí của chương. 240 lần put tương ứng 120 lần gọi lưu trong khoảng hai giây cuộn.

Đề xuất: giữ vị trí mới nhất bằng ref; chỉ cập nhật phần trăm khi giá trị hiển thị đổi; gom lưu theo khoảng thời gian khi đang cuộn và lưu ngay khi dừng. Phải chốt vị trí khi đổi chương/ngôn ngữ, chuyển nền và rời trang; mỗi bản ghi phải giữ đúng chapter ID, locale và revision. Không chỉ debounce vô hạn vì tự cuộn có thể chạy lâu. Không thể bảo đảm ghi lần cuối nếu hệ điều hành đóng cưỡng bức trình duyệt, nên vẫn cần lưu định kỳ.

Đối chiếu: [Novel-Hub ReaderWorkspace](https://github.com/AzenKain/Novel-Hub/blob/28b6972e5b4f749124e4e27200bd76c4b6168d38/web/src/pages/reader/ReaderWorkspace.tsx) gom thao tác lưu bằng timeout 2 giây sau sự kiện cuộn. Có thể học cách giảm tần suất, bổ sung các điểm chốt phù hợp với dữ liệu trên thiết bị của sách này.

Nghiệm thu: giảm rõ số lần ghi trong cùng bài cuộn; vị trí đúng sau đổi chương nhanh, quay lại, đổi VI/EN, tải lại và chuyển nền; không mất ghi chú.

### 2. Loại bỏ việc nội dung nhảy ngang lúc mở trình đọc

Đã xác định nguồn của dịch chuyển chính: `.reader-main` ban đầu rộng 1440 px ở x=0; sau khi effect mở sidebar, nó chuyển sang x=310 và rộng 1130 px. Riêng thay đổi này tạo CLS khoảng **0,201**. Đây là tác động nhìn thấy được, không chỉ là điểm đo.

Đề xuất: CSS xác định bố cục desktop có mục lục ngay từ khung đầu, rồi React tiếp quản thao tác đóng/mở. Mobile vẫn đóng mục lục ban đầu. Cần tránh hiển thị sai theme/phông khi đang đọc cài đặt thiết bị. Trang đăng nhập cũng nên giữ cùng khung kích thước giữa trạng thái kiểm tra phiên và form đăng nhập; hiện CLS chính đến từ thay cả khối loading bằng form.

Nghiệm thu: không còn dịch chuyển ngang 310 px do khởi tạo; kiểm tra cả mở trực tiếp, reload với cài đặt đã lưu và màn hình hẹp.

### 3. Chỉ tải bộ nhập file và biên tập khi cần

Trang đăng nhập tải gần **3,1 lần** JavaScript của trình đọc. `Admin.tsx` import trực tiếp RichEditor/Tiptap và ImportPanel; ImportPanel kéo thêm pdf-lib và bộ nhập EPUB/HTML. Trong mô phỏng CPU chậm, trang đăng nhập có tác vụ main-thread dài **391 ms**. Chưa phân bổ riêng thời gian cho từng thư viện, nên không quy toàn bộ tác vụ này cho Tiptap.

Đề xuất: tách tải RichEditor khi có phiên và chọn sửa chương; tải ImportPanel khi mở tab nhập file. Có khung loading ổn định và trạng thái lỗi tải module. Giữ nguyên cơ chế `editorContext/formReady`, kiểm tra phiên bản và khóa thao tác khi lưu để tránh tái phát lỗi trộn chương VI/EN.

Nghiệm thu: lần mở trang đăng nhập không tải chunk editor/import; sau đăng nhập, dán và lưu liên tiếp các chương VI/EN vẫn chính xác; nhập file và xem PDF hoạt động. PDF.js trong PdfViewer hiện đã tải động, nên không cần thay lại phần đó.

### 4. Trang giới thiệu chỉ lấy metadata; editor chỉ lấy nội dung cần sửa

`getBook()` hiện lấy cả bản công khai của hai ngôn ngữ và sanitize tất cả HTML. Trang giới thiệu sau đó bỏ toàn bộ HTML trước khi gửi cho trình duyệt. Đo RPC bằng khóa anon cho thấy JSON **865.640 byte**, trong đó HTML **855.831 byte**. Sanitize toàn bộ tốn **243–333 ms trên Node chạy tại máy này**; đây không phải phép đo CPU của Vercel.

Đề xuất: truy vấn metadata/mục lục riêng cho trang sách. Với trình đọc, giữ tải trước các chương của ngôn ngữ đang chọn để bảo toàn chuyển chương tức thời. Với editor, API state trả danh sách và con trỏ phiên bản, còn HTML tải theo chương được chọn; khi lưu chỉ cập nhật phần liên quan thay vì tải lại toàn bộ bản nháp của hai ngôn ngữ.

Đối chiếu: [Novel-Hub readerService](https://github.com/AzenKain/Novel-Hub/blob/28b6972e5b4f749124e4e27200bd76c4b6168d38/web/src/services/readerService.ts) phân biệt bootstrap, HTML chương và prefetch. [EPUB-Forge EditChapterModal](https://github.com/AzenKain/EPUB-Forge/blob/33120281bfc6faa51d43f5bd45dbbcab882da5d7/src/components/EditChapterModal.tsx) chỉ fetch HTML chương khi mở cửa sổ sửa, theo book ID và chapter index. Ứng dụng này nên tiếp tục dùng chapter ID ổn định và revision hiện có.

Nghiệm thu: trang sách không truy vấn nội dung chương; sửa chương không tải lại toàn bộ sách; yêu cầu cũ trả muộn không thay được chương mới; quyền/RLS và sanitize vẫn giữ nguyên. Nếu thêm cache công khai, xuất bản và thu hồi phải làm mất hiệu lực cache đúng lúc. Đây là thay đổi dữ liệu cần kiểm thử kỹ hơn ba mục đầu.

### 5. Giữ lựa chọn nền nhất quán giữa trang sách và trình đọc

Đã thử chọn nền tối trong trình đọc rồi quay về Chi tiết sách: trang sách trở lại nền sáng. `BookDetail` khởi tạo `dark=false` và không khôi phục lựa chọn. Trải nghiệm đọc đêm có thể bị chói khi quay lại hoặc đổi ngôn ngữ.

Đề xuất: lưu lựa chọn nền của trang sách và thống nhất quy tắc nền với trình đọc; áp dụng trước khi vẽ nội dung để tránh lóe sáng. Cần quy định cách ánh xạ các nền như cà phê/e-ink/tùy biến trước khi dùng chung cài đặt, thay vì tự thay lựa chọn màu của người đọc.

## Những phần nên giữ và những việc chưa đáng làm

- Giữ chuyển chương bằng dữ liệu đã tải: đang đạt 10–19 ms trong mẫu kiểm tra. Chưa cần chuyển sang hệ thống tải từng chương phức tạp cho một sách nhỏ.
- Giữ bộ font đã yêu cầu. Chưa có bằng chứng cần xóa font để cải thiện tốc độ; font-face không đồng nghĩa tất cả file font đều được tải.
- Chưa cần virtualize danh sách 20 câu chuyện, viết lại toàn bộ reader hoặc thêm thư viện animation.
- Chưa kết luận WebAudio gây khựng: code có sinh buffer trên main thread, nhưng cần đo riêng thao tác phát/phối âm trước khi đổi kiến trúc.
- Chưa đề xuất cache offline toàn sách trong đợt này vì cần thiết kế cập nhật/thu hồi bản công khai và hành vi khi dữ liệu cũ còn trên thiết bị.

## Bằng chứng và cách chạy lại

- `verification/performance-audit-2026-10-23.json`: sáu mẫu tải trang, ghi IndexedDB, khung hình cuộn, lỗi JS và tràn ngang.
- `verification/performance-details-2026-10-23.json`: phần tử và tọa độ gây layout shift; thử nền tối rồi về trang sách.
- `verification/book-payload-audit-2026-10-23.json`: ba lần gọi RPC công khai, kích thước và thời gian sanitize cục bộ.
- `verification/navigation-audit-2026-10-23.json`: bốn lần chuyển chương trực tiếp trên production.
- Script khảo sát ở `D:\codex\2026-10-22\p\work\performance-audit.mjs`, `performance-details.mjs`, `book-payload-audit.mts`, `navigation-bench.mjs`. Script payload chỉ đọc cấu hình sẵn có, không in khóa hoặc nội dung sách.

Novel-Hub đã kiểm tra theo remote HEAD `28b6972e5b4f749124e4e27200bd76c4b6168d38`; EPUB-Forge theo `33120281bfc6faa51d43f5bd45dbbcab882da5d7`. Không sao chép code hoặc thay file trong hai repo tham khảo.

Chưa kiểm thử thiết bị Android thật, Safari/iOS thật, nghe âm thanh thực tế, mạng bị giới hạn tốc độ hoặc một phiên đọc kéo dài. Chưa có số liệu trước/sau vì chưa triển khai thay đổi nào trong đợt đánh giá này.
