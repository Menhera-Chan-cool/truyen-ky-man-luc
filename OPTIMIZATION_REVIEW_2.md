# Rà soát trải nghiệm đọc sau đợt tối ưu — 23/10/2026

Phần khảo sát dưới đây ghi nhận trạng thái trước sửa. Sau khi người dùng duyệt toàn bộ, các mục 1–5, PDF, khóa nhập/upload và sao lưu JSON đã được triển khai trong source. Không sửa nội dung sách hiện có. Kết quả release mới nhất nằm trong `VERIFICATION.md` và `DEPLOYMENT.json`.

## Bản sửa theo phạm vi đã duyệt

- Điểm neo văn bản theo locale/revision giữ chỗ khi đổi phông, cỡ, giãn dòng, chiều rộng, chế độ và viewport. Đợi phông tải xong trước khi chốt vị trí; tiến độ cuộn vẫn ghi gộp.
- TTS dùng chung đường điều hướng trang của Reader; đổi tốc độ/giọng tiếp tục đoạn hiện tại, dùng boundary khi thiết bị có hỗ trợ.
- Epoch/token hủy các lệnh phát âm thanh đang chờ sau Dừng hoặc phối sẵn mới.
- Đánh dấu liên chương giữ yêu cầu mở đoạn tới khi chương đích sẵn sàng. Ghi chú khác revision không tự gắn lại.
- PDF lưu trang/zoom, vẽ lại khi đổi kích thước; kiểm tra bằng fixture riêng, không đưa chương QA vào sách công khai.
- Parent editor khóa thao tác trong lúc nhập/upload, giữ preview khi lỗi, cảnh báo bỏ bản nhập chưa lưu và đợi refresh hoàn tất trước khi mở khóa.
- Sao lưu JSON trên thiết bị có xem trước, giới hạn/kiểm tra dữ liệu, gộp ghi chú không mất bản khác nội dung và transaction khôi phục đồng bộ.

Kiểm chứng source: 58 Vitest, typecheck và production build đạt; bộ Playwright cục bộ 59 đạt/5 bỏ qua, không retry. Các kết quả khác mong đợi trong phần khảo sát tiếp theo là bằng chứng lỗi trước sửa, không phải lỗi còn mở hoặc bài test đạt của bản mới.

## Kết luận

Ưu tiên tiếp theo là **giữ đúng chỗ đang đọc/nghe và xử lý các tiện ích chạy cùng nhau**. Bốn điểm dưới đây đã có tình huống tái hiện. Không cần thay lại cơ chế chuyển chương hiện tại: bốn mẫu mới là **7 / 14 / 11 / 12 ms**, tất cả **0 yêu cầu tải chương từ server**.

## 1. Giữ đoạn đang đọc khi thay đổi kiểu hiển thị — ưu tiên cao

Tái hiện trên Chromium desktop 1280×900, chương 1 VI, chế độ trang đơn:

- Đi đến **trang 5/19**, rồi đổi cỡ chữ **20 → 32**.
- Tổng trang tăng thành **45**, nhưng giao diện vẫn giữ **trang 5**.
- Đoạn đầu đang thấy đã đổi sang một đoạn khác. Ứng dụng giữ số trang trong khi vị trí của văn bản trên các trang đã thay đổi.

`Reader.tsx` thay đổi số cột/trang sau reflow, nhưng không lưu điểm neo văn bản trước khi đổi phông/cỡ chữ/chiều rộng. Effect tiến độ tiếp tục lưu theo số trang mới, nên việc chỉ tải lại trang không khôi phục được chỗ cũ.

Đề xuất: ghi lại vị trí văn bản đầu tiên đang nhìn thấy trước khi thay đổi, sau reflow đưa đúng vị trí đó trở lại màn hình rồi tính lại số trang/tiến độ. Giữ chapter ID, locale và revision hiện có; không sửa neo ghi chú. Dữ liệu tiến độ cũ cần vẫn đọc được.

