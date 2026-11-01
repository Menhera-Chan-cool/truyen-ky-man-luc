# Novel chống treo và giảm render cuộn TT — production 01/11/2026

Production **dpl_C8dmmDjVmKoxZcbLzVqkHh82Mawn**, runtime source **6ce3337025f0fa0f2dae972ee9a87fa78977b768**, https://truyen-ky-man-luc.vercel.app READY. **196 hash** mã quan trọng khớp source Vercel. GitHub private. Commit theo sau chỉ cập nhật báo cáo, không đổi runtime.

- Deadline chung bao gồm session/fetch/JSON, giữ caller cancellation và chặn ghi muộn nếu auth trả sau timeout. Mặc định 15s, import/batch 30s, TT registration 45s, upload 120s. Dùng lại deadline của TT. Khi RPC mất kết nối, chapters/book trả 503 thay vì đánh đồng với dữ liệu không hợp lệ.
- Novel save/import/restore xác nhận revision mới và HTML đã sanitize; publication/batch/withdraw dùng đúng draft ID và revision không tăng (khác TT). Metadata/order/archive kiểm tra đúng trạng thái mong muốn. Không tự retry ghi. Kết quả chưa rõ hoặc refresh lỗi giữ nội dung/danh sách và giải thích cần kiểm tra bản server. Import chỉ bỏ candidates sau khi parent refresh thành công. Giữ nguyên CAS/RLS/role.
- TT bỏ state ratio theo frame, cập nhật CSS/ARIA qua rAF. 90px/90 frame: **90 React commits trước sửa → 0 sau sửa** trên Chromium desktop/mobile và WebKit phone, cả local và production. Tiến độ/reload, autoscroll, đổi chế độ/vị trí thanh/ẩn hiện và resize đạt. Đây không phải FPS trên iPhone vật lý.
- **171 unit / 42 file**, typecheck/build đạt. Production: **13 nhóm Novel trên mỗi Chromium/WebKit (26 tổng)**, **31 nhóm TT integration**, **6 ca progress browser**. Các ca cắt phản hồi save/import sau commit không gửi lại POST; hung read kết thúc và Retry đúng chương; refresh sau ghi lỗi vẫn giữ nội dung. Import source/inline upload của verifier có boundary mock, không coi là kiểm thử upload thật mọi định dạng. Publication/metadata reconciliation có unit; không sửa metadata sách thật để thử.
- Candidate 1bc931b đã qua nội dung nhưng collector mới phát hiện WebKit phát lỗi access-control khi presence request bị hủy lúc reload. Đã sửa: metadata presence nhỏ dùng keepalive, không tạo cleanup fetch, không tiếp tục GET từ effect đã đóng; giữ lease 90s có sẵn. Bản cuối đã qua 5 lần reload nhanh local và hai lượt đầy đủ WebKit; **pageErrors = 0**. Không nới Origin/CORS hay quyền truy cập.
- Fixture đã dọn; hash sách công khai trước/sau TT verifier không đổi. Các requestfailed/409/400 được tiêm hoặc hủy khi điều hướng là lỗi kiểm thử dự kiến, không phải page error.

Bằng chứng: `SPEC-novel-deadlines-comic-scroll.md`, `verification/novel-scroll-live.json`, `verification/editor-network-chromium-live.json`, `verification/editor-network-webkit-live.json`, `verification/comic-shared-live.json`. Báo cáo hoàn chỉnh được cập nhật trong commit sau runtime snapshot.

Chưa đo FPS/RAM trên iPhone vật lý hoặc tải nhiều người kéo dài. Những mục phía dưới là lịch sử release trước.

---

# Bốn tối ưu từ follow-up audit — production 01/11/2026

Production **dpl_88oCJhbjc2r6UxAjokuJmxnzwe3Y**, runtime source **cde80583f8523ef6844cb43990c0aa5103ebc4f5**, https://truyen-ky-man-luc.vercel.app READY. **189 hash** mã quan trọng khớp source Vercel; API listing bị cắt chỉ phần báo cáo, không thiếu tệp quan trọng. GitHub private. Commit sau chỉ ghi kết quả kiểm chứng, không đổi runtime.

- Hai ảnh TT chương 1: **7.058.084 → 4.307.066 byte (giảm khoảng 39%)** bằng WebP lossless nguyên độ phân giải; SHA256 nguồn không đổi và raw RGBA sau giải mã giống toàn bộ. Bản đọc riêng dùng cùng quyền của nguồn; thiếu derivative thì dùng nguồn, lỗi hạ tầng giữ 503. Zoom PC trên 100% dùng nguồn. Backfill không overwrite và không đổi dữ liệu phiên bản.
- Preload chủ động theo byte/mạng: tối đa hai trang/8 MiB bình thường, một trang/1 MiB khi chậm; Data Saver/2G tắt. Nạp nhiều hơn vẫn trong 8 MiB. Dùng byte nguồn làm upper bound; bỏ URL đã tải/đang chờ. Đây không phải hạn mức tổng lưu lượng của native lazy loading hoặc ảnh người đọc đang xem.
- Deadline đọc/lưu/xuất bản 15 giây, đăng ký ảnh 45 giây, upload 120 giây. Không tự retry ghi; mất response hoặc JSON bị cắt thì đọc head để xác nhận đúng nội dung/revision. Phân biệt revision biên tập và draftRevision nội dung khi xác nhận publish, dựa trên hợp đồng RPC thật. Upload SDK không có signal theo từng upload; checkpoint xác nhận trường hợp upload hoàn tất muộn trước khi truyền lại cùng đường dẫn bất biến.
- Đo live CSS giải nén ở cold HTML stylesheet: trang sách/admin **284.393 → 57.968 byte**, Novel **72.221**, TT **76.729**. Phông tùy chọn chỉ theo Reader; CSS TT/editor theo công cụ; PDF viewer dùng dynamic import với CSS riêng. Không xem số này là byte mạng nén, INP hay FPS. Không thêm dependency/schema/analytics.
- **150 unit / 38 file**, typecheck/build đạt. Local: 31 nhóm TT integration, 21 UI, 4 WebKit comic UI và 10 font/layout. Production: **31 nhóm TT Chromium/WebKit, 23 UI Chromium desktop/mobile, 10 font/layout VI–EN** đạt. Ba ca UI chỉ áp dụng PC được bỏ qua trên phone. Hai nhánh save/publish bị cố ý cắt response sau server commit, client xác nhận lại thành công; requestfailed tương ứng là lỗi được tiêm. Không page error. Fixture dọn xong; hash sách Novel công khai không đổi.
- Hai lỗi trong kiểm chứng đã được xử lý: dùng localhost thay 127.0.0.1 khi chạy verifier local để đúng Origin của Next; publish tăng head revision nhưng giữ revision nội dung, nên bước xác nhận cần draftRevision. Không nới kiểm tra Origin hoặc đổi RPC.

Xem `SPEC-optimization-followup.md`, `COMIC_PUBLISHING.md`, `verification/optimization-followup-live.json`, `verification/optimization-transfer-live.json`, `verification/optimization-reading-images.json`.

Chưa đo FPS trên iPhone vật lý hoặc tải nhiều người kéo dài. Những mục phía dưới là lịch sử release trước.

---

# UI đọc TT/Comic — production 01/11/2026

Production **dpl_kThn8dDu38veuq6QH5FkuEMctm4p**, runtime source **e1cc31e5b6c6de017e32d5a22910d2f7f97a340e**, https://truyen-ky-man-luc.vercel.app đã xác minh READY; **188 hash** mã runtime/test/migration quan trọng khớp source. GitHub private. Commit theo sau chỉ cập nhật harness kiểm thử, hướng dẫn và bằng chứng; không thay mã chạy ứng dụng.

