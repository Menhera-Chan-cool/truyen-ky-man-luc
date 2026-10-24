# Bằng chứng kiểm chứng — cập nhật 24/10/2026

## Độ ổn định trình đọc — release hiện tại

Production `dpl_FJBcGQUKnXxwJRpcRn2KFACTnRvr`, source runtime `f7ee05bf28908ec111ae9f2b3b44e9adcb90bcee`, alias https://truyen-ky-man-luc.vercel.app đã xác nhận READY và trỏ đúng deployment. Đã xử lý cả 5 mục được duyệt trong `OPTIMIZATION_REVIEW_3.md`; các phần bên dưới là lịch sử kiểm chứng của các release trước.

- TTS bị native `interrupted`/`canceled` chuyển sang tạm dừng, giữ boundary/chunk để tiếp tục. Nút toolbar chuyển giữa đọc, tạm dừng và tiếp tục; bảng giọng đọc có nút Dừng riêng. Rate/voice mới được áp dụng khi tiếp tục. Callback muộn từ chunk cũ không được dừng hoặc bỏ qua chunk mới; đổi chương xóa phiên đọc cũ.
- Liên kết chú thích, quay lại đoạn gốc, Back/Forward và Tab/Shift+Tab trong chế độ trang đi qua trạng thái trang chung, giữ tiến độ và focus; container không tự cuộn ngang lệch bộ đếm. Ca chú thích dùng HTML fixture trong browser, không thêm/sửa chú thích của sách thật.
- Chạm ngoài đóng bảng thao tác chọn chữ; tương tác với ô ghi chú/nút bên trong giữ bảng và ghi chú đang gõ.
- RPC đọc sách công khai thử lại tối đa một lần sau 200 ms khi lỗi kết nối/429/5xx; lỗi quyền/schema không retry, lỗi kéo dài vẫn báo lỗi. Không retry mutation hoặc khôi phục nội dung cũ từ seed/cache.
- Reader chỉ làm sạch HTML ngôn ngữ đang đọc, giữ metadata của cả VI/EN; caller đầy đủ vẫn nhận cả hai bản đã làm sạch. Không thay đổi hợp đồng RPC, schema hoặc nội dung published.
- **67 unit đạt**, typecheck và production build đạt với 2 worker local. Bộ 78 ca local: **73 đạt, 5 bỏ qua**; sau đó thêm sửa focus bàn phím và chạy lại cả 4 ca reader-reliability trên bản dựng cuối, đều đạt. Xem `verification/reliability-local.json`.
- Bộ đầy đủ trên URL production bản cuối: **75 đạt, 3 bỏ qua theo cấu hình, 0 lỗi/flaky/retry**. Ba ca bỏ qua là vùng bấm phone trong project desktop, geometry sidebar desktop trong project mobile và tooltip hover mobile. Bao gồm cả sửa focus cuối, các luồng đọc cũ, backup, tiến độ, VI/EN, giọng/tốc độ và chặn API ghi cho khách. Xem `verification/reliability-live.json`.
- Visual QA local và production: 4 tổ hợp desktop/mobile × VI/EN; nút tiếp tục/tạm dừng và Dừng vừa panel, không tràn ngang hoặc page error. Đã xem ảnh phone VI tạm dừng và desktop EN đang đọc. Xem `verification/reliability-qa-local.json`, `verification/reliability-qa-live.json`.
- Đo lại 4 lần chuyển chương trên production: **5–17 ms, 0 request chuyển chương**. Đây là mẫu Chromium, không phải cam kết trên mọi thiết bị. Xem `verification/reliability-navigation-live.json`; phép đo cuộn riêng nằm trong `verification/reliability-performance-live.json`.

Repository GitHub vẫn PRIVATE. Không cần migration, không ghi nội dung sách hoặc tạo tài khoản QA trong đợt này; kiểm chứng editor/Auth/Storage thật của các đợt trước vẫn được ghi riêng bên dưới. Chưa thử Android/iOS vật lý hoặc nghe chất lượng/nhịp giọng thật; các ca TTS mô phỏng boundary API native, không chứng minh hệ điều hành cho phép phát nền liên tục.

## Rút ngắn ngắt nghỉ TTS — release trước

Production `dpl_Hh1Gez4vmqoSKoiBSczrk1aSPP94`, source runtime `3ce0e049542439545a549b773e3141c2a5c8ab7b`, alias https://truyen-ky-man-luc.vercel.app đã xác nhận READY. Các mục tiếp theo là bằng chứng của release trước, không phải bộ đầy đủ đã chạy lại cho thay đổi nhỏ này.

