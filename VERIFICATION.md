# Bằng chứng kiểm chứng — cập nhật 23/10/2026

## Đợt tối ưu và GitHub — đang chờ migration production

- Source đã có: gom ghi tiến độ mỗi giây và chốt khi chuyển chương/rời trang; bố cục sidebar desktop ngay từ HTML/CSS ban đầu; tải editor/import theo nhu cầu; state admin chỉ trả summary, HTML tải theo phiên bản được chọn với AbortController và chốt context; cookie giao diện đã xác thực để server render đúng nền; RPC metadata-only trong migration 003.
- Vitest: **49 đạt**; typecheck và production build đã qua. Playwright reader/control/navigation cục bộ: **14 đạt, 4 bỏ qua** (budget nén chỉ đo trên host; kiểm tra geometry desktop/hover không áp dụng cho cấu hình còn lại). Có kiểm tra vị trí sau chuyển chương nhanh/Back/reload.
- `npm run verify:editor` trên build cục bộ nối Supabase thật: VI/EN dán, lưu ba chương, chuyển lại/reload, không trộn nội dung; state không có HTML; hủy yêu cầu chương cũ và mở bộ nhập theo nhu cầu. Tài khoản và các bản nháp QA tạm đã dọn thành công.
- Full Playwright trên chế độ sách mẫu cục bộ độc lập Supabase: **45 đạt, 5 bỏ qua, 0 lỗi** (50 ca; không retry). Bỏ qua hai budget JS nén chỉ đo trên host, geometry sidebar desktop trong cấu hình mobile, tooltip hover mobile và vùng bấm phone trong cấu hình desktop. Có kiểm tra HTML phía server đã mang nền tối, đổi VI/EN và đổi sáng/tối từ trang sách tác động đến reader. Lượt này không kiểm chứng RPC metadata trên Supabase production; migration được kiểm tra bằng PostgreSQL/PGlite.
- Lượt riêng trên production build cục bộ nối Supabase: các ca gom lưu, giữ vị trí qua đổi chương/reload, chốt `pagehide` và geometry trước JS: **5 đạt, 3 bỏ qua**. Có một lượt trước đó bị mất hydration vì build lại khi server cũ còn chạy; đã dừng server, build và khởi động lại rồi kiểm tra đạt. Không tính lượt lỗi môi trường đó là kết quả của bản đã kiểm chứng.
- Đo cục bộ bước đầu: bài cuộn 120 khung tạo **4 put thay vì 240**; CLS desktop reader khoảng **0,004 thay vì 0,203**; JavaScript trang đăng nhập khoảng **275 KB nén**. Môi trường local khác Vercel, chưa dùng các số này để khẳng định cải thiện tốc độ mạng production.
- Tại lần kiểm tra gần nhất, Supabase chưa có `get_public_book_index` (PGRST202). **Chưa triển khai source mới lên production**, tránh làm trang sách đang phục vụ bị lỗi. Cần áp dụng migration 003 rồi chạy full Playwright, QA VI/EN và đo lại trên URL Vercel.
- Chưa kiểm tra Android/iOS thật. Những bằng chứng của bản production cũ bên dưới được giữ làm lịch sử, không tính là kiểm chứng cho đợt tối ưu mới.

## Đã kiểm tra