- UI hiện khi mở tab mới, tự ẩn sau 10 giây. Nhấp đúp/chạm đúp bật–tắt toàn bộ; cuộn, di chuột trên nội dung và quay lại tab không gọi UI trở lại. PC hover/focus từng cụm độc lập. Giữ trạng thái ẩn khi đổi chương, VI/EN, Back và reload cùng tab.
- Mobile không có Stretch/zoom %, ảnh vừa chiều rộng và giữ cài đặt PC khi đổi kích thước. Giữ native pinch. Phân biệt chạm mép với chạm đúp; chặn compatibility dblclick sau touch/cancel để không bật UI hai lần hoặc chuyển trang ngoài ý muốn. Dialog tạm dừng bộ đếm; tự cuộn vẫn dừng khi rời tab.
- **139 unit / 38 file**, typecheck và production build đạt. Local và URL production đều **23 ca browser đạt**: 16 Chromium desktop/mobile, 7 WebKit phone. Bốn lượt được bỏ qua vì chỉ áp dụng PC (focus bàn phím và resize giữ zoom). Kiểm tra ảnh đã tải trên PC/phone bằng screenshot. Một ca thời gian ở lượt live đầu cộng cả độ trễ mạng vào 9 giây; đã đóng băng clock trước điều hướng và chạy lại đầy đủ, đạt.
- `interact` đã dùng được để dò Comix: lệnh Node/Playwright ngắn, scrapeId đã biết, phiên tuần tự và explicit stop. Không đổi khóa/cấu hình plugin. Reference xác nhận double gesture, giữ ẩn qua chương và không zoom mobile; 10 giây và hover từng cụm được triển khai theo yêu cầu người dùng vì phiên reference không tái hiện hoàn toàn hai điểm này.
- Không sửa nội dung, metadata, schema hay file nguồn sách; không chạy fixture xuất bản. Xem `SPEC-comic-controls.md`, `verification/comic-controls-local.json`, `verification/comic-controls-live.json`.

Chưa hiệu chuẩn trên iPhone vật lý. Những mục phía dưới là lịch sử release trước.

---

# Phông heading do editor quản lý — production 31/10/2026

Production **dpl_3ezjCMmz8U4dArMgeHqckcs3bmJr**, runtime source **39a65ef181d05a1ae4cf903a99b6377bb7054442**, https://truyen-ky-man-luc.vercel.app đã xác minh READY; **185 hash** runtime/test/migration quan trọng khớp source. GitHub private.

- Thêm `Thông tin sách → Phông heading`: mặc định được giữ, FZ Thư Pháp Tiểu Tự là lựa chọn thứ hai; owner/editor thêm và xóa phông dùng chung. VI/EN chọn riêng qua nháp/xuất bản metadata, có CAS. Chặn xóa phông còn dùng ở nháp hoặc công khai, giữ file và ghi nhật ký.
- Bucket riêng, RLS/ACL và gateway chỉ cho khách tải phông đã dùng trong metadata công khai; editor xem trước được. Kiểm tra 3MB trước đọc toàn file, native font decode, chữ ký/container và tồn tại file trước xuất bản. Dynamic CSS chỉ nhận UUID chuẩn. Không thêm dependency, không sửa HTML chương hoặc file nguồn.
- Đã áp dụng `20261031134023_heading_fonts.sql`. Font FZ 393.520 byte giữ nguyên SHA256 `1c66e4ca4489c9fcd7bf526d63d10aabb9d320b47a903d206c18d8f0b706194e` và metadata tác giả. Mẫu glyph VI/EN được kiểm tra.
- **135 unit / 37 file**, typecheck/build đạt. TDD cho riêng quyền/chọn nháp/xuất bản/xóa đang dùng, từ chối file hỏng/quá lớn/CSS lạ, file mất trước xuất bản và nguồn ngoại tuyến. Tái hiện mặt giấy lật chưa nạp phông heading; sửa warm font trong iframe, bỏ style font trùng khỏi snapshot và dựng lại khi đổi lựa chọn.
- Local và production: **7 nhóm Chromium/WebKit**, gồm upload/xem trước/xóa thật, font/body/default/VI–EN, ngoại tuyến/đối chiếu và chữ cuối, font đang công khai thật tải ẩn danh, thu hồi quyền. Fixture hình thức dùng bytes font mock để không đổi sách; kiểm tra bản công khai hiện tại dùng gateway/font thật. **2 ca menu desktop/mobile** đạt trên production. Không page error.
- Owner có chỉnh metadata trong quá trình làm; giữ nguyên lựa chọn của owner. Verifier không ghi metadata sách và có audit kiểm tra điều đó. Cleanup live gặp lỗi Data API tạm thời ở một tài khoản đã thu hồi; đã thử lại, dọn xong và xác nhận không còn tài khoản/phông thử. Xem `verification/heading-fonts-local.json`, `verification/heading-fonts-live.json` và `HEADING_FONTS.md`.

Chưa hiệu chuẩn trên iPhone vật lý. Những mục phía dưới là lịch sử release trước.

---

# Độ ổn định editor và chuyển chương TT — production 31/10/2026

Production **dpl_HnE6qBvm2SD7o4TdUKoZNCCyJgSh**, runtime source **c6e9a271b7c48f1c0d4023bd552cecc1d7b7e399**, https://truyen-ky-man-luc.vercel.app đã xác minh READY. 174 tệp runtime/test/migration quan trọng và 341 hash được API liệt kê khớp source; phần API không liệt kê chỉ thuộc các báo cáo verification. GitHub tiếp tục private.

- Đã áp dụng sáu mục trong `SPEC-comic-stability.md`: giới hạn quyền RPC, khôi phục nháp TT theo tài khoản/ngôn ngữ/chương, thumbnail riêng, hai tác vụ upload có checkpoint, điều hướng chương nội bộ và deadline/retry cho safe reads. Ảnh gốc và nội dung xuất bản được giữ nguyên. Không thêm dependency hay dịch vụ biến đổi ảnh trả phí.
- Hai ảnh cũ tổng 7.058.084 byte có bản xem nhanh tổng 72.550 byte, giảm khoảng 99% riêng dung lượng thumbnail so với bản gốc. Ảnh lớn vẫn dùng bản gốc. Backfill chạy lại chỉ nhận diện hai bản đã có, không tạo trùng.
- RED/GREEN: quyền mặc định Supabase, upload tuần tự/mất checkpoint, nhầm 503 thành 404, render lặp khi chưa có ảnh, tải lại document khi chuyển chương. Đã tái hiện thêm queued scroll đóng menu sau mở và sửa bằng kiểm tra vị trí cuộn thực. Các regression browser chạy trên Chromium/WebKit.
- Local: **127 unit / 35 file**, typecheck, production build đạt. Shared TT **27 nhóm** gồm lỗi đăng ký ảnh giả lập, reload/khôi phục, không upload trùng, hash gốc, preview riêng, CAS, đổi VI/EN, publish/withdraw và thu hồi quyền. Novel editor **6 nhóm** VI/EN đạt; phần import/inline-image boundary của verifier được mock, không coi đó là kiểm thử upload file thật toàn bộ định dạng.
- Trên URL production: shared TT **27 nhóm**, Novel editor **6 nhóm**, UI **15 ca** (10 Chromium desktop/mobile, 5 WebKit phone) đạt. Không page error trong shared TT; fixture đã dọn và hash sách Novel không đổi. Các request ảnh bị hủy khi điều hướng là bình thường. Hai runner Playwright lúc đầu va chạm thư mục trace; chạy lại bằng thư mục artifact riêng đều đạt.
- Xem `verification/stability-local.json`, `verification/stability-live.json` và hướng dẫn khôi phục trong `COMIC_PUBLISHING.md`. Bằng chứng quyền RPC được lưu bằng Codex Security artifact manager (`artifacts/validation/rpc-grants-check.json`), không lưu khóa vào repo.

Chưa đo FPS hoặc hiệu chuẩn trực tiếp trên iPhone vật lý. Bản khôi phục trên thiết bị là best effort; xóa dữ liệu trình duyệt hoặc OS đóng ứng dụng trước khi ghi có thể mất thay đổi mới nhất. Những mục phía dưới là lịch sử release trước.

---

# Vuốt nhẹ và chạm mép trên cảm ứng — production 30/10/2026

Production **dpl_HvBSSpkmEhdsmeWCoUUsoZecaofk**, runtime source **35746a3d79d66708368c71889a3be32c4e1121fe**, https://truyen-ky-man-luc.vercel.app đã xác minh READY và khớp hash các file Reader/Guide/BookFlip/verifier/regression. GitHub vẫn private.