- Thêm **Giọng đọc & tốc độ → Ngắt nghỉ ngắn**, mặc định bật, lưu theo thiết bị. Gộp các câu ngắn trong cùng đoạn vào lượt đọc tối đa 240 ký tự, giảm khởi động lại giọng ở mỗi dấu chấm.
- Chỉ làm nhẹ dấu `. : ; …` và gạch ngang trong `SpeechSynthesisUtterance.text`, giữ nguyên HTML sách và độ dài UTF-16 để boundary/tiếp tục/đi theo đoạn không lệch. Giữ số thập phân, giờ, domain và các viết tắt thông dụng đã kiểm tra. Tắt tùy chọn để dùng dấu câu gốc. Bật/tắt lúc đang nghe tiếp tục từ boundary hoặc chunk hiện tại.
- JSON v1 trước đây chưa có trường mới vẫn nhập được với mặc định bật; lựa chọn false được giữ, giá trị sai kiểu bị từ chối.
- **62 unit đạt**, typecheck và production build đạt. Lượt build local đầu thiếu bộ nhớ ở 11 worker; chạy lại bằng `CIRCLE_NODE_TOTAL=3` (2 worker) đạt, không đổi cấu hình hệ thống/project. Build Vercel đạt với cấu hình hiện có.
- Local: 17/18 ca đạt lần đầu, một ca backup gặp trang báo không tải được dữ liệu published; chạy riêng lại nguyên ca đó đạt. Trên URL production: **18/18 ca đạt, 0 skip/fail/retry**, gồm 14 ca TTS và 4 ca backup trên Chromium desktop/mobile, VI/EN. TTS dùng mock ở API native để kiểm tra văn bản phát ra, boundary, rate/voice, pagination và lưu tùy chọn; không đo khoảng nghỉ âm thanh thật. Xem `verification/tts-pauses-local.json`, `verification/tts-pauses-live.json`.
- Visual QA local và URL thật: 4 tổ hợp VI/EN × desktop/mobile, tùy chọn mặc định bật, không tràn panel hoặc page error. Không cần retry ở các lượt visual QA. Xem `verification/tts-pauses-qa-local.json`, `verification/tts-pauses-qa-live.json`.

Giới hạn: Web Speech không có thuộc tính đặt số mili giây nghỉ ở từng dấu câu ([API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance)); thay dấu câu trong bản phát là cách điều chỉnh nhịp gần đúng và có thể đổi ngữ điệu. Chưa nghe thử trên Android/iOS vật lý. Không khẳng định mức giảm cố định với mọi giọng; có thể tắt để trở về cách đọc gốc. Không sửa nội dung sách, tài khoản hay dữ liệu Supabase.

## Giữ vị trí đọc/nghe và sao lưu thiết bị — đã triển khai

Đợt trước: production `dpl_H7d6bNkA8DYPcw4Z59d6ZUA5evm9`, source runtime `6cb64f7f6fbd6d4e1665c76327cb0d9e7a02a0fb`, alias https://truyen-ky-man-luc.vercel.app đã được xác nhận READY tại thời điểm kiểm tra. Release hiện tại nằm ở đầu tài liệu và DEPLOYMENT.json.

