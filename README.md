# Truyền kỳ mạn lục

Web đọc một quyển sách bằng tiếng Việt và tiếng Anh. Mở `/vi` hoặc `/en` để đọc; `/admin` dành cho owner/editor. Mặc định giấy ngà, có giao diện tối và các cài đặt đọc riêng trên thiết bị.

VI/EN nay mở menu Novel và TT (VI) / Comic (EN): `/vi/comic/chapter-1`. Owner/editor đăng nhập tại `/admin/comic?chapter=chapter-1&lang=vi`, tải PNG/JPEG/WebP hoặc ZIP/CBZ, kiểm tra thứ tự, lưu nháp chung và xem thử trước khi bấm **Xuất bản TT**. **Thu hồi TT** giữ lại nháp. Khách chỉ xem bản đã xuất bản; nháp trên thiết bị không thay bản công khai. Cần migration `005_comics.sql`, rồi `006_comic_locales.sql`. Nháp, ảnh và xuất bản VI/EN tách riêng. Xem [hướng dẫn TT](COMIC_PUBLISHING.md).

Source được quản lý tại repository private [Menhera-Chan-cool/truyen-ky-man-luc](https://github.com/Menhera-Chan-cool/truyen-ky-man-luc). Repo không chứa `.env.local`, khóa dịch vụ, thư mời, dữ liệu sao lưu riêng hay dependency/build output. Biến môi trường trên Vercel được cấu hình riêng; push GitHub không tự triển khai khi chưa nối Git integration.

Bản tối ưu yêu cầu chạy thêm `supabase/migrations/003_public_book_index.sql` sau 001/002. Xem `SUPABASE_SETUP.md`. Không chạy lại migration tạo bảng trên database đã có nội dung.

Bản public đã kiểm tra: [truyen-ky-man-luc.vercel.app](https://truyen-ky-man-luc.vercel.app/vi). Project hiện tại đã nối Supabase, nhập sách và kích hoạt owner; `/admin` dành cho owner/editor được mời. Owner tự đặt mật khẩu, ứng dụng không gửi email mời.

## Chạy trên máy

Phông heading dùng chung: vào **Thông tin sách → Phông heading** để chọn riêng VI/EN hoặc thêm/xóa phông. Lưu nháp rồi xuất bản thông tin sách để áp dụng cho khách đọc. Xem [hướng dẫn phông heading](HEADING_FONTS.md).

Yêu cầu Node.js 22 trở lên (đã kiểm tra bằng Node 24).

```powershell
npm install
$env:NEXT_TELEMETRY_DISABLED='1'
npm run dev
```

Mở http://localhost:3000 để dùng cùng origin canonical của Next.js khi biên tập trên máy. Nếu chưa cấu hình Supabase, web đọc dùng bản sách thật đã nhập sẵn và khu biên tập đóng. Đây là chế độ đọc tĩnh, không giả lập việc lưu lên máy chủ.

```powershell
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

`NEXT_TELEMETRY_DISABLED` tránh lỗi ghi cấu hình telemetry trên một số máy Windows; không ảnh hưởng nội dung web. `scripts/copy-worker.mjs` đưa PDF.js worker cùng phiên bản vào public; chạy khi cài dependency.

Kiểm tra Safari/WebKit: chạy `npx playwright install webkit`, mở bản production local rồi đặt `BASE_URL=http://127.0.0.1:3001` và chạy `npm run verify:webkit`. Verifier kiểm tra VI/EN trên phone/desktop: Book một/hai trang, trang kế/trước, chữ cuối chương, hai ranh giới chương, đổi viewport và Ebook trang đơn. Có thể truyền đường dẫn tuyệt đối tới package Playwright cũ được cài riêng cho verifier để kiểm tra WebKit 18; không đổi dependency ứng dụng. WebKit tự động không thay cho thử iPhone vật lý.

Chia trang khai báo cả `column-count` lẫn `column-width` để WebKit 18 không bỏ qua fragmentation của cột đơn. Đếm/dịch trang và mặt giấy tạm dùng chiều rộng thực có phần thập phân; không dùng số `clientWidth` đã làm tròn để tránh dư trang trắng ở cuối chương.

## Bật biên tập dùng chung

Editor chỉ mở Tiptap khi ID chương, ngôn ngữ và revision khớp dữ liệu form. Trong lúc lưu/upload, vùng nhập bị khóa để không chuyển chương hoặc ghi tiếp vào bản đang gửi. Lịch sử cũ không bị xóa. Kiểm thử hồi quy `npm run verify:editor` cần cấu hình Supabase và `BASE_URL` trỏ tới app đã chạy: tạo tài khoản/chương nháp tạm, dán và lưu ba chương ở cả VI/EN, kiểm tra sau reload rồi xóa dữ liệu thử; không gửi email và không xuất bản chương thử.

Làm theo [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Không có mật khẩu mặc định, đăng ký công khai hay bootstrap owner từ trình duyệt. Chỉ lệnh server `setup:owner` cấp owner ban đầu. Chỉ owner tạo liên kết mời; ứng dụng không tự gửi email. Các API xác minh tài khoản trên server và quyền hiện tại trong database; RLS bảo vệ cả truy cập trực tiếp.

## Nội dung và nguồn

- `src/data/book.json`: 20 chương Việt, 20 chương Anh và lời tựa VI, đã nhập từ nguồn người dùng cung cấp.
- `public/book/cover.jpg`: bìa lấy từ EPUB. Chưa có bìa sau hay minh họa rời được cung cấp; editor có thể thêm sau.
- EPUB gốc ghi nguồn `www.dtv-ebook.com`. Các dòng tên sách/tác giả/nguồn và tiêu đề bị lặp trước mỗi chương được tách khỏi thân truyện; file nguồn, văn truyện và chú thích được giữ nguyên.
- `src/lib/importer.ts`: EPUB/DOCX/TXT/HTML/PDF, giới hạn 50 MB/file, giải nén tối đa 200 MB và 2.500 mục. Ảnh tối đa 10 MB. Chỉ editor được nhập file.
- `supabase/migrations/001_book.sql`: migration PostgreSQL, RLS, Storage policies và các transaction xuất bản.
- `tests/`: kiểm thử nhập sách, HTML an toàn, speech/paging và PostgreSQL thực bằng PGlite. PGlite kiểm tra logic SQL/RLS cục bộ; không thay cho kiểm tra Supabase Auth/Storage thật.
- `e2e/`: kiểm thử Chromium desktop/mobile.

Nhập lại sách từ nguồn gốc (không sửa file nguồn):

```powershell
npm run seed:book -- "C:\Users\Admin\Downloads\Truyen Ky Man Luc - Nguyen Du.epub" "D:\truyenkimanluc"
```

Owner/editor nhập → xem trước → ghép chương → lưu nháp → xuất bản. Thay thế phải xác nhận; các bản nháp được lưu theo phiên bản và kiểm tra optimistic concurrency. Xuất bản nhiều chương chạy trong một transaction. Thu hồi không xóa lịch sử. Xóa chương là ẩn cả hai bản; lịch sử vẫn còn trong database.

Ảnh minh họa và bìa có thể dùng chung hoặc riêng VI/EN. Với PDF, mỗi chương chứa bản PDF mới chỉ có khoảng trang được chọn; file nguồn luôn riêng tư. PDF có lớp chữ có thể trích ra để duyệt/sửa, không có OCR. Các file tải trực tiếp vào Supabase, không đi qua giới hạn payload Vercel Functions. Tài nguyên chỉ được đọc công khai khi đang được một bản đã xuất bản tham chiếu; signed URL tồn tại tối đa 60 giây sau khi cấp.

## Người đọc

Có Literata, Lora, Merriweather, Georgia, Be Vietnam Pro, Inter, Roboto, OpenDyslexic và JetBrains Mono. Các phông bổ sung tự host, chỉ tải file phông khi trình duyệt cần sử dụng. Tooltip dùng chung hỗ trợ hover/focus, Escape và reduced motion. Màu tùy biến hiển thị swatch/mã HEX trong bảng nền tối; native controls theo độ sáng màu nền đã chọn.

Tiến độ, cài đặt, tô màu, đánh dấu và ghi chú lưu trong IndexedDB trên thiết bị. Đổi VI/EN giữ ID chương và vị trí riêng của từng bản. Không tự dịch sách; phần chưa có bản dịch hiển thị thông báo. Bôi đen từ, cụm từ hoặc câu rồi chọn **Tra VI↔EN / Look up VI↔EN** để xem phần tương ứng trong bản Novel còn lại ngay tại chỗ, không gửi sang Google Translate.

Tra cứu dùng hai bản đã xuất bản của cùng chương, tối đa 2.000 ký tự và 5 nhóm câu. Kết quả là chữ gốc của bản đối ứng, có phần tô sáng và ngữ cảnh; không tạo bản dịch mới. Khi chưa đủ căn cứ, bảng ghi rõ chưa chắc chắn hoặc chỉ đưa câu để đối chiếu. **Mở đối chiếu** mở hai cột tại phần đang tra; đóng bảng giữ vị trí đọc. PDF không hỗ trợ tra theo văn bản Novel. Nội dung đã đổi sẽ yêu cầu tải lại thay vì dùng kết quả của phiên bản cũ.

Dữ liệu đối ứng được chuẩn bị bằng mô hình chạy trên GitHub Actions trong repo private, mỗi giờ vào phút 17, tối đa 3 chương/lượt. Xuất bản lại tự xếp hàng theo đúng cặp VI/EN; có thể phải đợi một hoặc nhiều lượt xử lý. Khi không có việc, workflow bỏ qua cài Python/tải mô hình. Editor xem trạng thái và yêu cầu xử lý lại trong phần **Đối ứng VI↔EN** của chương. Lưu nháp không kích hoạt tác vụ và tác vụ không sửa nội dung sách. Xem [hướng dẫn worker](scripts/align-novel/README.md) để vận hành, giới hạn và giấy phép mô hình.

Tải ngoại tuyến bao gồm dữ liệu tra đã sẵn sàng, có kiểm checksum và phiên bản; cập nhật tái sử dụng dữ liệu không đổi. Lỗi tải giữ nguyên gói hoàn chỉnh trước đó. Khi mất mạng, kết quả ghi rõ đang dùng dữ liệu trên thiết bị; chương chưa tải dữ liệu sẽ báo cần cập nhật khi có mạng. Xóa gói tải không xóa ghi chú hay tiến độ.

Trong Cài đặt trình đọc → **Dữ liệu đọc trên thiết bị**, dùng **Xuất bản sao JSON** để giữ bản sao trước khi đổi máy hoặc xóa dữ liệu trình duyệt. Nhập file (tối đa 10 MB) sẽ hiện số ghi chú/vị trí trước khi bạn bấm Khôi phục. Ghi chú được gộp, giữ riêng các bản khác nội dung; tùy chọn khôi phục cài đặt/tiến độ sẽ thay các giá trị tương ứng. File chỉ được xử lý trên thiết bị, không tải lên server. Đây là thao tác sao lưu thủ công, không phải đồng bộ tài khoản.

Thay phông, cỡ chữ, giãn dòng, chiều rộng hoặc chế độ đọc giữ đoạn đang xem, thay vì giữ số trang cũ. Bấm ghi chú thuộc chương khác mở thẳng đoạn đã đánh dấu nếu đúng phiên bản. PDF nhớ trang/zoom riêng. Khi đổi giọng hoặc tốc độ lúc đang nghe, TTS tiếp tục từ từ đang đọc nếu trình duyệt có boundary; nếu không, đọc lại đoạn ngắn hiện tại.

Trình đọc nạp sẵn nội dung đã xuất bản của ngôn ngữ đang chọn vào bộ nhớ cho quyển sách này. Next/Previous, mục lục và liên kết cuối chương đổi nội dung tại chỗ, cập nhật URL/lịch sử trình duyệt và khôi phục vị trí riêng của chương, không gọi lại server. Làm mới trang hoặc đổi ngôn ngữ sẽ đọc lại bản công khai mới nhất; ảnh/PDF vẫn tải khi cần. Chỉ khi người đọc chủ động tải ngoại tuyến, bản công khai VI/EN mới được lưu trên thiết bị; bản nháp không được tải.

## Tiện ích đọc và biên tập bổ sung

Trên thanh đọc, nút **Tiện ích đọc** (ba chấm) mở hướng dẫn thao tác, **Đến trang**, **Vị trí gần đây**, **Đọc đối chiếu VI–EN** và **Đọc ngoại tuyến**. Đối chiếu mở hai bản cùng chương, cuộn độc lập trên PC, xếp dọc trên điện thoại; chưa căn chỉnh từng câu. Đóng bảng giữ nguyên chỗ đọc. Lịch sử giữ tối đa 30 vị trí theo ngôn ngữ/phiên bản; bản cũ được giữ nhưng không nhảy vào nội dung mới.

Trong **Giọng đọc & tốc độ**, **Từ điển phát âm tên riêng** nhận mỗi dòng `Tên trong sách = Cách đọc`; tối đa 50 quy tắc riêng cho VI/EN trên thiết bị. Quy tắc chỉ đổi chữ gửi cho giọng, vẫn giữ nguyên văn sách và vị trí ghi chú. **Tự nghe chương kế** mặc định tắt, chỉ tiếp tục khi đọc hết tự nhiên một chương văn bản có bản dịch kế tiếp; không tự phát sau reload, không áp dụng cho đoạn chọn hoặc PDF. Giọng/tốc độ thực tế vẫn do thiết bị cung cấp.

Trong cài đặt, **Phông chữ cá nhân** nhập TTF/OTF/WOFF/WOFF2, tối đa 3 MB/phông và 8 phông. Phông chỉ lưu tại thiết bị, không nằm trong bản sao JSON; máy khác cần nhập lại. File được kiểm tra định dạng và thử tải bằng FontFace trước khi lưu.

**Đọc ngoại tuyến** tải rõ ràng cả hai bản đã xuất bản, vỏ ứng dụng, phông và tài nguyên đang được tham chiếu; tối đa 200 MB/gói. Chỉ báo thành công khi tải đủ; lỗi cập nhật giữ bản hoàn chỉnh trước đó. Mở **Đọc bản đã tải** hoặc `/offline?locale=vi` khi mất mạng. Cập nhật chủ động để nhận bản mới; trình duyệt vẫn có thể xóa dữ liệu khi thiếu dung lượng. Xóa bản tải không xóa ghi chú/tiến độ. Quản trị, phiên đăng nhập và file nguồn không được lưu ngoại tuyến; TTS online của hệ điều hành có thể cần mạng.

Trong editor, **So sánh & kiểm tra** so bản đang sửa với bản công khai hoặc lịch sử, phân biệt thêm/xóa/đổi định dạng theo đoạn. **Kiểm tra trước xuất bản** chặn chương trống, chú thích thiếu đích và ảnh không tồn tại; tiêu đề trùng hoặc số chú thích không ghép được là cảnh báo cần xem lại. Server kiểm tra lại trước khi xuất bản; bìa được kiểm tra khi xuất bản giới thiệu.

Tab **Tìm–thay thế** cho chọn VI/EN, xem trước từng chương, chọn các chương rồi xác nhận lưu nháp. Thay chữ thuần, giữ định dạng/link và không tự xuất bản. Revision cũ làm cả lượt lưu bị từ chối để tránh ghi đè. **Nhật ký quản trị** ghi hành động từ khi áp dụng migration 004, không tái tạo lịch sử cũ. Trạng thái editor làm mới mỗi 25 giây và chỉ hiện người hoạt động trong 90 giây; đây là thông tin hiện diện, cơ chế chống ghi đè vẫn dựa vào revision.

`npm run verify:expansion` dùng Supabase thật và `BASE_URL=http://localhost:3001` (hoặc URL triển khai): tạo tài khoản/chương nháp tạm, kiểm tra so sánh, thay thế, xung đột, preflight, quyền, hiện diện, nhật ký và loại file riêng khỏi cache; không xuất bản fixture, không gửi email, kiểm tra bản công khai không đổi và dọn dữ liệu thử.

Trong **Cài đặt trình đọc → Giao diện đọc**, chọn **Ebook** để dùng giao diện cũ hoặc **Sách** để mở trang giấy có gáy, số trang và hiệu ứng lật hai mặt/nếp gấp/bóng. Màn hình rộng mở hai trang; điện thoại hoặc vùng đọc hẹp mở một trang. Dùng mũi tên, vuốt ngang hoặc nút Đầu/Cuối chương. Lật hết chương mở chương kế từ trang đầu; lật ngược ở đầu chương mở cuối chương trước. Các chương không nối vào phần trống của cùng một trang. Số trang tính trong chương hiện tại và thay đổi theo phông/cỡ màn hình.

Chế độ Sách giữ chữ gốc và offset ghi chú/nghe, dùng chung chú thích/TTS. Chỉ lật các trang đang đọc, không dựng cả quyển thành hàng nghìn mặt trang. Bộ lật StPageFlip (MIT, tự host 44KB) dùng các mặt trang tạm, tách khỏi chữ có thể chọn; kết thúc sẽ hủy ngữ cảnh vẽ. Có mở giấy nhẹ, phản hồi nút và mục lục trượt. Giảm chuyển động/E-ink sẽ tắt animation; khi tài nguyên hiệu ứng chưa sẵn sàng, vẫn chuyển trang ngay. File sao lưu v1 cũ không có trường giao diện vẫn nhập được và chọn Ebook. PDF tiếp tục dùng trình đọc trang/zoom gốc.

Trình đọc đo trang bằng phông dự phòng ngay khi cần, không chờ tải phông xong. Nếu phông đến muộn, vị trí văn bản mới nhất sau các lần lật trang/cuộn được giữ khi dàn trang lại; số trang có thể đổi theo phông. Mũi tên đơn lật trang, các tổ hợp Alt/Ctrl/Meta/Shift và IME được nhường cho trình duyệt hoặc chọn chữ.

Các số dẫn `(1)` có mục giải thích tương ứng dưới **Chú thích / Notes** hiện thành số nhỏ màu xanh phía trên dòng. PC: rê chuột/focus để xem trước, bấm để đến cuối chương; nút **Quay lại chỗ đang đọc / Back to reading** và Back khôi phục đúng vị trí cuộn, dòng và trang trước khi bấm. Nếu đổi cỡ chữ hoặc bố cục trong lúc xem chú thích, Reader tìm lại dòng văn bản gốc. Hoạt động trong Ebook, Sách và đường đọc bản tải; cột đọc đối chiếu có nút riêng. Mobile: chạm để mở popup, đóng popup giữ nguyên chỗ đọc. Viết nội dung như `Tên nhân vật (1)` và phần cuối như `Chú thích:` rồi một đoạn riêng `(1) Nội dung giải thích`. Giọng đọc bỏ riêng ký hiệu dẫn trong thân bài; chữ gốc, bản sửa và offset ghi chú không đổi. Nếu bản nguồn không có số dẫn thì không tự đoán chỗ chèn; riêng nhãn bị mất đã xác định ở chương 3/14 VI được phục hồi ở lớp hiển thị. PDF nguyên trang giữ nguyên.

Giọng đọc dùng Web Speech API, phụ thuộc giọng mà trình duyệt/hệ điều hành cung cấp. Một số giọng “online” của thiết bị có thể dùng dịch vụ hệ điều hành; web không có API TTS riêng. Nhiễu trắng/hồng/nâu và tiếng mưa được tạo tại thiết bị bằng Web Audio. File âm thanh riêng không được tải lên server.

Trong **Giọng đọc & tốc độ**, **Ngắt nghỉ ngắn** mặc định bật: gộp các câu ngắn vào cùng lượt đọc và làm nhẹ dấu `. : ; …`/gạch ngang trong bản chữ gửi cho giọng đọc. Nội dung sách, ghi chú và vị trí từ vẫn giữ nguyên; số thập phân, giờ và các viết tắt thông dụng được bảo vệ. Tắt tùy chọn để dùng nhịp gốc. Không đặt được thời lượng nghỉ chính xác bằng Web Speech; mức nghỉ thực tế tùy giọng/thiết bị. Cài đặt lưu trên thiết bị và bản sao JSON cũ vẫn nhập được.

Nút đọc trên thanh công cụ chuyển giữa **Tạm dừng đọc / Tiếp tục đọc** khi có phiên nghe; **Dừng đọc** trong bảng giọng đọc kết thúc hàng đợi. Khi giọng bị ngắt, ứng dụng giữ chunk/boundary để bạn chủ động tiếp tục. Đổi tốc độ/giọng khi đang tạm dừng không tự phát lại. Đổi chương, VI/EN hoặc trang PDF dừng phiên cũ.

**Giọng đọc & tốc độ → Nghe tiếp** mở lại chỗ nghe gần nhất của từng ngôn ngữ, kể cả ở chương khác. Chỗ nghe lưu riêng với tiến độ đọc, gồm revision và offset; không tự phát khi tải trang. Bản nội dung đã đổi/thu hồi sẽ báo không còn phù hợp. Có boundary thì tiếp tục từ từ đang nghe, nếu không thì từ đầu chunk ngắn; PDF có chữ lưu trang và offset khi đọc trang bằng “Đọc chương này”. Đọc riêng đoạn chọn trong PDF không thay chỗ nghe trang vì hệ tọa độ lớp chữ khác văn bản trích. Chỗ nghe đi cùng file sao lưu JSON; bản sao cũ vẫn nhập được.

Sidebar có tab **Tìm trong sách**: tìm cả bản published VI hoặc EN đã nạp, không phân biệt hoa/thường hoặc dấu tiếng Việt, tối đa 100 kết quả với đoạn trích; bấm kết quả để mở đúng chương/đoạn và tô sáng. PDF nguyên trang không nằm trong chỉ mục. Mục lục tự hiện chương đang đọc khi mở; Escape đóng bảng từ ô tìm/ghi chú, giữ thao tác IME và phím mũi tên trong input. Tooltip đồng bộ khi nút đổi trạng thái.

Chỉ mục được chuẩn bị theo từng chương để giao diện vẫn nhận thao tác, có trạng thái đang chuẩn bị và nút thử lại khi lỗi. Sau đó chỉ mục được giữ trong bộ nhớ khi đổi tab/chương, hủy và làm lại khi Book snapshot hoặc VI/EN đổi; không ghi HTML vào bộ nhớ thiết bị. Đổi/xóa từ khóa chỉ bỏ highlight tìm kiếm cũ, giữ highlight ghi chú. Ở màn hình mục lục nổi (tối đa 900px), mở mục lục và mở bảng công cụ sẽ đóng lớp còn lại, giữ thao tác bàn phím và phiên phát đang chạy; desktop giữ được sidebar cạnh bảng công cụ.

Tự cuộn dừng khi trang ẩn, nhận freeze/pagehide hoặc gặp khoảng RAF lớn hơn 250ms; không chạy bù thời gian và không tự bật lại khi quay về. Bấm “Bắt đầu tự cuộn” để tiếp tục từ chỗ đang xem. Wheel dọc, vuốt/chạm vùng truyện và lật trang bằng phím dừng auto; thay tốc độ trong panel vẫn giữ auto chạy. Thanh tốc độ có nhãn VI/EN liên kết với input và hỗ trợ bàn phím. Tiến độ được flush thêm khi nhận freeze; không thay đổi dữ liệu nghe/ghi chú.

Trong editor, **Xem trước → Điện thoại / Máy tính** dùng khung 390px/780px với typography mặc định của reader. Khung rộng cuộn trong vùng preview, không kéo tràn trang quản trị. Chuyển khung không lưu hoặc sửa HTML; preview vẫn làm sạch nội dung. Cài đặt đọc riêng của khách có thể khác preview.

Liên kết chú thích `#id` trong chương dùng chung cơ chế chuyển trang của Reader, đồng bộ tiến độ và Back/Forward. Popup chọn chữ đóng khi chạm bên ngoài; nhập ghi chú và dùng các nút bên trong vẫn giữ popup. Mở sách chỉ chuẩn bị HTML của ngôn ngữ đang đọc; lỗi kết nối/429/5xx của yêu cầu đọc được thử lại tối đa một lần, không áp dụng cho thao tác ghi hoặc lỗi quyền/cấu hình.

Mục lục đếm tổng câu chuyện, không trừ chương chỉ thiếu bản dịch ở ngôn ngữ đang chọn. Bảng giọng đọc chỉ liệt kê giọng phù hợp VI/EN hiện tại, báo rõ khi danh sách trống hoặc chỉ có một giọng; hỗ trợ Làm mới, voiceschanged, quay lại tab và ba lần kiểm tra muộn có giới hạn. Khi chưa có giọng phù hợp, web chặn phát thay vì giao cho giọng mặc định có thể sai ngôn ngữ. Trong Android, chọn công cụ/ngôn ngữ và cài dữ liệu giọng Việt, thử mẫu trong cài đặt, mở lại Chrome rồi Làm mới. Cài thêm gói không bảo đảm browser sẽ liệt kê thêm giọng. Xem [hướng dẫn Android](https://support.google.com/accessibility/android/answer/6006983?hl=vi).

Ghi chú gắn với ngôn ngữ, revision và vị trí văn bản. Khi nội dung đổi, ghi chú cũ vẫn giữ nguyên trong danh sách và được đánh dấu cũ; không tự gắn vào đoạn khác. PDF nguyên trang có zoom riêng và không áp dụng thay phông/cỡ chữ của nội dung văn bản.

## Triển khai

Vercel: framework Next.js, Node 24, build `npm run build`, install `npm ci`. Không đưa `.env.local`, `.owner-invitation.txt`, file nguồn riêng, dữ liệu trình duyệt hay token vào Git/deployment. Khi nối Supabase, thêm đủ các biến môi trường ở Vercel rồi redeploy. Không cần chuyển backend Go của các repo tham khảo lên Vercel.

Vercel cần biến Config `NODE_OPTIONS=--experimental-require-module` cho production/preview/development: runtime mặc định tắt `require(ESM)`, trong khi DOMPurify/jsdom dùng dependency ESM. Đã cấu hình trên project hiện tại. Nếu tạo project Vercel khác, thêm biến này rồi deploy theo [hướng dẫn Node.js của Vercel](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration).

Không bao gồm: OCR, thư viện nhiều sách, tài khoản người đọc/đồng bộ nhiều thiết bị, tự dịch toàn truyện, xuất EPUB/PDF mới. Xem [VERIFICATION.md](VERIFICATION.md) để biết chính xác những gì đã và chưa kiểm chứng.

## Tham khảo và giấy phép

Tham khảo thao tác của [EPUB-Forge](https://github.com/AzenKain/EPUB-Forge) và [Novel-Hub](https://github.com/AzenKain/Novel-Hub). Hai repo được clone riêng trong `work/references`, không bundle backend/binary vào web. Xem [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Trong chế độ **Sách**, PC cho giữ chuột trái ở mép giấy bên phải và kéo sang trái để tới trang sau; kéo mép trái sang phải để trở lại. Điện thoại vuốt ngang ngay trên trang giấy. Giấy chạy theo thao tác; thả khi kéo đủ xa hoặc hất nhanh trên điện thoại sẽ lật một lần; kéo ngắn chậm hoặc hủy sẽ trả giấy về. Chọn chữ ở giữa trang và thao tác trên chú thích/ảnh vẫn được giữ. Trên điện thoại, thanh dưới ẩn sau 3 giây không thao tác; chạm vùng giấy trống hoặc thanh nhỏ ở mép dưới để hiện lại. Thanh giữ nguyên khoảng trống khi ẩn để chữ không dồn trang; khi dùng bàn phím hoặc mở bảng điều khiển, nó vẫn hiện.


Trên điện thoại, mỗi lần thả vuốt hợp lệ được ghi nhận ngay; vuốt tiếp hoặc đảo chiều không chờ hiệu ứng trước chạy xong. Trong lúc chuyển chương, các lượt đã thả được xử lý theo đúng thứ tự. Mặt sau đang gấp dùng trang kế, không lặp lại mặt trước. Khi bật Giảm chuyển động hoặc hiệu ứng chưa sẵn sàng, vẫn đổi đúng trang.

**Chú thích trên điện thoại:** chạm số nhỏ màu xanh để đọc thẻ chú thích ngay tại chỗ; không nhảy xuống cuối chương. Cuộn bên trong để đọc chú thích dài, bấm X, chạm ra ngoài hoặc Escape để đóng. PC vẫn rê chuột xem trước và bấm để tới chú thích ở cuối chương. Nội dung `(1)` trong editor và cách đánh số giữ nguyên.

**Lật nhẹ trên màn hình cảm ứng (gồm iOS):** vuốt nhẹ hoặc chạm vùng 48px ở mép phải/trái của giấy để tiến/lùi. Vuốt chậm từ 24px hoặc hất nhanh từ 14px được nhận; vuốt dọc, chạm lệch rất ít, giữ chọn chữ và chú thích không lật nhầm. Nếp giấy đi xa gấp đôi quãng kéo ngón tay; các sự kiện move được gộp theo khung hình và không chụp lại mặt giấy thừa khi bắt đầu kéo. Chuột PC giữ ngưỡng/kéo mép cũ. Chạm vùng trống giữa giấy hoặc mép dưới để hiện lại thanh điều khiển.