- Touch vuốt chậm từ 24px hoặc hất nhanh từ 14px; tỷ lệ ngang 1.35 thay vì 2. Nếp giấy đi 2× quãng kéo. Chuột giữ ngưỡng 64px và tỷ lệ 2 như trước.
- Chạm vùng 48px mép phải/trái của giấy để tiến/lùi. Xử lý cả WebKit cũ chỉ phát click cho tap, chặn click tương thích sau pointerup để tránh lật hai lần. Text selection, links/images và chú thích có ưu tiên. Chạm giữa vùng trống/mép dưới vẫn hiện thanh điều khiển.
- Gộp move bằng một RAF; cùng 80 sự kiện trong một lượt, renderer từ 80 fold đồng bộ xuống 0 đồng bộ / 1 ở frame kế. Bỏ một snapshot/đợt đo thừa lúc bắt đầu kéo; cancel/release/reset/dispose hủy RAF đang chờ. Đây là hợp đồng số lần vẽ, không phải đo FPS thực trên iPhone.
- TDD: ba ca mới đỏ trước sửa (vuốt chậm 30px không đổi, chạm mép không đổi, 80 fold đồng bộ). Sau đó bắt thêm biên cuối sách giữ pending animation; ca đỏ đúng vùng đệm trống, sửa bằng đường turnPage có kiểm tra biên. Bốn ca mới đều đạt. Fixture chạm chữ cũ dùng giữa dòng để không đụng vùng mép mới.
- Build/TypeScript và 95 unit đạt. Local trước delta biên: 62 ca chọn lọc, 50 đạt / 12 skip / 0 fail, flaky; sau delta chỉ rerun đủ 4 ca comfort trên bản dựng cuối, 4/4 đạt. Không gọi đó là full 214 ca.
- Trên runtime cuối: **64 ca Chromium, 51 đạt / 13 skip theo thiết bị / 0 fail, flaky**. WebKit 18.0 và 27.2 mỗi bản đạt 4 ca VI/EN phone/desktop; phone kiểm tra vuốt chậm 30px/nhanh 16px rồi chạm mép qua lại, thao tác nhỏ/dọc/hủy không lật; vẫn tới đúng chữ cuối và ranh giới chương.
- Bốn tổ hợp phone VI/EN × hai WebKit có nếp lật khi giữ 30px, thả tới trang 2, chạm trái về 1/phải tới 2, chữ gốc không đổi và không page error. Đã xem ảnh held/released. Xem verification/touch-*.json.
- Không sửa nội dung, schema, tài khoản/quyền, file nguồn hay offset dữ liệu đọc. Không thêm dependency. Bản source ZIP được cập nhật sau bằng chứng này.

Chưa trực tiếp hiệu chuẩn cảm giác vuốt/FPS trên iPhone vật lý. Tải lại trang để nhận bản mới; nếu dùng ngoại tuyến, chọn Cập nhật bản tải. Các mục dưới là lịch sử release trước.

---

# Sửa chia trang iOS — production 30/10/2026

Deployment **dpl_AXqrTzKeVX43dk98QwjxyVvAA9X3**, runtime source **5b08129e125350b771a62bdf4e9a1f3d2d5f137f**, https://truyen-ky-man-luc.vercel.app đã xác minh READY và khớp source các file CSS/Reader/BookFlip/verifier/package. GitHub tiếp tục private.

- Đã xem video 51.83 giây và ảnh người dùng. WebKit 18 tái hiện đúng: khung 323×451px nhưng nội dung tràn dọc 22.724px, scrollWidth chỉ 323px, bộ đếm 1/1; Next bỏ qua phần còn lại. Regression đỏ trước khi sửa.
- Khai báo column-width cụ thể để WebKit cũ tạo đúng các trang ngang một cột; column-count vẫn quyết định một/hai trang. Không sửa HTML/nội dung sách/offset ghi chú/nghe.
- Verifier chữ cuối còn phát hiện lỗi làm tròn: viewport thực 999.265625px bị đọc thành 999px, tính thừa một lá (29 thay vì 28), tạo trang cuối rỗng. Dùng kích thước thực trong Reader và snapshot lật giấy; regression chữ cuối đỏ trước sửa, xanh sau sửa.
- 95 unit / 25 file đạt; build và TypeScript đạt. Trên source cuối local, **94 ca chọn lọc: 84 đạt / 10 skip / 0 fail, flaky**. Không tuyên bố chạy lại full 206 ca.
- Trên đúng production cuối, **56 ca Chromium: 47 đạt / 9 skip / 0 fail, flaky**. WebKit 18.0 và 27.2 mỗi bản đạt 4 tổ hợp VI/EN × phone/desktop: trang trước/sau, chữ cuối, hai ranh giới chương, resize và Ebook single page.
- Bốn kiểm tra hình ảnh phone VI/EN × hai WebKit đạt: bộ đếm nhiều trang, chuỗi vuốt +,+,-,+ dừng trang 3 trong chương 1, chú thích mở thẻ tại chỗ, không page error. Đã xem ảnh đầu/trang 3 trên WebKit 18; kiểm tra text Range không phát hiện dòng chữ giao biên bị cắt. Xem verification/ios-*.json.
- Không đổi database, schema, file nguồn, quyền thành viên hay bản công khai. Runtime/dependency của ứng dụng không đổi. Playwright cũ và bộ đọc video được cài riêng dưới work/.

Chưa thao tác trực tiếp trên iPhone vật lý hoặc trình duyệt nhúng Zalo/Messenger. Người dùng cần tải lại trang; bản đã tải ngoại tuyến cần Cập nhật bản tải để nhận mã giao diện mới. Các mục dưới đây là lịch sử release trước.

---

# Tiện ích đọc và biên tập — đã phát hành 30/10/2026

Production **dpl_6Re7gMgYSrwJmZZEg2AvNMgmMJQA**, source **85f6ee1717defd260063563cdc9c787fe456d012**, alias https://truyen-ky-man-luc.vercel.app đã xác minh READY, đúng commit. GitHub vẫn PRIVATE. Source ZIP được đóng lại sau bản bằng chứng này.

- 95 unit / 25 file đạt; typecheck và production build đạt. Full local 206 ca trên 54cc5cd: **189 đạt / 17 skip / 0 fail, flaky**. Sau đó chỉ sửa CSS ô chọn chương đối chiếu lên 44px và thêm assertion: dựng lại bản cuối, chạy đủ reader-expansion **5 đạt / 1 skip**. Không gọi full 206 là kiểm tra lại trên source 85f6ee1.
- Trên đúng runtime cuối: **70 ca chọn lọc, 60 đạt / 10 skip theo thiết bị / 0 fail, flaky**; ngoại tuyến thật bằng cách ngắt mạng, VI/EN, phông cá nhân, phát âm/auto-next, vuốt/lật/chuyển chương, chú thích, vị trí/nghe/ghi chú. Xem verification/expansion-live.json.
- Kiểm tra giao diện VI/EN × PC/phone: chữ đối chiếu 20px theo phông reader, các vùng chọn/mở rộng 44px, đúng hai cột/xếp dọc, đóng bảng giữ vị trí giấy, không page error. Xem verification/expansion-ui-live-final.json.
- Hai verifier authenticated trên URL production dùng Supabase thật đều thành công: so sánh/preflight, thay thế nháp/conflict rollback, hiện diện/thu hồi quyền/audit bất biến, private asset không vào offline cache; editor dán/lưu/chuyển/reload ba chương riêng VI và EN. Public book và revision thật không đổi; tất cả fixture đã dọn. Các 409/ERR_ABORTED trong editor là tình huống xung đột/hủy request được kiểm soát.
- Migration 004 đã áp dụng. Không thay nội dung sách hay file nguồn; thêm nhật ký/hiện diện/RPC có RLS. API xuất bản kiểm tra lại chương/ảnh/chú thích; bìa được kiểm tra trước khi xuất bản giới thiệu.
- Nút ba chấm mở đối chiếu, hướng dẫn, nhảy trang, lịch sử và tải ngoại tuyến. Giọng đọc có phát âm riêng và tự nghe chương kế (mặc định tắt); settings có phông riêng. Editor có so sánh/kiểm tra, thay thế và nhật ký. Chi tiết giới hạn và cách dùng ở README.md.
- Giữ bằng chứng hiệu chuẩn: ô chọn chương ban đầu chỉ 22px, assertion mới đỏ trước sửa; lần cloud đầu gặp thêm lỗi thư mục trace do hai test runner cùng output. Bản cuối tách output, đủ 70 ca sạch, không hạ assertion.

Chưa thử Android/iOS vật lý, Safari, FPS thực địa hoặc nghe chất lượng giọng thật bằng tai. Đọc ngoại tuyến cần tải trước; trình duyệt có thể xóa dữ liệu khi thiếu dung lượng. API log Vercel chưa được cấp scope nên không tuyên bố đã quét toàn bộ runtime logs.

---

## Lịch sử checkpoint và release trước