- Đã triển khai toàn bộ phạm vi `tasks/reader-continuity.md`: neo đoạn qua đổi phông/cỡ/giãn dòng/chiều rộng/chế độ/viewport; TTS điều khiển đúng trang và tiếp tục chunk/boundary khi đổi giọng/tốc độ; hủy phát âm thanh đang chờ; mở đánh dấu liên chương một lần; nhớ trang/zoom PDF; khóa parent editor khi nhập/upload; sao lưu JSON có xem trước, kiểm tra dữ liệu và khôi phục atomic.
- **58 unit đạt**, typecheck và production build đạt. Bộ Chromium desktop/mobile cục bộ: **59 đạt, 5 bỏ qua**. Sau đó chỉ bổ sung xử lý Auth tạm thời phía server, có ba unit mới; đường đọc không thay đổi. Xem `verification/continuity-playwright-local.json`.
- Trên URL Vercel, bộ đầy đủ: **60 đạt, 3 bỏ qua, 1 lỗi transport `ECONNRESET`** ở yêu cầu API GET kiểm tra theme desktop. Chạy riêng lại nguyên bài kiểm thử đó: **1 đạt**, không đổi assertion hoặc bật test retry. Tổng cộng **61 ca riêng biệt đã được xác minh**. Không gọi lượt đầy đủ đầu tiên là sạch lỗi; cả hai kết quả được giữ trong `verification/continuity-playwright-live.json`.
- Editor thật, cả local production build và Vercel: dán/lưu ba chương nháp riêng ở VI/EN, chọn lại/reload, đọc database kiểm tra marker và draft pointer; state không chứa HTML; hủy GET chương cũ. Đã kiểm tra khóa parent, giữ preview khi import thất bại, cảnh báo bỏ preview, thử lại và chờ refresh; upload ảnh lỗi mở khóa đúng. Các bước storage/import lỗi được mock ở ranh giới mạng; dán/lưu nháp dùng API/database thật. Tài khoản/membership/edition/version/chapter QA đều đã xóa thành công. Các 409 chủ động và ERR_ABORTED do hủy yêu cầu cũ trong report là hành vi thử nghiệm mong đợi. Xem `verification/continuity-editor-local.json`, `verification/continuity-editor-live.json`.
- Đã đọc lại database và danh sách Auth sau kiểm thử: **0 chương QA, 0 membership QA, 0 tài khoản Auth QA** còn lại. Xem `verification/continuity-qa-cleanup.json`.
- JSON: xuất file thật rồi khôi phục vào browser context mới, kiểm tra phông/tiến độ/ghi chú; nhập lặp không nhân đôi; giữ bản khác nội dung khi trùng ID; file sai bị từ chối trước ghi; lỗi quota giữa transaction rollback cả ghi chú. Cookie của thao tác restore chỉ đổi sau commit. File tối đa 10 MB, chỉ xử lý trên thiết bị.
- PDF.js trong Reader thật với fixture riêng: desktop/mobile đều giữ trang 2, zoom 125% khi đổi chương và reload; resize vẽ lại canvas đúng trang. Không thêm chương PDF QA vào sách công khai; đây là bằng chứng fixture cục bộ, không phải PDF đã xuất bản trên Vercel. Xem `verification/pdf-continuity-local.json`.
- Hai lượt visual QA có giới hạn, local và URL thật: desktop/mobile, VI/EN, theme tối và preview JSON; không tràn ngang, toolbar nằm trong viewport và không page error. Ảnh nằm trong vùng QA bị loại khỏi Git/deployment.

Auth: probe phát hiện 1/20 yêu cầu API bị trả 401 trong khi cùng token được Supabase xác thực và còn hạn 3.600 giây. Nguyên nhân ở code là gộp mọi lỗi Auth thành “Session expired”. Đã thử lại đúng một lần với lỗi kết nối/429/5xx của bước xác thực, trả 503 nếu dịch vụ vẫn lỗi; không retry mutation. Token sai vẫn 401, editor bị thu hồi hoặc vào chức năng owner vẫn bị chặn. Lỗi đọc membership được phân biệt với quyền bị thu hồi. Xem `verification/auth-connectivity-probe.json`, `tests/editor-auth.test.ts`.

Đo trên URL production sau kiểm thử: chuyển chương **7 / 16 / 15 / 15 ms**, mỗi lần **0 request chuyển chương**. Cuộn 120 frame: **4 lần put tiến độ**, p95 **18 ms**, không long task trong lúc cuộn ở cả desktop và cấu hình mobile CPU chậm 4×. JavaScript trang đăng nhập **283.430 byte nén**, reader **219.312 byte nén**. CLS reader desktop khoảng **0,0051**, mobile **0** trong mẫu này. Đây là phép đo tổng hợp đơn lẻ, không phải số liệu người dùng thực; không cam kết mọi mạng/thiết bị có cùng tốc độ. Xem `verification/continuity-performance-live.json`, `verification/continuity-navigation-live.json`.

Không sửa/xuất bản lại sách thật để thử. Chưa kiểm tra Android/iOS vật lý hoặc nghe chất lượng giọng thật; khi browser không có boundary, TTS tiếp tục từ đầu chunk ngắn hiện tại. Dữ liệu backup là sao lưu thủ công, không đồng bộ tài khoản. Không cần migration mới.

## Đợt tối ưu và GitHub — đã triển khai production

