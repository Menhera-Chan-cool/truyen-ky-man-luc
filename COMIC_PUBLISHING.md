# Biên tập và xuất bản TT

1. Mở `/admin/comic?chapter=chapter-1&lang=vi`, đăng nhập bằng tài khoản owner/editor hiện có. Cũng có thể vào `/admin` rồi chọn **Biên tập TT**.
2. Chọn chương; thêm PNG/JPEG/WebP hoặc ZIP/CBZ. Các ảnh mới được xếp theo số trong tên; kéo hoặc dùng nút lên/xuống để sửa thứ tự. Kiểm tra ảnh lớn, thay/xóa các trang cần thiết và sửa tiêu đề.
3. Bấm **Lưu nháp**. Ảnh tải trực tiếp vào bucket riêng của Supabase. Server kiểm tra chữ ký file, giải mã ảnh, kích thước và SHA256 trước khi ghi phiên bản. Nháp chung chỉ owner/editor thấy.
4. **Xem bản đọc** mở `?preview=draft`, cần phiên đăng nhập. Khách không truy cập được ảnh/bản nháp qua URL này.
5. Khi đã lưu hết thay đổi, bấm **Xuất bản TT** và xác nhận. Bản công khai được thay đồng bộ bằng một lần chuyển phiên bản; lỗi tải/lưu không thay bản cũ. Nếu người khác đã sửa, server từ chối ghi đè: giữ lại thay đổi cần dùng rồi tải lại bản đã lưu.
6. **Thu hồi TT** gỡ chương TT khỏi bản công khai và giữ lại nháp. Liên kết ảnh có chữ ký đã cấp có thể còn hiệu lực tối đa 60 giây; không xóa vật lý các ảnh của phiên bản cũ.

TT là một bản ảnh chung theo chương; VI/EN đổi giao diện và trở về bản chữ tương ứng. Tùy chỉnh TT và vị trí đọc lưu trên thiết bị. Thao tác lật trang/giãn ảnh không sửa file gốc. Không có OCR hay TTS ảnh.

Giới hạn mỗi chương: 300 trang, 20 MB/ảnh, 200 MB tổng ảnh; ZIP/CBZ tối đa 50 MB nén. Ảnh mẫu do ImageGen tạo chỉ để thử giao diện, không phải bản truyện tranh hoàn chỉnh. Nút **Ảnh mẫu** ở chương 1 nạp mẫu vào vùng soạn; vẫn phải lưu nháp và xuất bản rõ ràng.

Khách đọc `/vi/comic/<chapterId>` hoặc `/en/comic/<chapterId>`. Nháp local cũ không tự nhập hay ghi đè nháp chung. Bản local riêng tại `work/tt-preview` vẫn có IndexedDB/origin riêng; dữ liệu ở `localhost:3002` không tự chuyển sang tên miền Vercel. Giữ ảnh nguồn khi chuyển môi trường.

Triển khai cần `supabase/migrations/005_comics.sql` đã áp dụng và cùng ba biến Supabase của phần sách. Không mở bucket `comic-assets` thành public; không cấp quyền overwrite/delete cho authenticated. File tải lên thất bại có thể còn trong bucket riêng; không tự xóa ảnh vì các phiên bản đã lưu có thể đang dùng chúng.

Kiểm tra: `npm test -- --maxWorkers=1`, `npm run typecheck`, `npm run build`; `BASE_URL` trỏ bản cần kiểm tra rồi chạy `node scripts/verify-comic.mjs`. Script tạo editor/chương/ảnh tạm, kiểm tra bằng Chromium/WebKit rồi dọn fixture; không gửi email hoặc sửa sách VI/EN.