# Tiện ích đọc và biên tập — kiểm tra trước phát hành 30/10/2026

- Source cuối: 95 unit / 25 file đạt, typecheck và production build đạt.
- Full Playwright trên bản dựng cuối: 189 đạt / 17 skip theo thiết bị, 0 fail/flaky trong 206 ca; gồm đối chiếu, nhảy trang/lịch sử, phông riêng, phát âm/auto-next, ngoại tuyến và hồi quy Book/ghi chú/TTS/VI–EN. Xem verification/expansion-local.json.
- Supabase thật: kiểm thử quản trị mở rộng và editor VI/EN đạt, cleanup toàn bộ fixture thành công; public book và revision thật không đổi. Xem verification/expansion-admin-latest.json và verification/editor-switch-latest.json.
- Migration 004 đã được owner chạy thành công và xác minh bảng qua API. Chỉ bổ sung nhật ký/hiện diện/RPC lưu nháp; không sửa nội dung sách.
- Chưa phát hành bundle này ở checkpoint này; xác nhận Vercel/source commit và bằng chứng cloud sẽ bổ sung sau khi deployment READY.

# Bằng chứng kiểm chứng — cập nhật 29/10/2026

## Vuốt nhanh và chú thích cảm ứng — release hiện tại

Production dpl_2Kyz1NC9CXAVoCPCxKBQbPCpXCV4, runtime source 7fb30b6e8a8fa0a8e9f93878a6f6fe1c34f415f0. Alias https://truyen-ky-man-luc.vercel.app đã kiểm tra READY và đúng commit. Hoàn tất tasks/mobile-reading.md. Các phần tiếp theo là lịch sử.

- Reader ghi nhận mỗi touch release hợp lệ ngay, độc lập với việc hiệu ứng còn sống hay đã bị hủy. Các lượt qua ranh giới chương chờ layout và xử lý đúng thứ tự. Hất ngắn dùng vận tốc mẫu di chuyển gần nhất, không tính thời gian dựng renderer. Cancel, vuốt dọc, lựa chọn chữ, ngón thứ hai, explicit navigation, locale/settings, resize/ẩn/freeze/pagehide/Back giữ guard. PC chuột vẫn chốt sau settle hiện có.

- Mặt sau đang gấp trên một trang dùng target leaf thay cho temporary copy của mặt trước (public StPageFlip page API). Không sửa thư viện vendor. CSS cho iframe được cache theo instance font/theme; chỉ một context rỗng được làm ấm, không có vendor RAF chạy rỗi sau lật.

- Mobile chạm chú thích mở card nền theo reader, không thêm hash/history và không cuộn. Card có nút X 44px, cuộn nội bộ, đóng ngoài/Escape/reader scroll/resize/popstate. Primary touch pointerup hoạt động khi browser không phát click; click tương thích không bật/tắt hai lần. Mouse/keyboard click riêng trên thiết bị coarse vẫn được nhận. PC hover/focus và click-to-endnote giữ nguyên; TTS vẫn bỏ số chú thích.

- 82 unit đạt; typecheck và production build đạt. Full local trên code cuối: 194 ca, 178 đạt / 16 skip theo điều kiện thiết bị hoặc môi trường, 0 fail/flaky. Lượt đầu full có 177 đạt / 16 skip / 1 lỗi khi renderer bị reset bởi Reduced Motion; đã chuyển quyền chốt trang hoàn toàn sang Reader và chạy lại đủ 194. Xem verification/mobile-reading-local.json.

- Production chọn 52 ca gồm toàn bộ Mobile reading, Book gestures, Book presentation và footnotes: 43 đạt / 9 skip theo thiết bị / 0 fail/flaky/retry. Không gọi đây là full 194 ca trên cloud. Xem verification/mobile-reading-live.json.

- Ca mới bắt lỗi trước sửa: rapid release còn ở folio 1 trước khi hết 220ms; reverse face có [2,1] thay vì [2,2]; VI/EN tap đi fragment thay vì card. Các ca cuối bao gồm native CDP flick 45px đổi hướng, burst qua chương, cold renderer, Reduced Motion giữa cử chỉ, hủy/dọc/ngón thứ hai, card không click, cuộn nội bộ/đóng ngoài, cùng regression PC/Back/voice/notes/backup/fonts.

- UI local batch và live confirmation cả VI/EN, desktop 1440x900 và phone 390x844: 2 mặt clip thật và 2 shadow; phone front 1, folded reverse 2; một live prose, không lỗi trang, vị trí giấy không đổi. Card live chờ opacity 1 trước ảnh xác nhận; card màu sáng/tối đều đọc được và đóng đúng. Xem verification/mobile-reading-ui-live.json.

- Repo PRIVATE, khóa cấu hình/thư mời loại khỏi Git và ZIP. Không ghi nội dung sách, nháp editor, membership, Storage hay schema. Runtime không đổi sau deploy; commit bàn giao tiếp theo chỉ ghi bằng chứng.

Chưa thử Android/iOS vật lý, Safari hoặc FPS thực địa. Native CDP/viewport/lifecycle DOM và mocked speech không thay cho việc thử máy thật.

## Kéo mép giấy và thanh dưới tự ẩn — release trước

Production dpl_J8tBp1BTDzfd95bbEGt5UaUjCSNy, runtime ded3627c69ce4fddbdb32ba1be9f58b76ca40c46. Alias https://truyen-ky-man-luc.vercel.app đã được kiểm tra READY và đúng commit. Hoàn tất tasks/book-gestures.md. Các phần tiếp theo là lịch sử.

- PC kéo hai mép giấy bằng chuột trái; điện thoại vuốt ngang. Nếp gấp thật theo độ kéo trong khi giữ, không đổi live text/tiến độ trước khi chốt; thả đủ xa lật một lần, kéo ngắn/hủy trả lại. Chuyển qua chương kế bắt đầu trên giấy mới. Giữ các guard chọn chữ, chú thích, ảnh, vuốt dọc, ngón thứ hai, Escape, blur/resize và giảm chuyển động.

- Thanh dưới điện thoại tự ẩn sau 3 giây, giữ nguyên hàng grid. Chạm vùng trống hoặc mép dưới hiện lại; chữ/link/selection không làm bật nhầm. Điều khiển ẩn có inert; bàn phím đưa focus đến nút còn dùng được trên cả màn hình 360px, dùng preventScroll để giấy không dịch. Primary touch pointerup xử lý cả khi browser không phát click sau native swipe.

- 82 unit đạt; typecheck và production build đạt. Full local 182 ca trước sửa focus và touch wake cuối: 172 đạt / 10 skip / 0 fail, flaky. Trên code cuối dựng lại đủ 30 ca Book và gesture: 27 đạt / 3 skip / 0 fail, flaky. Không gọi full 182 là kiểm tra trên dòng code cuối. Xem verification/book-gestures-local.json.

- Trên URL production/code cuối: đủ 30 ca Book và gesture, 27 đạt / 3 skip theo thiết bị / 0 fail, flaky, retry. Ba skip là mouse PC ở project phone và hai ca phone ở project desktop. Lượt 60 ca trước sửa touch wake cuối đạt 57 / 3 skip; lịch sử đã ghi riêng. Xem verification/book-gestures-live.json.

- Kiểm tra hình ảnh VI/EN cả desktop 1440x900 và phone 390x844: 2 mặt clip thật, 2 shadow trong khi giữ; một live prose; không lỗi trang; paper geometry không đổi sau lật hoặc ẩn/hiện; footer đã kết thúc transition và hiện đúng. Desktop paper 1061.27x737; phone 366x508.33 tại x=12, y=186.33. Xem verification/book-gestures-ui-live.json.

- Giữ bằng chứng lỗi đầu: native touch chuyển implicit capture từ đoạn chữ sang desk phát lostpointercapture ở phần tử con; nay chỉ hủy khi chính desk mất capture. Visual audit đầu thấy focus trong footer đang transition làm ancestor scroll 29px, sửa preventScroll. Audit cloud còn thấy touchstart/up nhưng không click sau vuốt chéo, thêm regression pointerup không click và sửa touch wake. Fixture endnote chương 3 theo bản xuất bản Ban Cơ; unit vẫn kiểm tra đầy đủ legacy continuation Sái nữ, không sửa văn sách.

- Repo vẫn PRIVATE; cấu hình bí mật/thư mời loại khỏi Git và source ZIP. Không thay nội dung sách, nháp, role, schema hoặc file gốc. Chỉ báo kết thúc sau kiểm tra URL và source deployment.

