# Phông heading dùng chung

Vào **Biên tập → Thông tin sách → Phông heading**. Owner và editor có cùng quyền thêm/xóa/chọn phông. Chọn riêng cho VI và EN, **Lưu bản nháp** hoặc **Xuất bản thông tin sách**. Phông áp dụng cho tiêu đề chương và h1–h6 trong nội dung Novel, xem trước và đối chiếu; phông thân bài và chữ trong ảnh/PDF được giữ nguyên.

Các nhãn riêng dòng **Critique, Notes, Lời bình/Lời bàn, Chú thích/Chú giải** tự được nhận diện thành heading khi mở, dán hoặc nhập nội dung. Nhãn được nhận diện cả khi file Word gộp nhãn và đoạn sau bằng xuống dòng; chỉ nhãn dùng font heading, đoạn sau giữ font thân bài. Câu văn thông thường, danh sách và trích dẫn không bị chuyển thành heading. Với nhãn khác, dùng nút **H₂** trong editor.

Chuẩn hóa này chạy khi đọc/biên tập, không tự lưu, tạo revision hoặc xuất bản lại chương cũ. Các chữ và đích chú thích được giữ nguyên. Khoảng cách chữ của phông heading tùy chọn giúp tách các nét sát nhau như `t` và chữ `i` thứ hai trong **Critique**. Sau khi cập nhật web, tải lại editor; với bản tải ngoại tuyến, cập nhật gói để nhận mã mới.

- **1. Mặc định (hiện tại)** giữ kiểu heading cũ và luôn có sẵn.
- **2. FZ Thư Pháp Tiểu Tự** là file người dùng cung cấp; bản gốc 393.520 byte, SHA256 `1c66e4ca4489c9fcd7bf526d63d10aabb9d320b47a903d206c18d8f0b706194e`. Metadata bản quyền Thai Hieu được giữ nguyên. File nguồn trên thiết bị không bị sửa; bản dùng chung nằm trong bucket riêng của Supabase.
- **Thêm phông heading** nhận TTF/OTF/WOFF/WOFF2, tối đa 3 MB. Kiểm tra kích thước trước khi đọc toàn file; trình duyệt kiểm tra giải mã, server kiểm tra chữ ký/container. Tải trực tiếp vào Storage.
- **Xóa phông** xóa khỏi danh sách (archive), giữ file. Nếu còn được dùng bởi bản nháp hoặc bản công khai VI/EN, chọn phông khác và lưu/xuất bản trước. Kiểm tra này được khóa theo bản ghi sách để tránh xóa đồng thời với xuất bản.

Khách không quản lý được phông và chỉ tải phông đang được chọn trong metadata đã xuất bản. Font chưa dùng được xem trước bởi editor đã xác minh. Không mở bucket public; không cho authenticated overwrite/delete file. Lựa chọn phông đi theo CAS và luồng xuất bản metadata hiện có; không viết CSS tùy ý vào HTML chương. Phông của bản tải ngoại tuyến nằm trong snapshot; cập nhật bản tải sau khi đổi phông đã xuất bản.

Thiết lập mới: áp dụng các migration hiện có rồi `supabase/migrations/20261031134023_heading_fonts.sql`. Trên project hiện tại migration đã áp dụng. Nạp file được cấp bằng `npx tsx scripts/seed-heading-font.ts "<đường dẫn file TTF>"`; script kiểm tra hash và không phục hồi một phông mà owner đã xóa. Không thêm dependency.

Kiểm tra: `npx vitest run --maxWorkers=2`, `npm run typecheck`, `npm run build`; đặt `BASE_URL=http://localhost:3003` hoặc URL production rồi chạy `node scripts/verify-heading-fonts.mjs`. `HEADING_FONT_SOURCE` có thể chỉ tới bản TTF nguồn; mặc định dùng file đã được người dùng cung cấp ở Downloads trên máy làm việc này. Verifier tạo editor/phông tạm, không ghi metadata sách; có kiểm tra công bố/CAS trong DB cô lập, fixture đối chiếu/ngoại tuyến và đọc phông đang công khai thật. Các thay đổi owner thực hiện đồng thời được giữ nguyên và ghi nhận riêng. Chưa hiệu chuẩn trên iPhone vật lý.
