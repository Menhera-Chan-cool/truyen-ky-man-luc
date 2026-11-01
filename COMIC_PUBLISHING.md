# Biên tập và xuất bản TT

1. Mở `/admin/comic?chapter=chapter-1&lang=vi`, đăng nhập bằng tài khoản owner/editor hiện có. Cũng có thể vào `/admin` rồi chọn **VI → TT** hoặc **EN → Comic**.
2. Chọn chương; thêm PNG/JPEG/WebP hoặc ZIP/CBZ. Các ảnh mới được xếp theo số trong tên; kéo hoặc dùng nút lên/xuống để sửa thứ tự. Kiểm tra ảnh lớn, thay/xóa các trang cần thiết và sửa tiêu đề.
3. Bấm **Lưu nháp**. Ảnh tải trực tiếp vào bucket riêng của Supabase. Server kiểm tra chữ ký file, giải mã ảnh, kích thước và SHA256 trước khi ghi phiên bản. Nháp chung chỉ owner/editor thấy.
4. **Xem bản đọc** mở `?preview=draft`, cần phiên đăng nhập. Khách không truy cập được ảnh/bản nháp qua URL này.
5. Khi đã lưu hết thay đổi, bấm **Xuất bản TT** và xác nhận. Bản công khai được thay đồng bộ bằng một lần chuyển phiên bản; lỗi tải/lưu không thay bản cũ. Nếu người khác đã sửa, server từ chối ghi đè: giữ lại thay đổi cần dùng rồi tải lại bản đã lưu.
6. **Thu hồi TT** gỡ bản ngôn ngữ đang chọn khỏi trang công khai và giữ lại nháp. Liên kết ảnh có chữ ký đã cấp có thể còn hiệu lực tối đa 60 giây; không xóa vật lý các ảnh của phiên bản cũ.

VI và EN có bản ảnh, nháp, phiên bản và trạng thái xuất bản riêng. TT cũ trước migration 006 được giữ ở VI; EN không tự lấy ảnh VI. Rê chuột vào VI/EN trên PC hoặc chạm trên điện thoại để chọn Novel hay TT/Comic. Mỗi lựa chọn mở một bản của cùng chương. Vị trí TT được nhớ riêng theo ngôn ngữ; cài đặt đọc vẫn lưu trên thiết bị. Thao tác lật trang/giãn ảnh không sửa file gốc. Không có OCR hay TTS ảnh.

Công cụ đọc TT/Comic: UI hiện khi mở tab mới, tự ẩn sau 10 giây. Nhấp đúp hoặc chạm đúp ảnh/vùng trống để bật–tắt; cuộn và quay lại tab không gọi UI trở lại. PC rê chuột vào từng cụm để hiện riêng cụm đó; bàn phím vẫn thấy cụm đang focus. Mobile tự vừa chiều rộng, không có Stretch/zoom %. Trạng thái ẩn được giữ khi đổi chương, đổi VI/EN hoặc tải lại trong cùng tab.

Trong lúc biên tập, trình duyệt giữ bản khôi phục theo tài khoản, ngôn ngữ và chương. Sau khi tải lại, bấm **Khôi phục thay đổi** để xem lại rồi **Lưu nháp** khi muốn ghi lên server. Bản khôi phục giữ số phiên bản cũ để server vẫn phát hiện xung đột. Các cửa sổ có bản khôi phục riêng; có thể xóa từng bản rõ ràng. Giữ ảnh nguồn và lưu nháp chung thường xuyên: xóa dữ liệu trình duyệt hoặc hệ điều hành đóng ứng dụng trước khi kịp ghi có thể làm mất thay đổi mới nhất.

Khi lưu ảnh gặp lỗi, thử lại hoặc khôi phục sau tải lại sẽ dùng các ảnh đã tải thành công. Hai tác vụ tải chạy song song và vẫn giữ thứ tự trang. Editor dùng ảnh xem nhanh WebP tải theo vùng nhìn; mở ảnh lớn vẫn xem bản gốc. File gốc được giữ nguyên byte và kiểm tra checksum.

Giới hạn mỗi chương: 300 trang, 20 MB/ảnh, 200 MB tổng ảnh; ZIP/CBZ tối đa 50 MB nén. Ảnh mẫu do ImageGen tạo chỉ để thử giao diện, không phải bản truyện tranh hoàn chỉnh. Nút **Ảnh mẫu** ở chương 1 nạp mẫu vào vùng soạn; vẫn phải lưu nháp và xuất bản rõ ràng.