Chưa thử Android/iOS vật lý, FPS thực địa hoặc giọng đọc bằng tai; native CDP touch và viewport Chromium không thay cho thử thiết bị thật.
## Giao diện Sách và lật giấy — release trước

Production dpl_Gfi4cRa3CKc3GpDrqzmo9k6YSKYD, runtime source b6c7d83eb888e55b85e067c706aeaf15997fd792; alias https://truyen-ky-man-luc.vercel.app đã xác nhận READY, đúng source. Hoàn tất tasks/book-layout.md và yêu cầu lật giấy thật theo mẫu Hanhtrangso. Các mục tiếp theo là lịch sử.

- **82 unit đạt**, typecheck và production build đạt. Bộ local đầy đủ 168 ca: **161 đạt / 7 skip**, 0 fail/flaky. Sau đó có sửa một dòng để đóng drawer Sách khi chọn chương và thêm ca kiểm tra; trên bản dựng cuối chạy đủ **18 ca Sách + 6 navigation: 24/24 đạt**. Không gọi lượt 168 ca trước đó là full 170 ca trên source cuối. Xem verification/book-local.json.

- Trên URL production chọn **106 ca: 104 đạt / 2 skip theo thiết bị**, 0 fail/flaky/retry. Kiểm tra Book, continuity, Reader, footnotes, font chậm/phím tắt, navigation, speech continuity, backup và tiện ích. Sau đó siết assertion thành clipPath bắt đầu bằng polygon (không nhận none): **2/2 desktop/mobile đạt** trên cùng runtime. Đây là tăng độ chặt của test, không sửa sản phẩm. Xem verification/book-live.json.

- Cài đặt có Ebook / Sách ngay trước nhóm chủ đề; Ebook mặc định và giữ mode cuộn/trang cũ. Sách có trang giấy, gáy, số trang, mũi tên cạnh lớn, đầu/cuối chương, drawer mục lục và nút về Ebook. Khổ lá 0.72, lượt hai trang 1.44, tự fit vùng đọc; phone/vùng hẹp dùng một trang. Mục lục không đẩy khổ giấy nhỏ đi và tự đóng khi chọn chương.

- Lật trang thực dùng StPageFlip 2.0.7 MIT tự host 44.058 bytes, có mặt trước/sau, polygon/nếp gấp và bóng, cấu hình 450ms. Chỉ giữ mặt trang trước/sau đang chuyển trong ngữ cảnh srcdoc inert tạm; chữ sống vẫn một Root. Hủy ngữ cảnh sau lật/ẩn/freeze/pagehide/đổi giao diện, không giữ vòng RAF của thư viện ở trạng thái nghỉ. Có mở giấy 180ms và phản hồi mũi tên, mục lục trượt; reduced motion/E-ink tắt chuyển động. Không CDN, không chụp canvas hay dựng tất cả chương.

- Mỗi chương có chuỗi trang riêng, không nối đầu chương mới vào chỗ trống cùng trang cũ. Next qua cuối mở đầu chương sau dù thiết bị đã lưu tiến độ giữa chương đó; Previous ở đầu mở cuối chương trước. Có kiểm tra cả toolbar chương và phím/vuốt. TOC/notes/search/listening giữ hành vi vị trí rõ ràng hiện có. Số trang tính theo chương và đổi theo font/viewport.

- TextContent/UTF-16, revision, chú thích và ghi chú cũ giữ nguyên; tiêu đề in trên lá đầu dùng node rỗng/generated content aria-hidden và heading thật vẫn truy cập được. Sửa giữ neo khi đổi Book/Ebook mà không làm thay đổi continuity của Ebook. Vuốt ngang ngắn ngoài link/ảnh/input mới lật; vùng đang chọn chữ ngay từ pointerdown không bị nhận nhầm. Native TTS bỏ số dẫn, pause/resume/follow vẫn dùng nguồn chữ thật. Backup v1 cũ thiếu layout mặc định Ebook; file có giá trị sai bị từ chối.

- Giữ các bằng chứng đỏ/hiệu chuẩn: build đầu bị EXDEV ở config telemetry Windows và chưa có server, nên lượt focused sớm chỉ connection-refused; tắt telemetry trong tiến trình build khắc phục, không sửa cấu hình hệ thống. Các ca thêm phát hiện drift khi đổi giao diện và vuốt trên selection. Fixture Back ở VI dùng ký tự thực sự nhìn thấy vì EPUB có whitespace đầu; oracle scroll dùng reading-scroll. Bản đầy đủ sau sửa vẫn giữ các assertion continuity cũ.

- Một batch visual local và một lượt xác nhận live, mỗi lượt VI/EN × desktop 1440×900 / phone viewport 390×844, sáng/ngà và tối. Local thấy số footer 8–9px, grid phone rộng hơn viewport và snapshot lệch biên 1px; sửa cùng một đợt, fit khổ giấy thật. Live xác nhận số trang **12px**, lề phone cân, ratio đúng, không tràn/footer hoặc page error; đã xem ảnh đứng và giữa nếp lật, cùng hàng nút Sách trong settings sau transition. Xem verification/book-ui-local.json (trước tinh chỉnh), verification/book-ui-live.json.

- Trên live, trạng thái trang tới một frame sau click: **15 / 18 / 16 / 22 ms** ở bốn mẫu; đây không phải thời gian hoàn thành nếp giấy 450ms hoặc INP thực địa. Đo đổi chương trong Sách: **17 / 27 / 30 / 25 ms, 0 yêu cầu RSC chuyển chương**. Script versioned trả immutable cache; context hoạt ảnh rời DOM sau lật, chỉ một context rỗng làm ấm. Xem verification/book-navigation-live.json.

- Repo vẫn PRIVATE; nguồn/ZIP loại cấu hình bí mật và thư mời. Không ghi sách, nháp, membership, schema hoặc file gốc; PDF vẫn dùng trang/zoom gốc. Source runtime giữ nguyên sau deploy, commit bàn giao sau chỉ ghi bằng chứng và assertion chặt hơn.

