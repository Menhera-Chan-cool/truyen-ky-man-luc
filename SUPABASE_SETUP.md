# Bật Supabase cho web

Phần đọc công khai hiện chạy được với sách thật mà chưa cần Supabase. Làm các bước dưới để bật lưu nội dung và quản lý editor. Không gửi secret key hay mật khẩu vào chat.

## 1. Tạo project

Mở https://supabase.com/dashboard và đăng nhập. Chọn **New project**, chọn organization của bạn, đặt tên `truyen-ky-man-luc`, tạo mật khẩu database mạnh và chọn khu vực gần người đọc (ví dụ Singapore). Bắt đầu bằng gói miễn phí nếu phù hợp; kiểm tra hạn mức của tài khoản trước khi nâng gói.

## 2. Tạo cấu trúc dữ liệu

Trong project mới, mở **SQL Editor → New query**. Dán toàn bộ `supabase/migrations/001_book.sql`, rồi Run đúng một lần. Migration tạo:

- Bảng sách, chương, phiên bản nội dung, bản nháp/bản công khai, tài nguyên và thành viên.
- RLS và các hàm xuất bản có kiểm tra quyền/phiên bản.
- Hai bucket **private**: `book-assets` và `book-sources`.

Không đổi bucket thành public. Không tắt RLS. Nếu migration báo lỗi, dừng và giữ nguyên thông báo để chẩn đoán; không chạy từng nửa tùy ý.

Nếu đã chạy bản `001_book.sql` trước khi bổ sung điều kiện UPDATE, chạy thêm **`supabase/migrations/002_safe_updates.sql`** trong SQL Editor. Bản sửa tương thích safe-update của Supabase, giữ nguyên dữ liệu/grants/RLS và có thể chạy lại. Không chạy lại `001_book.sql` trên database đã có bảng. Project tạo mới bằng bản 001 hiện tại đã có điều kiện đúng; vẫn có thể áp dụng 002 để thống nhất lịch sử migration.

## 3. Đóng đăng ký công khai và nối khóa

Chạy thêm `supabase/migrations/003_public_book_index.sql` sau 001/002. Hàm này trả metadata/mục lục đã xuất bản, không lấy nội dung HTML của các chương. Cần áp dụng trước khi chạy bản tối ưu mới; migration không thay đổi nội dung sách và có thể chạy lại.

Trong **Authentication → Sign In / Providers → Email**, bật Email/Password nhưng tắt **Allow new users to sign up** trong cấu hình đăng ký. Tài khoản chỉ được cấp qua Admin API bởi lệnh owner hoặc owner hiện có.

Lấy **Project URL**, khóa **anon** và khóa **service_role** từ phần Connect / API Keys của project. Tên tab có thể thay đổi theo giao diện Supabase; dùng các khóa legacy tương ứng với biến dưới đây. Khóa `service_role` chỉ ở server.

Sao chép `.env.example` thành `.env.local` trong thư mục project, rồi điền trực tiếp trên máy:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
```

Khởi động lại `npm run dev`. Không commit `.env.local` và không thêm tiền tố `NEXT_PUBLIC_` vào service role key.

## 4. Tạo owner và nhập sách

Khi đã chọn email owner:

```powershell
npm run setup:owner -- your-email@example.com
npm run seed:remote
```

`setup:owner` tạo tài khoản/membership và lưu một liên kết dùng một lần trong `.owner-invitation.txt` trên máy. Không gửi email. Mở liên kết trên trình duyệt, đặt mật khẩu ít nhất 12 ký tự và xóa file liên kết sau khi dùng.

`seed:remote` đưa toàn bộ sách mẫu vào database bằng một transaction. Lệnh từ chối nếu database đã có chương, để không ghi đè nội dung đang biên tập. Không chạy lệnh tạo owner trong trình duyệt hoặc đưa service key vào client.

Mở `/admin`, đăng nhập, thử lưu một bản nháp và kiểm tra rằng cửa sổ đọc riêng vẫn thấy bản cũ. Sau đó xuất bản, kiểm tra cửa sổ đọc đổi đúng. Chỉ coi tích hợp hoàn tất khi bước kiểm tra này thành công trên project Supabase thật.

## 5. Đưa cấu hình lên Vercel

Trong project Vercel `truyen-ky-man-luc`, vào **Settings → Environment Variables**. Thêm ba biến Supabase và `NEXT_PUBLIC_SITE_URL` bằng URL production thực tế (không có dấu `/` cuối). Khóa service role phải là biến bí mật chỉ dùng phía server. Redeploy để các biến `NEXT_PUBLIC_*` được đóng vào bundle mới.

Giữ biến Config `NODE_OPTIONS=--experimental-require-module` đã thiết lập cho runtime Vercel. Đây là cấu hình nạp dependency HTML; không chứa khóa bí mật.

Trong Supabase **Authentication → URL Configuration**, đặt Site URL là URL Vercel production; thêm URL local nếu còn phát triển trên máy. Luồng liên kết mời của web đi qua `/auth/confirm` rồi tới `/admin/activate` và dùng `verifyOtp`; ứng dụng không gửi thư nên không cần SMTP để tạo liên kết mời.

Nếu đã dùng liên kết local, sau deploy có thể đăng nhập production bằng mật khẩu vừa đặt. Chạy lại `setup:owner` chỉ khi cần tạo lại liên kết; trước đó đổi `NEXT_PUBLIC_SITE_URL` trong `.env.local` sang URL production.

## 6. Thêm 3–4 editor khi sẵn sàng

Owner vào **Người biên tập → nhập email → Tạo liên kết mời**. Sao chép và tự chia sẻ liên kết riêng cho đúng người. Người được mời mở liên kết, đặt mật khẩu, rồi đăng nhập. Editor được sửa và xuất bản; không quản lý được danh sách thành viên.

Để đặt lại mật khẩu hoặc mời lại người đã bị thu hồi, nhập lại email đó để owner tạo liên kết mới. Khi thu hồi, quyền ghi bị chặn theo membership hiện tại ngay cả khi người đó còn giữ phiên đăng nhập cũ.

## Kiểm tra bắt buộc sau khi nối

1. Khách đọc được bản công khai, không đọc được draft/file nguồn và không gọi được API ghi.
2. Editor lưu nháp, thay bìa, nhập một nhóm chương, xuất bản và thu hồi được.
3. Hai cửa sổ cùng sửa một chương: cửa sổ cũ nhận cảnh báo conflict, không ghi đè.
4. Editor không thêm/thu hồi thành viên; owner thực hiện được và không xóa được owner cuối cùng.
5. PDF xuất bản một khoảng trang chỉ chứa đúng khoảng đó; file nguồn vẫn private.

Tài liệu chính thức: [Supabase Auth](https://supabase.com/docs/guides/auth), [SSR client](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