- 20 chương tiếng Việt, lời tựa VI và 20 chương tiếng Anh, dùng dữ liệu thật từ EPUB/DOCX đã cung cấp.
- `npm run check:sources`: **2.896 đoạn VI + 1.420 đoạn EN khớp bản gốc**. Chỉ tách masthead/tiêu đề lặp, giữ điểm neo và toàn bộ đoạn văn/chú thích. Bản EPUB gốc và bản sao thử có SHA-256 trùng nhau.
- `npm test`: **41 kiểm thử**, gồm nhập file, chặn HTML nguy hiểm, giới hạn giải nén theo luồng, PDF chỉ chứa khoảng trang được chọn, neo ghi chú theo revision, TTS chunking, màu chữ nút, nhãn chương chưa dịch, history phân trang, cấu hình đọc public, lệnh quản trị Node/ESM, migration safe-update, giữ các font đã chọn và các transaction/RLS PostgreSQL. Cấu hình DB thiếu/lỗi không được làm các chương cũ đã thu hồi xuất hiện lại từ bản seed.
- `npm run typecheck` và `npm run build`: đạt trên Node 24, Next.js 16.4.2.
- Playwright Chromium: lượt full trên Vercel `dpl_3p2h28DosVsq2emtNxeBm5qkUGQT` **38 đạt, 2 bỏ qua theo thiết kế**, không dùng retry. Sau bổ sung guard bộ lọc giọng ở `dpl_A4jYCve1HNRG9uLHJDQ1DSf276HX`, chạy lại toàn bộ sáu ca mục lục/giọng đọc desktop/mobile: **6 đạt**. Hai mục bỏ qua trong lượt full là kiểm tra vùng bấm phone trong project desktop và tooltip hover trong project mobile. Có kiểm tra UI/nội dung VI/EN, HTML lang phía server, thiếu bản dịch, tiến độ/font, ghi chú, phân trang, âm thanh, tự cuộn, chặn API cho khách, điều hướng/lịch sử/vị trí, tooltip, font bổ sung, màu, mục lục và trạng thái giọng đọc.
- QA screenshot: desktop 1440×1000 và mobile 390×844; không tràn ngang, toolbar trong màn hình, không có lỗi JavaScript. Có ảnh trang sách VI/EN, reader giấy ngà/tối, settings và admin khóa.
- Browser component harness riêng trong `work/ui-harness`: Tiptap chỉnh sửa thật, loại bỏ script/handler khỏi preview, nhập đúng DOCX chương 2 trong trình duyệt; PDF.js vẽ canvas, có lớp chữ và chuyển trang được. Harness không được deploy và không giả lập lưu Supabase.
- Detector Impeccable chạy một lần, kết quả `[]`. Đánh giá độc lập yêu cầu tăng hit area điện thoại và chuyển byline xuống dưới tiêu đề; bản sửa được kiểm tra lại riêng.

## PostgreSQL/RLS đã chạy cục bộ

PGlite chạy migration PostgreSQL thật trong môi trường test, với các role/schema Auth/Storage giả lập làm boundary cho dịch vụ Supabase. Đã xác nhận:

- Guest không đọc được bảng draft/version và không ghi được; dữ liệu công khai chỉ từ published revision.
- Editor bị thu hồi không ghi được; editor không tự nâng quyền hay thay membership.
- Không vô hiệu hóa được owner cuối cùng.
- Stale save/publish bị từ chối, kể cả caller bỏ expected revision.
- Nhập/xuất bản theo nhóm rollback toàn bộ nếu một chương xung đột.
- Chỉ nhắc đường dẫn ảnh trong văn bản không làm file private thành public; thu hồi chương thu hồi quyền cấp URL mới cho ảnh của chương.
- Seed đủ 41 bản nội dung bằng một transaction và từ chối ghi đè sách đã có chương.

Test history và cấu hình đọc public mock boundary SDK Supabase để kiểm tra response/projection/cursor và trạng thái lỗi của ứng dụng; đây không phải bằng chứng Supabase Auth hoạt động trên hosting.

## Hai ứng dụng tham khảo

- Đã clone `EPUB-Forge` và `Novel-Hub` vào `work/references`.
- Chạy bản phát hành Windows riêng: EPUB-Forge **v2.5.0**, Novel-Hub **v1.0.9**, không cài Go/Bun toàn máy.
- EPUB-Forge nhận đúng tên **Truyền Kỳ Mạn Lục**, tác giả **Nguyễn Dữ**, 22 spine entries (bao gồm mục lục/lời tựa), trả HTML chương 1 HTTP 200.
- Novel-Hub đã setup môi trường thử cục bộ, tạo thư viện, upload cùng EPUB, nhận 22 entries và trả HTML chương 1 HTTP 200 chứa đúng nội dung.
- Chỉ thử trên bản sao. Không chạy crawler, extension tải truyện hoặc sửa file EPUB gốc. Không chạy toàn bộ upstream test suites.