Nghiệm thu: cùng đoạn/điểm neo vẫn nhìn thấy khi đổi phông, cỡ chữ, giãn dòng, chiều rộng, chuyển cuộn/trang đơn/trang đôi và xoay màn hình. Kiểm tra VI/EN và reload sau thay đổi.

Tham khảo [Novel-Hub useReaderPaging](https://github.com/AzenKain/Novel-Hub/blob/28b6972e5b4f749124e4e27200bd76c4b6168d38/web/src/hooks/useReaderPaging.ts): có theo dõi vị trí văn bản nhìn thấy và các hàm khôi phục text offset giữa chế độ cuộn/phân trang. Đây là ý tưởng có thể áp dụng ở quy mô nhỏ hơn của sách này.

## 2. Đồng bộ TTS với phân trang — ưu tiên cao

Dùng giả lập **ranh giới Web Speech API**, còn Reader, DOM và CSS chạy thật trên production:

- Bắt đầu tại **trang 1/19** ở chế độ trang đơn.
- Sau 11 đoạn TTS, `.reading-window.scrollLeft` đã tăng thành **828 px**.
- Số trang vẫn là **1/19**, trong khi nội dung nhìn thấy đã sang cột khác.

Nguyên nhân: `useSpeech.ts` gọi `scrollIntoView()` trực tiếp trên đoạn đang đọc. Reader lại điều hướng phân trang bằng state `page` và transform. Hai cách điều khiển vị trí không đồng bộ với nhau. Điều này cũng làm nút trước/sau và tiến độ không phản ánh đúng trang TTS đang đưa tới.

Đề xuất: khi đọc ở chế độ trang đơn/đôi, chuyển đến trang chứa đoạn qua cùng cơ chế điều hướng của Reader. Chế độ cuộn tiếp tục cuộn tới đoạn. Khi dừng, màn hình và tiến độ cần thống nhất với đoạn vừa đọc.

Nghiệm thu: TTS qua nhiều trang cập nhật đúng số trang; dừng rồi bấm trước/sau không nhảy quá trang; reload mở đúng vị trí; không tự đổi chương hoặc ngôn ngữ.

## 3. Lệnh dừng âm thanh phải hủy được thao tác phát đang chờ — ưu tiên vừa

Tái hiện bằng AudioContext thật, ngắt kết nối đầu ra để không phát âm thanh tại máy; thêm độ trễ **180 ms** tại `resume()` nhằm mô phỏng khởi động âm thanh chậm:

1. Bấm **Brown Cozy**.
2. Bấm **Dừng tất cả** trước khi khởi động xong.
3. Sau khi các thao tác chờ hoàn tất, vẫn xuất hiện **2 nguồn đang chạy**, tương ứng nhiễu nâu và mưa.

`Soundscape.tsx` chờ `ctx.resume()` rồi tạo source. `stopAll()` chỉ dừng những source đã có trong Map, chưa vô hiệu hóa phần khởi động đang chờ và vòng lặp preset.

Đề xuất: hủy hiệu lực các lượt phát đang chờ khi dừng hoặc đổi preset; kiểm tra lại sau mỗi `await`. Dừng/ngắt kết nối source đã tạo nếu tác vụ của nó hết hiệu lực. Không cần thay engine âm thanh để sửa luồng này.

Nghiệm thu: sau lệnh dừng không có source nào khởi động muộn; bấm preset liên tiếp không để lại nguồn âm thanh ngoài danh sách hiển thị; đổi chương/đóng panel tuân theo hành vi đã chọn của ứng dụng.

Đối chiếu [Novel-Hub soundscapeStore](https://github.com/AzenKain/Novel-Hub/blob/28b6972e5b4f749124e4e27200bd76c4b6168d38/web/src/stores/soundscapeStore.ts): trạng thái danh sách track và trạng thái phát được dùng để đồng bộ node, dừng/ngắt kết nối node không còn cần. Không mặc định coi toàn bộ cách triển khai tham khảo là đã miễn lỗi.

## 4. Tiếp tục đúng vị trí nghe khi đổi giọng/tốc độ — cải thiện UX

Sau khi đã qua 6 đoạn, đổi tốc độ sang **1,8×** và chọn giọng B:

- Ứng dụng **chủ động dừng** TTS khi đổi, đúng như code hiện tại.
- Bấm đọc lại dùng đúng tốc độ/giọng mới, nhưng bắt đầu từ **đầu chương**, không phải đoạn vừa nghe.

Đây là khoảng trống UX, không phải lỗi tốc độ/giọng mới không có tác dụng. Người nghe chương dài phải tìm lại chỗ đang nghe mỗi lần điều chỉnh.

Đề xuất: giữ đoạn đang đọc và offset nếu trình duyệt cung cấp; khi đổi cài đặt, tiếp tục từ đoạn hiện tại hoặc cung cấp hành động “Tiếp tục”. Với trình duyệt không có boundary chính xác, có thể đọc lại từ đầu đoạn thay vì đầu chương. Luôn dừng session cũ khi đổi chương/VI↔EN.

Nghiệm thu: đổi giọng/tốc độ khi đang nghe không quay lại đầu chương; không phát hai hàng đợi cùng lúc; lỗi giọng bị thiếu vẫn có thông báo và cách khôi phục.

Tham khảo [Novel-Hub useTTS](https://github.com/AzenKain/Novel-Hub/blob/28b6972e5b4f749124e4e27200bd76c4b6168d38/web/src/hooks/useTTS.ts): giữ tham chiếu tốc độ/giọng mới nhất, chunk index, boundary và phần còn lại cho pause/resume. Chỉ cần lấy các ý tưởng phục vụ VI/EN, không cần port toàn bộ hook.

## Editor và hiệu năng: phần chưa đủ bằng chứng để xếp ưu tiên cao

Đã xem lại [EPUB-Forge EditChapterModal](https://github.com/AzenKain/EPUB-Forge/blob/33120281bfc6faa51d43f5bd45dbbcab882da5d7/src/components/EditChapterModal.tsx) và PreviewPanel. Editor tham khảo giữ DOM trực quan, chuyển thành raw HTML khi đổi chế độ hoặc lưu; thao tác nhập thông thường chủ yếu cập nhật trạng thái căn lề. RichEditor hiện tại gọi `editor.getHTML()` và cập nhật state cha mỗi lần thay đổi. Điều này **có thể** tốn công việc với chương rất dài, nhưng đợt này chưa benchmark đủ lớn để kết luận editor hiện gây giật.

Nếu kiểm tra tiếp editor, nên đo độ trễ gõ/dán và số lần serialize trên chương dài trước; giữ nguyên cơ chế context/revision và chặn yêu cầu cũ đã sửa. Mọi cách gom cập nhật phải chốt đủ nội dung trước lưu, đổi chương hoặc đổi chế độ.

Sinh buffer nhiễu hồng trong ba mẫu CPU chậm 4 lần mất **27,2 / 31,3 / 32,2 ms**. Đây chưa phải bằng chứng đủ mạnh để ưu tiên thêm worker/cache âm thanh; lỗi dừng/phát đang chờ có ảnh hưởng rõ hơn.

## Phạm vi kiểm tra và bằng chứng

- `verification/reader-followup-audit-2026-10-23.json`: 5 phép kiểm tra; các kết quả khác mong đợi ở trên là phát hiện, không được tính là các tính năng đã “pass”.
- `verification/navigation-followup-2026-10-23.json`: bốn phép đo chuyển chương mới trên URL production.
- Script tái hiện: `D:\codex\2026-10-22\p\work\reader-followup-audit.mjs` và `navigation-bench.mjs`.
- Các trình duyệt thử nghiệm dùng context mới; không sử dụng dữ liệu đọc trong trình duyệt của chủ sách, không đăng nhập owner/editor và không ghi lên Supabase.
- TTS được mock tại API để kiểm tra điều hướng/trạng thái; không đánh giá giọng hoặc âm thanh thật. Bài thử audio có độ trễ startup chủ động 180 ms; không khẳng định mọi thiết bị thực tế đều gặp lỗi ở cùng thời gian.
- Chưa kiểm tra thiết bị Android/iOS thật hoặc editor với chương cực dài. Chưa sửa/deploy trong đợt rà soát này.

Remote HEAD đã fetch kiểm tra lại: Novel-Hub `28b6972e5b4f749124e4e27200bd76c4b6168d38`; EPUB-Forge `33120281bfc6faa51d43f5bd45dbbcab882da5d7`. Hai HEAD không đổi so với đợt đối chiếu trước.

## Khảo sát bổ sung: đánh dấu, PDF và nhập file

### 5. Đánh dấu thuộc chương khác cần một lần bấm để tới đúng đoạn — đã tái hiện

Tạo một đánh dấu trong browser context riêng ở gần cuối chương 1, đưa vị trí đọc chương 1 về đầu rồi chuyển sang chương 2. Trong danh sách đánh dấu, bỏ chọn “Chỉ chương đang đọc” và bấm ghi chú đó:

- Lần đầu chuyển về chương 1, tỷ lệ cuộn **0**, đoạn đích không nhìn thấy.
- Bấm lại cùng ghi chú: tỷ lệ cuộn khoảng **0,862**, đoạn đích đã nhìn thấy.

Nguyên nhân trong `Reader.tsx:openNote`: khi khác chương, gọi `go()` rồi `return`; yêu cầu mở điểm neo không được giữ lại để xử lý sau khi chương mới sẵn sàng. Lần thứ hai mới chạy nhánh tìm điểm neo.

Đề xuất: giữ đánh dấu đang yêu cầu mở, sau khi tải/khôi phục chương thì kiểm tra đúng locale và revision rồi tới đoạn. Không tự gắn ghi chú phiên bản cũ vào đoạn mới. Đây là vấn đề có thể sửa cùng nhóm điều hướng theo điểm neo ở mục 1–2.

Bằng chứng: `verification/bookmark-followup-audit-2026-10-23.json`. Script `work/bookmark-followup-audit.mjs` chỉ tạo ghi chú trong browser context riêng, không ghi Supabase hoặc dữ liệu đọc của người dùng.

### Các điểm mới chỉ kiểm tra code — cần tái hiện trước khi sửa

- **PDF nhớ trang/zoom:** `PdfViewer` khởi tạo page=1, zoom=1 và không nhận/trả vị trí trang cho Reader. Reader coi PDF là chế độ cuộn; object tiến độ hiện không lưu riêng trang PDF/zoom. Cần bài thử PDF qua đổi chương/reload và xoay màn hình. Chưa kiểm tra trên một chương PDF đã xuất bản trong sách này.
- **Nhập/upload đang chạy khi đổi tab:** ImportPanel có `busy` riêng, chưa nối vào khóa thao tác của Admin. Callback `onDone` gọi `Admin.load()`, còn `load()` đặt lại dirty/metaDirty. Có khả năng thao tác nhập trả về muộn ảnh hưởng trạng thái sửa mới nếu người dùng đã đổi tab. Cần test với tài khoản QA, upload chậm và callback trễ trước khi kết luận tác động cụ thể; đợt này chưa tạo tài khoản hay dữ liệu server để thử luồng đó.

### Bổ sung tùy chọn

- **Xuất/nhập bản sao dữ liệu đọc cục bộ:** một file JSON cho ghi chú, đánh dấu, tiến độ và cài đặt, có kiểm tra định dạng/phiên bản khi nhập. Hiện dữ liệu này chỉ ở IndexedDB; cách này giúp người đọc chủ động giữ bản sao trước khi đổi thiết bị hoặc xóa dữ liệu trình duyệt. Đây là đề xuất thêm tiện ích, không phải lỗi đã tái hiện và không phải đồng bộ tài khoản hoặc xuất EPUB/PDF.

Thứ tự hợp lý hiện tại: bốn luồng đã tái hiện ở phần đầu và đánh dấu liên chương trước; PDF/import cần kiểm thử thêm; xuất bản sao dữ liệu đọc là tùy chọn. Không coi mọi mục trong danh sách là lỗi đã xác nhận.