Chưa thử điện thoại Android/iOS vật lý, FPS thực địa hoặc giọng đọc bằng tai. Không coi kiểm chứng editor/Auth/Storage có đăng nhập ở mục lịch sử là đã chạy lại đầy đủ. Tham khảo UI [Hanhtrangso](https://hanhtrangso.nxbgd.vn/ebook/read/ngu-van-12-tap-mot-321); giấy lật dùng [StPageFlip](https://github.com/Nodlik/StPageFlip), giữ license trong public/vendor/page-flip.LICENSE. Không sao chép nội dung/ảnh sách giáo khoa.

## Chú thích tương tác và TTS — release trước

Production `dpl_ET7H7yBf4rytqqUG7PPAvfzfMfwk`, runtime source `ca91469fb334bb0fea821050648481dca51829c3`; alias https://truyen-ky-man-luc.vercel.app đã xác nhận READY, đúng source. Đã hoàn tất yêu cầu `tasks/footnotes.md` và giữ hai sửa lỗi font/phím tắt của release trước. Các mục dưới đây là lịch sử.

- **80 unit đạt**, typecheck và production build đạt. Toàn bộ local **152 ca: 145 đạt / 7 skip**, 0 fail/flaky ở bản cuối. Trên URL production chọn **88 ca liên quan: 86 đạt / 2 skip theo thiết bị**, 0 fail/flaky/retry. Hai skip là vùng bấm phone ở project desktop và hover tooltip ở project mobile. Không gọi 88 ca là full suite trên cloud. Xem `verification/footnote-local.json`, `verification/footnote-live.json`.
- Giữ bằng chứng lượt đầu local: 143 đạt / 7 skip / 2 lỗi fixture tạo Range offset 35 trong nút chữ đầu chỉ còn 27 ký tự sau thêm link. Fixture nay chọn đúng nguyên khoảng 2..35 qua các text node và giữ mọi assertion nhập/giữ/đóng ghi chú; không nới assertion. Có thêm regression đỏ cho heading DOCX bị gộp, nhãn VI14 mất và tooltip phải đóng khi lật trang bằng mũi tên. Bản runtime cuối và fixture cuối được chạy lại đủ 152 ca.
- Số dẫn hợp lệ hiện thành số nhỏ màu xanh phía trên dòng, không có ngoặc nhìn thấy; link xanh sáng hơn trên nền tối. Hover/focus mở preview văn bản thuần theo nền reader, có aria-describedby; chuột vào card vẫn đọc/scroll được. Escape, blur, scroll ngoài card và mũi tên lật trang đóng preview. Click/tap dùng fragment/history/focus hiện có, đến đúng note cuối chương và Back về đoạn trước. Các ca mới kiểm tra VI/EN, scroll/single, touch viewport và TTS; QA live bổ sung double-page thật trên desktop cả hai locale.
- Survey chỉ đọc **41 edition đã xuất bản**, tìm **776 số dẫn** trong 40 edition có marker; toàn bộ textContent và độ dài UTF-16 giữ nguyên. CSS giấu ngoặc, TTS thay riêng ký hiệu dẫn bằng khoảng trắng cùng độ dài; pause/resume/boundary, ghi chú, tìm kiếm và nghe tiếp giữ offset gốc. Năm như (1330), số không có note và note trùng số không được tự liên kết. Xem `verification/footnote-source-survey.json`. Nội dung note cuối chương vẫn có thể được đọc khi nghe cả chương.
- Hỗ trợ note cuối dạng (1), 1), paragraph/list, note nhiều đoạn và liên kết superscript có sẵn. Nhãn mất đã xác định ở VI3 (note 7 có hai đoạn) và VI14 (31–43) được phục hồi riêng ở lớp hiển thị; không cập nhật sách/revision. **Chương 2 EN nguồn có endnotes nhưng không có số dẫn trong thân bài**: giữ nguyên, không đoán từ để chèn. Khi editor nhập thêm (n) với mục (n) dưới Chú thích/Notes, Reader tự nhận diện sau xuất bản.
- QA local/live mỗi batch 4 tổ hợp VI/EN × desktop 1440×900 / viewport 390×844, VI giấy ngà và EN tối, không page error hoặc preview tràn màn hình. Ảnh local được chụp trước khi chờ fade tooltip xong nên không dùng làm mẫu opacity cuối. Lượt xác nhận live chờ **opacity=1**, kiểm tra card dài thực sự cuộn và vẫn mở, kiểm tra target double-page/scrollLeft=0; đã xem ảnh VI phone và EN desktop sau ổn định. Mẫu scroll đầu tiên ở VI1 chỉ cao 259px và không tràn nên không thể cuộn; đã hiệu chuẩn trong `verification/footnote-qa-calibration.json` và dùng note dài ở chương 14 để xác nhận scroll thực. Xem `verification/footnote-qa-local.json`, `verification/footnote-qa-live.json`.
- Chuyển chương live: **19 / 14 / 14 / 15 ms, 0 request chuyển chương** ở bốn mẫu lab, không là INP người dùng thực. Repo vẫn PRIVATE; scanner loại khóa/thư mời khỏi nguồn. Không đổi dependencies, schema, API quyền, file nguồn, PDF hoặc dữ liệu sách. Runtime không đổi sau deploy; commit bằng chứng bàn giao được ghi riêng.