## Còn cần cấu hình/kiểm chứng ngoài máy

Người dùng đã tạo Supabase và điền cấu hình riêng trên máy. Đã kiểm tra thực tế: đọc bảng bằng service role thành công, hai bucket private, public RPC hoạt động, có một owner active do Admin API tạo; liên kết một lần lưu riêng trên máy, không gửi email. API Auth settings xác nhận đăng ký công khai đã tắt và Email provider bật. Người dùng xác nhận đã đặt mật khẩu/vào khu biên tập; Admin API xác nhận owner active, email đã xác nhận và có lần đăng nhập.

Lần seed đầu bị Supabase chặn `UPDATE requires a WHERE clause`; transaction rollback và xác nhận số chương vẫn bằng 0. Đã sửa bốn routine trong 001 và áp dụng migration nâng cấp `002_safe_updates.sql`; kiểm thử PostgreSQL xác nhận nâng cấp giữ grants. Người dùng xác nhận chạy 002 thành công. Seed lại thành công trong một transaction: 21 bản VI (20 chương + lời tựa), 20 bản EN; đọc public RPC trên hosted Supabase xác nhận tiêu đề và HTML của cả 41 bản khớp nguồn. Anonymous không đọc được bảng chapter_versions. Không tắt safe-update. Khóa server không xuất hiện trong 86 file client build được kiểm tra.

Kiểm chứng hosted bằng tài khoản editor tạm (không gửi email), qua API Vercel, Auth, RLS và Storage thật; chi tiết tại `verification/hosted.json`:

- Đăng nhập bằng mật khẩu trong Chromium, nạp khu biên tập không có lỗi JavaScript; editor không có tab quản lý người dùng và API quản lý thành viên trả 403.
- Editor không tự nâng role qua REST; role trong database vẫn là editor.
- Upload trực tiếp ảnh và file nguồn vào hai bucket; API kiểm tra signature và đăng ký ảnh; editor xem được ảnh private, khách nhận 404 và không tải được nguồn.
- Lưu hai revision vào chương thử chỉ có nháp; HTML script bị loại bỏ; lịch sử tải riêng nội dung, stale save bị chặn 409. Public RPC không chứa chương thử.
- Nhập lại phải xác nhận. Nhập nhóm lỗi và xuất bản nhóm lỗi đều rollback; published pointer của chương thử vẫn null. Thu hồi bản thử chưa xuất bản thành công.
- Thu hồi membership chặn API server, RPC trực tiếp, URL ảnh private và Storage dù session cũ còn hợp lệ.
- Đã xóa upload/asset/chương/revision/membership/Auth user thử. Đọc lại database xác nhận không còn chương hay membership thử. Không đưa chương thử ra công khai.

Chưa thực hiện xuất bản thành công một thay đổi trên sách thật, hoặc thay bìa/metadata/thứ tự thật trong hosted; các thao tác đó sẽ do owner thực hiện trên nội dung mong muốn. Không coi phép rollback xuất bản là bằng chứng xuất bản thành công. Mật khẩu owner không được cung cấp cho agent. Xem SUPABASE_SETUP.md.

Không kiểm tra chất lượng phát âm bằng tai trên thiết bị người dùng. Giọng VI/EN phụ thuộc browser/hệ điều hành; một số giọng có thể dùng dịch vụ online của thiết bị. Không OCR hoặc kiểm tra các định dạng ngoài phạm vi đã chốt.

`npm audit` báo 3 mục moderate trong chuỗi CLI của Mammoth (`argparse`/`sprintf-js`); không có bản sửa tương thích được npm đề xuất. Luồng nhập dùng library/browser API của Mammoth, không gọi CLI/argparse. Không áp dụng downgrade phá vỡ phiên bản chỉ để xóa cảnh báo audit.

## Triển khai Vercel