Khách đọc `/vi/comic/<chapterId>` hoặc `/en/comic/<chapterId>`. Nháp local cũ không tự nhập hay ghi đè nháp chung. Bản local riêng tại `work/tt-preview` vẫn có IndexedDB/origin riêng; dữ liệu ở `localhost:3002` không tự chuyển sang tên miền Vercel. Giữ ảnh nguồn khi chuyển môi trường.

Triển khai cần `supabase/migrations/005_comics.sql` và `006_comic_locales.sql` đã áp dụng và cùng ba biến Supabase của phần sách. Không mở bucket `comic-assets` thành public; không cấp quyền overwrite/delete cho authenticated. File tải lên thất bại có thể còn trong bucket riêng; không tự xóa ảnh vì các phiên bản đã lưu có thể đang dùng chúng.

Kiểm tra: `npm test -- --maxWorkers=1`, `npm run typecheck`, `npm run build`; `BASE_URL` trỏ bản cần kiểm tra rồi chạy `node scripts/verify-comic.mjs`. Script tạo editor/chương/ảnh tạm, kiểm tra bằng Chromium/WebKit rồi dọn fixture; không gửi email hoặc sửa sách VI/EN.

## Ảnh đọc và phục hồi khi mạng lỗi — 01/11/2026

Ảnh đọc dùng bản WebP lossless nguyên độ phân giải khi nhỏ hơn nguồn; zoom PC trên 100% dùng nguồn. Chỉ ký URL bản đọc sau khi kiểm tra quyền của ảnh gốc. Thiếu bản đọc thì dùng nguồn; lỗi hạ tầng vẫn báo 503. Bản đọc nằm cùng bucket riêng, không sửa file nguồn. Backfill idempotent: chạy `npx tsx scripts/backfill-comic-thumbnails.ts --reading` để xem trước; thêm `--apply` để tạo những bản còn thiếu, không overwrite. Hai ảnh đang xuất bản đã được tạo và so sánh toàn bộ điểm ảnh/checksum.

Nạp trước chủ động có ngân sách tối đa 8 MiB tính theo dung lượng nguồn, tối đa hai trang kế ở chế độ Một phần. Mạng 3G/đường truyền chậm giảm còn một trang/1 MiB; Data Saver và 2G không nạp trước chủ động. Ảnh đang xem và lazy loading của trình duyệt vẫn hoạt động; ngân sách này không phải giới hạn tổng lưu lượng của trình duyệt. Cùng URL đã tải/đang chờ không tạo yêu cầu nạp trước trùng.

Đọc nháp/lưu/xuất bản có deadline 15 giây, đăng ký/chuẩn bị ảnh 45 giây, upload 120 giây. Mất phản hồi lưu/xuất bản sẽ đọc lại head để xác nhận đúng revision/nội dung, không tự gửi lại lệnh ghi. Head trả thêm draftRevision (phiên bản nội dung), khác revision (phiên biên tập); xuất bản tăng revision. Upload SDK có thể hoàn tất sau deadline, nên checkpoint giữ đường dẫn bất biến và đăng ký lại để xác nhận trước khi tải lại cùng đường dẫn. Nếu không xác nhận được, giữ nháp và tải lại bản server để kiểm tra; không bấm xuất bản liên tục.

## Cuộn và yêu cầu quản trị — 01/11/2026

Thanh tiến độ TT cập nhật CSS/ARIA theo rAF, không đặt state React ở mỗi nhịp cuộn. Vị trí đọc vẫn ghi sau cuộn và flush khi rời trang. Đổi vị trí thanh, ẩn/hiện, chế độ ngang, resize và tự cuộn giữ cách tính tiến độ cũ. Phép thử 90px/90 frame: 90 React commits trước sửa, 0 sau sửa trên Chromium desktop/phone và WebKit phone; đây không phải FPS trên iPhone thật.

Các API quản trị nay có deadline chung gồm cả session và JSON, giữ hủy yêu cầu khi đổi chương. Novel save/import/restore, publication/batch/withdraw, metadata/order/archive xác nhận lại đúng head khi mất phản hồi, không tự gửi lại lệnh ghi. Novel publication giữ nguyên revision (khác TT). Nếu server xác nhận ghi nhưng refresh lỗi, UI báo rõ và giữ phần đang sửa/danh sách nhập. Sao chép thay đổi cần giữ rồi tải lại bản server trước khi ghi tiếp. Giới hạn thông thường 15 giây, import/batch 30 giây, TT register 45 giây, Storage upload 120 giây. Upload SDK có thể hoàn tất muộn; file nguồn vẫn riêng và không overwrite.