Chưa kiểm tra điện thoại vật lý, giọng đọc bằng tai hoặc browser chrome shortcut thật; các giới hạn Web Speech/lifecycle từ release trước vẫn áp dụng. Editor/Auth/Storage/PDF có đăng nhập không được coi là đã chạy lại đầy đủ lần này. Mẫu tham khảo hành vi là [Wikipedia Arsenal F.C.](https://vi.wikipedia.org/wiki/Arsenal_F.C.); không sao chép nội dung hoặc mã trang đó.

## Phông đến muộn và phím trình duyệt — release trước

Production `dpl_GEVrVw9Mu3mSosAcUFuAVYcZuBsP`, runtime source `69da38635e3a67d8a1ab9e69d2f07e7061637ff6`; alias https://truyen-ky-man-luc.vercel.app đã xác nhận READY và đúng source. Hai mục được duyệt trong `tasks/font-and-keyboard.md` đã hoàn tất. Các mục dưới đây là lịch sử release trước.

- **73 unit đạt**, typecheck và production build đạt. Toàn bộ local **142 ca: 135 đạt / 7 skip theo điều kiện**, 0 fail/flaky. Trên Vercel chọn **84 ca liên quan: 83 đạt / 1 skip hover tooltip trên mobile**, 0 fail/flaky/retry. Phạm vi gồm font/keyboard, continuity, navigation, reader, speech continuity, device backup và auto-scroll; không gọi đây là full suite trên cloud. Xem `verification/font-key-local.json`, `verification/font-key-live.json`.
- Layout fallback được đo ngay, không đợi fonts.load/fonts.ready và không đặt timeout tùy ý. Khi phông ổn định, reflow lấy neo văn bản mới nhất. Neo được giữ riêng qua lần reveal/reflow; thao tác lật trang được chụp trước paint và cuộn được theo dõi khi font đang tải. Kiểm thử còn giữ nguyên vị trí sau reload, font lỗi, chuyển chương khi callback phông cũ chưa hoàn tất, mode/font reflow và mở ghi chú liên chương.
- QA local và live mỗi batch **VI/EN × desktop 1440×900 / viewport 390×664**. Giữ 1–3 request WOFF2; Reader vẫn ready=true khi fonts.status=loading, lật tiếp 5 trang rồi thả font: **cả 4 neo mới nhất vẫn nhìn thấy**. Chấp nhận tổng/số trang đổi theo typography, kiểm tra Range UTF-16 thay vì so số trang cứng. Không page error. Xem `verification/font-key-qa-local.json`, `verification/font-key-qa-live.json`; đã xem ảnh VI phone và EN desktop sau tải font trong cả hai batch.
- Alt/Ctrl/Meta/Shift/IME không đổi trang hoặc bị preventDefault; mũi tên đơn vẫn lật trang/dừng auto, input/dialog giữ hành vi hiện có. **Hiệu chuẩn:** trên trang data URL không có app handler, headless Chrome cũng không kích hoạt Alt+Back/Forward của browser chrome. Do đó kiểm thử riêng hợp đồng event không bị chặn và page.goBack/goForward đồng bộ URL/chương; không tự bắt Alt để điều hướng thay browser, không tuyên bố đã thử native browser accelerator. Xem `verification/keyboard-calibration.json` và ghi chú đính chính trong OPTIMIZATION_REVIEW_7.md.
- Chuyển chương production: **19 / 14 / 16 / 15 ms, 0 request chuyển chương** ở bốn mẫu lab; xem `verification/font-key-navigation-live.json`. Đây không phải số INP người dùng thực. Chỉ Reader, tests và tài liệu đổi; không sửa dữ liệu sách, draft, quyền, schema hoặc dependency. Repo xác nhận PRIVATE, nguồn kiểm tra không có khóa/thư mời. Runtime giữ nguyên sau deployment; commit bàn giao sau chỉ cập nhật bằng chứng.

Chưa kiểm tra điện thoại Android/iOS vật lý, browser chrome shortcut thật, freeze/resume của OS hoặc âm thanh bằng tai. Các bài speech/lifecycle dùng mock có giới hạn; kiểm chứng editor/Auth/Storage/PDF thật ở mục lịch sử không được coi là đã chạy lại đầy đủ lần này.

## Tự cuộn an toàn và nhãn tốc độ — release trước

Production `dpl_GR76YBjbPNzbftqbmtsaawbVhbbJ`, runtime source `c10b63d78f3a03fc7f97489ecea6aaae912ad102`; alias https://truyen-ky-man-luc.vercel.app đã xác nhận READY và đúng source. Đã triển khai phạm vi `tasks/auto-scroll-safety.md`. Các mục bên dưới là lịch sử release trước.

- **73 unit đạt**, typecheck và production build đạt. Local chạy đủ **128 ca: 121 đạt / 7 skip theo cấu hình**, không fail/flaky. Nhóm mới chạy riêng **20/20 đạt**. Xem `verification/auto-safety-local.json`. Sau đó chỉ chỉnh fixture chờ phân trang và so chỉ số trang, không sửa runtime.
- Trên production, chọn **66 ca liên quan**: auto-scroll mới, Reader, navigation, backup và speech continuity; không gọi đó là bộ đầy đủ 128 ca trên cloud. Lượt đầu 64 đạt / 1 skip / 1 lỗi fixture lấy tổng trang tạm 1/1 rồi so với 1/63, dù trang hiện tại đều là 1. Fixture được sửa để chờ layout/pagination và so chỉ số trang. Lượt tập trung mới: 19/20 đạt, một ca chờ layout quá 5 giây; chạy riêng lại nguyên ca đó đạt 1/1. Tổng **65 ca riêng biệt xác minh**, đủ **20 ca auto-scroll với fixture cuối**. Giữ cả ba kết quả trong `verification/auto-safety-live.json`; không gọi các lượt đầu sạch lỗi, không bật test retry để che kết quả.
- Auto dừng khi nhận hidden/freeze/pagehide, hủy RAF và reset travel/timestamp; không tự chạy lại khi resume. Khoảng RAF lớn hơn 250ms cũng dừng thay vì chạy bù. Kiểm tra scroll/paged, VI/EN, desktop/mobile viewport; kiểm tra explicit restart và tiến độ không trôi. Flush tiến độ đọc/nghe thêm ở freeze.
- Wheel dọc, touch movement, pointer interaction trong vùng truyện và lật trang bằng phím dừng auto. Thay tốc độ trong panel vẫn giữ auto chạy; programmatic scroll không bị nhầm là thao tác tay. Thanh tốc độ dùng label/for với useId, output tách khỏi label; accessible name đúng VI/EN, click label focus đúng input, ArrowRight đổi giá trị và phím lật trang vẫn hoạt động.
- **Đính chính lifecycle:** CDP frozen trên page headless visible không đóng băng thật: probe ghi nhận 72 RAF/1,2 giây, không có freeze/resume event. Vì vậy số 232px của audit cũ chỉ là cuộn qua thời gian, không là bước nhảy sau khôi phục. Đã lưu `verification/auto-lifecycle-calibration.json`, đính chính OPTIMIZATION_REVIEW_6.md và thay fixture bằng DOM lifecycle boundary + timestamp RAF độc lập. Không dùng bộ CDP fixture sai làm bằng chứng native freeze đã sửa.
- QA local và live có giới hạn, mỗi batch 4 tổ hợp VI/EN × desktop/mobile. Sau timestamp RAF tăng giả lập 2.200ms: **delta 0px**; sau mock freeze và 350ms: **0px**; sau wheel/touch và 350ms: **0px**. Native label đúng một liên kết và click focus được, không page error. Đây là số đo mô phỏng, không so trực tiếp với CDP 232px sai trước đó. Xem `verification/auto-safety-qa-local.json`, `verification/auto-safety-qa-live.json`; đã xem ảnh VI phone và EN desktop trong cả hai batch.
- Chuyển chương production đo 4 lần: **18 / 14 / 16 / 15 ms, 0 request chuyển chương**, xem `verification/auto-safety-navigation-live.json`. Chỉ Reader và tests/docs thay đổi; không sửa sách thật, schema, server permissions hoặc tạo tài khoản/nháp QA. Repo vẫn PRIVATE; source scanner loại khóa cấu hình/thư mời. Runtime không đổi sau deployment; các commit bàn giao sau đó chỉ sửa tests và bằng chứng.

Chưa kiểm tra thiết bị Android/iOS vật lý, freeze/resume thực của OS/browser hoặc âm thanh bằng tai. Không cam kết trình duyệt phát âm thanh nền liên tục. Kiểm chứng editor/Auth/Storage/PDF trong các mục lịch sử không được coi là đã chạy lại ở release này.

## Độ mượt tìm kiếm và lớp công cụ — release trước

Production `dpl_3QKCyPvofZHDpMRbtkPwga2K1Saj`, runtime source `d93f93bfb5f4ea629d0e67c29cc884280aaef35f`; alias https://truyen-ky-man-luc.vercel.app xác nhận READY, đúng commit. Cả ba mục trong `tasks/search-smoothness.md` đã triển khai. Các mục tiếp theo là lịch sử release trước.

- **73 unit đạt**, typecheck và production build đạt (2 worker local). Bộ 108 ca local: **101 đạt / 7 skip, 0 lỗi/flaky**, xem `verification/search-fix-local.json`. Lượt đầy đủ trên production: **102 đạt / 5 skip / 1 lỗi** `page.goto net::ERR_CONNECTION_RESET` trước khi ca ambient desktop nạp app. Chạy riêng lại nguyên ca desktop đó, cùng assertion và không bật retry: **1 đạt**. Tổng **103 ca riêng biệt được xác minh**; không gọi lượt đầu sạch lỗi. Giữ cả hai báo cáo trong `verification/search-fix-live.json`.
- Mục lục nổi và panel loại trừ nhau ở breakpoint CSS <=900px, cả hai chiều; >900px giữ sidebar cạnh panel. Kiểm thử VI/EN desktop/mobile, bốn panel voice/settings/auto-scroll/ambient, resize 901→900, giữ phiên TTS đang chạy. Regression mới còn bắt focus bị panel cleanup kéo về nút cũ; cleanup chỉ phục hồi khi focus vẫn ở panel/body, không giành focus khi người dùng đã chọn control khác.
- Chỉ mục chuẩn bị theo từng chương, nhường main thread và có loading/error/retry. Giữ index trong vòng đời Book/locale snapshot, dùng lại khi đổi tab/chương; hủy build cũ khi snapshot/locale thay đổi hoặc unmount. Test xác nhận parse chưa hoàn tất ở frame đầu và parse count không tăng khi quay lại tab, lỗi chuẩn bị được thử lại mà không rời Reader, abort không tiêu thụ snapshot cũ. Unit đối chiếu map UTF-16/khác dấu và giới hạn 100 kết quả giữ nguyên.
- Đổi/xóa query chỉ xóa registry key `search-result`, không xóa highlight ghi chú. VI/EN desktop/mobile đều kiểm tra có highlight trước đổi query, 0 kết quả sau đổi, search-result bị bỏ và note-keep còn nguyên. Các ca tìm liên chương/paged, nghe tiếp, ghi chú, backup và điều hướng cũ nằm trong bộ đầy đủ.
- Hai batch visual/benchmark có giới hạn: local và xác nhận live, mỗi batch VI/EN × desktop/mobile CPU chậm 4×. Tất cả không tràn controls hoặc page error; trên phone panel không che input mục lục, desktop vẫn mở cả hai. Đã xem ảnh VI phone và EN desktop ở hai batch. Xem `verification/search-fix-bench-local.json`, `verification/search-fix-bench-live.json`.
- Benchmark live mobile CPU4×: từ click tới hai frame tiếp theo **25 ms VI / 20 ms EN**, so với mẫu audit cũ 321/301 ms. Quay lại tab **29/28 ms**, parse count giữ 21/20 chương, thay vì làm lại. Không có long task được quan sát trong bước chuẩn bị. **Tổng thời gian chuẩn bị lần đầu là 764/669 ms**, dài hơn cách tính đồng bộ trước đó, đổi lại giao diện nhận thao tác và hiển thị đang chuẩn bị; không gọi 20–25 ms là thời gian có đủ kết quả. Các số là mẫu lab khác lượt đo, không phải INP/Core Web Vitals người dùng thật.
- Chuyển chương live: **16 / 16 / 14 / 14 ms, 0 request chuyển chương**, xem `verification/search-fix-navigation-live.json`. Không thêm dependency, service, server cache, migration hoặc ghi nội dung sách. Không tạo tài khoản/nháp QA trong release này; API editor và dữ liệu xuất bản không đổi. Repo vẫn PRIVATE, cấu hình bí mật/thư mời bị loại khỏi source.

Giới hạn: nhường tác vụ theo chương phù hợp sách ngắn hiện tại; nếu một chương rất lớn tạo long task thì cần chia nhỏ hơn. Chưa thử Android/iOS vật lý hoặc chất lượng/nhịp giọng bằng tai. Kiểm chứng editor/Auth/Storage/PDF thật ở các mục lịch sử không được tính là đã chạy lại trong đợt này.

## Chỗ nghe, tìm nội dung và preview thiết bị — release trước

Production `dpl_6VxqBvENmJkCCLKvsYcYZoo7YpxM`, runtime source `422d36cd8a1a3a0316bc750ddb8e73383e942989`. Alias https://truyen-ky-man-luc.vercel.app đã xác nhận READY và đúng source. Đã triển khai cả 6 mục người dùng chọn trong `tasks/reader-convenience.md`. Các mục bên dưới là lịch sử của các release trước.

- **71 unit đạt**, typecheck và production build đạt. Bộ 92 ca local: **86 đạt / 6 skip**; sau sửa CSS sidebar tiếng Anh và guard tooltip/dialog, chạy lại các ca liên quan trên bản dựng cuối: **17 đạt / 1 skip**. Xem `verification/convenience-local.json`. Bộ đầy đủ trên production cuối: **88 đạt / 4 skip, 0 fail/flaky/retry**. Bốn skip theo cấu hình: vùng bấm phone trong desktop, geometry sidebar desktop trong mobile, tooltip hover mobile ở hai file kiểm thử. Xem `verification/convenience-live.json`.
- Chỗ nghe lưu trong preferences IndexedDB theo VI/EN, tách khỏi progress đọc, có chapter/revision/offset/completion; không nâng schema DB hoặc dùng server lưu dữ liệu khách. Kiểm thử reload, đổi chương rồi chủ động Nghe tiếp, từ chối revision cũ, không autoplay, ngôn ngữ còn lại không bị ghi đè. Ghi boundary được gộp theo giây và flush khi dừng/rời trang. Backup v1 thêm trường listening tùy chọn; file cũ vẫn nhập, file sai bị từ chối; export và restore sang browser context mới giữ đúng chỗ nghe.
- Tìm nội dung local theo locale chỉ lập chỉ mục published text, gõ không dấu/khác hoa thường vẫn trả offset UTF-16 gốc, tối đa 100 kết quả. Kiểm thử mở chương khác; kiểm tra bổ sung trên web thật xác nhận đúng Range tô sáng ở trang giữa chương trong chế độ trang đơn, native scrollLeft vẫn 0. Cùng lượt bổ sung, mô phỏng hoàn tất 129 chunk/chương trên cả desktop/mobile, checkpoint completed=true và nút Nghe tiếp được ẩn. Xem `verification/convenience-extra-live.json`.
- PDF trong Reader thật với fixture local: lưu page/offset, chuyển trang và reload rồi Nghe tiếp trở về đúng trang đã nghe; desktop/mobile đều đạt. Test chờ transaction lưu tiến độ xong trước reload. Đây không phải PDF đã xuất bản trên web; speech dùng mock native. Xem `verification/convenience-pdf-local.json`. Đọc riêng selection PDF không ghi đè checkpoint của lượt đọc trang do hệ tọa độ khác; tài liệu/UI tìm kiếm ghi rõ không tìm PDF nguyên trang.
- Mục lục đưa chapter 20 vào vùng nhìn thấy, không tự reset khi đang tìm. Escape từ input tìm chương/ghi chú đóng đúng UI, IME không bị chặn và phím mũi tên input không lật trang. Tooltip cập nhật khi data-tooltip của anchor đổi, gồm trạng thái đọc/tạm dừng.
- Preview editor 390px/780px dùng .prose và HTML sanitizer hiện có. Kiểm thử bằng editor tạm trên local và production thật: VI/EN × ba chương nháp, dán nội dung riêng, đổi preview, về trực quan, lưu, chọn lại/reload, đọc database xác nhận đúng từng chương/locale. Lượt live kiểm tra thêm viewport phone, không tràn trang. Tất cả edition/version/chapter/membership/Auth user thử đã xóa thành công; không xuất bản nháp thử hoặc sửa sách thật. Xem `verification/convenience-editor-local.json`, `verification/convenience-editor-live.json`.
- Visual batch local phát hiện overflow tab EN desktop; đã sửa hàng nút và nền kết quả tìm. Lượt xác nhận cuối trên Vercel: 4 tổ hợp VI/EN × desktop/mobile đều fit, hiện Nghe tiếp và không page error; đã xem ảnh EN desktop search, VI mobile listen và VI mobile editor preview. Xem `verification/convenience-qa-live.json`; file local giữ kết quả trước sửa, không gọi lượt đó sạch lỗi.
- Đo 4 lần chuyển chương sau release: **15–18 ms / 0 request chuyển chương**, là mẫu Chromium không phải cam kết mọi máy. Xem `verification/convenience-navigation-live.json`. Detector CSS có hai cảnh báo font Consolas đã tồn tại ở HEAD trước sửa và các advisory, không tự thay design context để che cảnh báo.

Repository vẫn PRIVATE; khóa cấu hình/thư mời không có trong source kiểm tra. Không thêm dependency, dịch vụ tìm kiếm, migration hoặc cơ chế đồng bộ tài khoản người đọc. Chưa thử Android/iOS vật lý, âm thanh bằng tai hay nghe khi khóa màn hình; Web Speech và timer/lifecycle vẫn tùy browser/OS. Preview dùng typography mặc định, không mô phỏng mọi cài đặt riêng của khách.

## Độ ổn định trình đọc — release trước

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


## Shared TT release — 30/10/2026

Runtime source e29c7691ad11522f669e310cc640ca767037fd61; production dpl_9LV32XhmqEQRoVedKjedWHLrfpq2 is READY and assigned to https://truyen-ky-man-luc.vercel.app. GitHub source remains private. Migration 005 was tested in PGlite, applied by the owner and verified by public RPC before release. Existing VI/EN records were not edited.

Local: 109 unit/integration tests in 29 files, typecheck and optimized build passed. Live: 17 shared TT check groups passed on Chromium desktop and WebKit phone, plus 20 selected text/footnote/mobile-reader cases (6 device-inapplicable skips, zero unexpected/flaky). Temporary editors, chapter/asset/audit fixtures were removed; published text hash unchanged; zero browser page errors. Five live routes returned 200. Both original generated sample PNGs matched SHA256 and byte count on the deployed URL. Evidence is in verification/comic-{local-release,shared-local,shared-live,text-live,http-live}.json.

The shared test follows real sign-in, direct private Storage uploads, server image decoding/hash registration, natural ordering/reorder, private draft preview, concurrent save rejection, public publication and reload with a forged device draft, VI/EN interfaces, tab-return UI/auto-scroll stopping, invalid image/metadata rejection, immutable object overwrite/delete denial, editor permission-management denial, withdrawal and revoked-member API/RPC/RLS denial. Public readers never substitute local drafts.

Calibration and fixes: local API testing uses canonical localhost to preserve the existing origin check. The login helper waits for a form or editor before choosing its path, avoiding a WebKit session-hydration test race. Native Image preloading replaces fetch across private Storage redirects, removing WebKit CORS page errors. The live preface contained a first footnote sharing its heading paragraph; decoration now recognizes it while retaining source text/annotation offsets, backed by VI/EN unit checks and live footnote cases. Phone sign-in inputs are 16px.

The approved Comix/warm-editor visual world was preserved in a batched desktop/phone VI/EN check and one confirmation. Shared publish/withdraw controls use existing colors and wrap on phones. No new detector or polish loop. No physical iPhone, native speech quality or new CI integration was checked/added. Sample pages are optional editor input; owner/editor must explicitly save and publish their intended comic content. Existing signed URLs can outlive withdrawal for at most 60 seconds.


## VI/EN edition menus and split comic languages — 30/10/2026

Production dpl_Gsd8HnQHDARi4y9u8aoSqbuGZXj2 serves runtime source293c15a27aacc6cafb2f1655b8e7730d88df233f. Exactly two VI/EN triggers expose Novel+TT or Novel+Comic through hover/tap. Keyboard, Escape, outside dismissal and same-chapter single-surface navigation pass on Chromium desktop/phone and WebKit phone. Comic editor names its locale, guards unsaved switching and stores revisions, drafts, pages and publication per language. Migration006 was tested upgrading existing snapshots to VI without populating EN, then applied by the owner. Legacy RPCs are VI-only compatibility wrappers; new API writes require an explicit locale.

111 unit/integration tests, typecheck and optimized build passed. Local regression:40 passed/10 device-inapplicable skips. The final callback/scroll delta passed Chromium shared checks plus menu cases on all three profiles; earlier full VI/EN shared flow passed both engines. Final live verification passed all19 shared groups on both engines and three menu cases, with no browser page errors, fixtures removed and the published Novel book hash unchanged. See verification/edition-{local,live,ui-confirmed}.json and comic-shared-live.json.

Native top-layer popovers inherit the current reader palette. Batched public-screen captures cover twelve locale/device/surface combinations, with one settled confirmation after110ms entry animation; menus stay opaque and within viewport. Editor captures show distinct VI/EN titles/pages/revisions. No new art, dependency or detector/polish loop.

A live keyboard check exposed broad scroll-dismiss handling during restoration; dismissal now responds to scrolling ancestors that move the trigger, not sibling reading areas. Opening a comic menu stops auto-scroll. Outside-dismiss tests click actual blank reading space rather than a heading covered by the menu. One local image-registration request returned503; the next scoped flow passed and all final live operations passed. Physical iPhone remains untested.