Production: https://truyen-ky-man-luc.vercel.app — deployment `dpl_A4jYCve1HNRG9uLHJDQ1DSf276HX`, trạng thái **READY**, đã sửa bộ đếm 20 câu chuyện và xử lý giọng đọc di động, gồm bộ lọc khi danh sách giảm còn một giọng. Xem DEPLOYMENT.json để biết các đường dẫn đã kiểm tra và giới hạn kiểm chứng.

Đã kiểm tra trực tiếp `/vi`, `/en` và `/admin`: HTTP 200. API quản trị khi chưa cấu hình trước đây trả 503; hiện đã cấu hình nên trả 401 cho khách không đăng nhập. Form đăng nhập email/mật khẩu hiển thị đúng trong trình duyệt. QA ảnh trên URL thật với Supabase: desktop/mobile không tràn ngang, toolbar nằm trong viewport và không có page error.

Bản deploy đầu build thành công nhưng lỗi runtime `ERR_REQUIRE_ESM` khi jsdom nạp `@exodus/bytes`. Đã tái hiện bằng Node khi tắt require(ESM), xác định bằng bản preview chẩn đoán, rồi sửa cấu hình project `NODE_OPTIONS=--experimental-require-module` theo [tài liệu Vercel](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration). Không thay hoặc hạ phiên bản sanitizer. Cấu hình này phải được giữ khi redeploy/chuyển project.

Kết nối Vercel cho phép tạo/deploy và đọc trạng thái nhưng API build/runtime logs trả 403; không coi các log đó đã được đọc. Bằng chứng bàn giao dùng trạng thái READY, phản hồi HTTP và các kiểm thử trình duyệt trực tiếp. Bản preview chẩn đoán cũ chỉ kiểm tra phiên bản Node và nạp dependency, không đọc khóa hay dữ liệu người dùng; nó không nằm trong source hoặc deployment production cuối.

## Độ trễ Next/Previous

Đã đọc lại `Novel-Hub` (điều hướng trong reader, tải trước chương kế tiếp) và `EPUB-Forge` (đổi phần xem trước theo chương). Trước sửa, mỗi nút gọi router/server, tải và làm sạch cả sách rồi dựng lại reader. Sau sửa, reader giữ nội dung published của locale hiện tại trong RAM, thay chương và cập nhật History API; không cache draft hoặc thêm cache server.

Đo trên cùng URL Vercel, Chromium desktop, từ click tới tiêu đề mới được vẽ ở animation frame kế tiếp, 4 lần/build:

- Trước: **1.023–1.574 ms**, 1 request server mỗi lần.
- Sau: **7–15 ms**, 0 request chuyển chương mỗi lần.
- Chi phí: lần mở đầu tải khoảng 162 KB (đã nén), thay vì khoảng 18 KB; decoded body khoảng 518 KB. Dữ liệu chi tiết và commit tham khảo nằm trong `verification/navigation.json`. Đây là phép đo mẫu, không cam kết tốc độ đồng nhất trên mọi thiết bị.

Sáu kiểm thử điều hướng desktop/mobile đạt: chặn network sau khi đọc chương đầu vẫn Next/Previous được, Back/Forward cập nhật đúng chương, mục lục/cuối chương dùng cùng đường đi, giữ vị trí riêng từng chương, deep-link reload và đổi VI/EN sau điều hướng vẫn đúng ID. Kiểm tra request chỉ xét đường dẫn reader; prefetch trang giới thiệu của Next.js không phải request chuyển chương.

Mở đầu/làm mới/đổi ngôn ngữ vẫn cần mạng. Nội dung giữ theo published snapshot lúc mở reader; làm mới để nhận bản sách mới. Ảnh và PDF vẫn tải theo nhu cầu. PDF được remount theo chapter ID và xóa text TTS cũ khi chuyển chương. Bản tối ưu này phù hợp quyển sách hiện tại; nếu một bản ngôn ngữ tăng tới nhiều MB, nên đổi sang prefetch/cache từng chương.

## Editor lẫn nội dung và các chỉnh sửa giao diện