- Source đã có: gom ghi tiến độ mỗi giây và chốt khi chuyển chương/rời trang; bố cục sidebar desktop ngay từ HTML/CSS ban đầu; tải editor/import theo nhu cầu; state admin chỉ trả summary, HTML tải theo phiên bản được chọn với AbortController và chốt context; cookie giao diện đã xác thực để server render đúng nền; RPC metadata-only trong migration 003.
- Vitest: **49 đạt**; typecheck và production build đã qua. Playwright reader/control/navigation cục bộ: **14 đạt, 4 bỏ qua** (budget nén chỉ đo trên host; kiểm tra geometry desktop/hover không áp dụng cho cấu hình còn lại). Có kiểm tra vị trí sau chuyển chương nhanh/Back/reload.
- `npm run verify:editor` trên build cục bộ nối Supabase thật: VI/EN dán, lưu ba chương, chuyển lại/reload, không trộn nội dung; state không có HTML; hủy yêu cầu chương cũ và mở bộ nhập theo nhu cầu. Tài khoản và các bản nháp QA tạm đã dọn thành công.
- Full Playwright trên chế độ sách mẫu cục bộ độc lập Supabase: **45 đạt, 5 bỏ qua, 0 lỗi** (50 ca; không retry). Bỏ qua hai budget JS nén chỉ đo trên host, geometry sidebar desktop trong cấu hình mobile, tooltip hover mobile và vùng bấm phone trong cấu hình desktop. Có kiểm tra HTML phía server đã mang nền tối, đổi VI/EN và đổi sáng/tối từ trang sách tác động đến reader. Lượt này không kiểm chứng RPC metadata trên Supabase production; migration được kiểm tra bằng PostgreSQL/PGlite.
- Lượt riêng trên production build cục bộ nối Supabase: các ca gom lưu, giữ vị trí qua đổi chương/reload, chốt `pagehide` và geometry trước JS: **5 đạt, 3 bỏ qua**. Có một lượt trước đó bị mất hydration vì build lại khi server cũ còn chạy; đã dừng server, build và khởi động lại rồi kiểm tra đạt. Không tính lượt lỗi môi trường đó là kết quả của bản đã kiểm chứng.
- Đo cục bộ bước đầu: bài cuộn 120 khung tạo **4 put thay vì 240**; CLS desktop reader khoảng **0,004 thay vì 0,203**; JavaScript trang đăng nhập khoảng **275 KB nén**. Môi trường local khác Vercel, chưa dùng các số này để khẳng định cải thiện tốc độ mạng production.
- Migration 003 đã áp dụng và gọi thành công bằng khóa anon. RPC metadata trả **5.053 byte**, so với **894.637 byte** của RPC đầy đủ trên cùng bản xuất bản (21 phần, 41 bản VI/EN). Sau khi bỏ HTML, metadata hai kết quả khớp hoàn toàn; không có trường HTML trong RPC mới. Xem `verification/metadata-rpc.json`.
- Sau migration, full Playwright trên production build cục bộ nối Supabase thật: **45 đạt, 5 bỏ qua**. Sau triển khai, full Playwright ngay trên alias production bản cuối `dpl_CdhxWFAa9xD4J2bXZ64k7Fa9q5jv`: **47 đạt, 3 bỏ qua, 0 lỗi, không retry**. Ba ca bỏ qua là vùng bấm phone trong cấu hình desktop, geometry sidebar desktop trong cấu hình mobile và tooltip hover mobile.
- Editor VI/EN trực tiếp trên bản tối ưu production `dpl_F2a8efPLvKNaqKJeCBFpAGG1U14W`: dán/lưu ba chương, chuyển lại/reload, state không có HTML, hủy yêu cầu trả muộn, mở bộ nhập theo nhu cầu; tất cả đạt và dọn tài khoản/bản nháp QA thành công. Bản cuối chỉ sửa thêm chiều rộng tooltip; logic/API editor không đổi. Bằng chứng: `verification/editor-switch-latest.json`.
- QA cuối trên Vercel: desktop/mobile, VI/EN, giấy ngà/tối; không tràn ngang, toolbar vừa màn hình, không có lỗi JavaScript. Tooltip mở lần đầu ở nút sát mép phải đã có regression test và hiển thị đủ chiều rộng. Bằng chứng: `verification/optimization-hosted-qa.json`.
- Các phép đo sau tối ưu trên Vercel nằm trong `verification/performance-after-hosted-2026-10-23.json` và `verification/navigation-after-hosted-2026-10-23.json`. Mỗi cấu hình một mẫu, CPU mobile chậm 4 lần; không coi đây là số liệu người dùng thật. Số bản công khai tăng từ 40 lên 41 giữa các đợt đo nên không dùng thay đổi kích thước HTML toàn trình đọc để đánh giá tối ưu.
- Source/runtime tại commit `ad38c75fa3f0a1f12fc67dfd1230b8c9a7c370f3`; repository GitHub đã kiểm tra **PRIVATE**. Các commit bằng chứng sau đó không thay đổi runtime. `.env.local`, khóa cấu hình, thư mời và bản sao lưu riêng bị loại khỏi Git và ZIP.
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