Đã tái hiện lỗi trên `/admin?lang=vi`: sau đổi chương, tiêu đề/form đã cập nhật nhưng Tiptap được mount bằng HTML cũ trước khi effect nạp form. Tiptap chỉ lấy `content` lúc khởi tạo nên có thể hiển thị và lưu nhầm nội dung của chương trước. Lỗi chung ảnh hưởng cả VI/EN.

Đã ràng buộc form với ID chương + locale + version ID và chỉ mount editor khi context khớp. Trong lúc lưu/upload, vùng nhập bị khóa, nút đổi chương bị vô hiệu hóa và chặn thao tác chuyển context. Không tự sửa nội dung người dùng đã lưu trước đó. Lịch sử lời tựa/chương 1/chương 2 được sao lưu riêng trước khi sửa, không upload bản sao lưu vào source/deployment.

`npm run verify:editor` chạy trên cả local và URL Vercel, với tài khoản editor và ba chương nháp thử (mỗi chương có VI/EN): kiểm tra nội dung gốc khi chọn chương, gửi clipboard paste event có định dạng, lưu nháp lần lượt, chọn lại và reload, đọc database kiểm tra marker riêng từng chương/locale và published pointer vẫn null. Trước sửa lỗi xuất hiện ngay lần chọn đầu; sau sửa cả VI và EN đạt. Tài khoản, membership, chương, edition và revision thử được xóa. Đọc lại xác nhận số chương/membership có tiền tố thử bằng 0. Xem `verification/editor-switch-latest.json`.

Đã bổ sung sáu phông tự host, kiểm tra browser tải được file Lora thực và giữ lựa chọn sau reload. Tooltip dùng một bubble chung, cập nhật nội dung ngay khi rê giữa các nút, easing 120 ms, hỗ trợ keyboard/Escape/reduced motion; bỏ `title` native trên IconButton và toolbar định dạng. Ô tùy biến nền tối có swatch 26px + HEX cập nhật trực tiếp. Color-scheme của native controls dựa vào màu nền thực nên nền tối tùy biến không mở menu sáng. Kiểm thử cả desktop/mobile, ảnh QA theo cùng lượt không có tràn ngang.

## Bộ đếm mục lục và giọng đọc di động

Trước sửa, BookDetail chỉ đếm những chương có bản nội dung ở locale đang chọn nên VI hiện 19 dù mục lục có đủ 20 câu chuyện (chương 5 thiếu VI). Đã đếm tổng các chapter ID của mục lục, cùng cách với sidebar reader; không tính lời tựa, không tự xuất bản hay bổ sung nội dung đang thiếu.

Hook giọng đọc hỗ trợ nhãn ngôn ngữ vi/en dùng dấu gạch ngang hoặc gạch dưới, cập nhật bằng voiceschanged, focus/pageshow và ba lần kiểm tra muộn có giới hạn. Khi mở bảng hoặc bấm đọc, đọc lại danh sách mới nhất. Giao diện chỉ cho chọn giọng đúng ngôn ngữ truyện, báo rõ danh sách trống/một giọng, có Làm mới và hướng dẫn Android. Tốc độ vẫn được gửi qua SpeechSynthesisUtterance.rate. Lỗi language-unavailable/voice-unavailable đưa hướng dẫn cài dữ liệu thay vì yêu cầu chọn giọng khác không tồn tại.

Sáu bài mới trên desktop/mobile đạt: bộ đếm 20 ở VI/EN, API không có giọng, lỗi thiếu ngôn ngữ, làm mới khi giọng xuất hiện muộn, tên locale vi_VN, giọng EN đơn, cập nhật voiceschanged và rate 1.4. Các ca giọng dùng mock boundary Web Speech API trong browser để kiểm tra UI và tham số; không phải nghe âm thanh trên điện thoại Android thật. Không thêm provider TTS online, không tạo giọng giả; số giọng thực tế vẫn do browser/OS cung cấp. Tham khảo [getVoices](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices), [voiceschanged](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/voiceschanged_event), [cài giọng Android](https://support.google.com/accessibility/android/answer/6006983?hl=vi).
