# Kiểm chứng lookup vùng chọn hỗn hợp — 2026-11-14

## Bản đã phát hành

- Source commit: `62124730aa08b7889963a27b94e23bffc6673929` trên `main`.
- Production: https://truyen-ky-man-luc.vercel.app
- Deployment: `dpl_EeN8yy3RdFCLUM1jqBZZRVUsah5F`, trạng thái `READY`, target `production`; alias production trỏ đúng deployment và commit này.
- URL cố định: https://truyen-ky-man-pypydevgu-anh-tun.vercel.app
- Một agent thực hiện; không thay model, source HTML/text, revision, artifact, từ điển, worker hay database.

## Lỗi và thay đổi

Trước sửa, chọn lời thoại có hai cặp thơ ở chương 1 khiến `poetryLookup()` trả kết quả sớm: chỉ còn hai cặp thơ ở lần xuất hiện đầu, mất lời chất vấn và nhận xét bao quanh.

`src/lib/novel-lookup-selection.ts` hiện điều phối chung trước các bộ xử lý sẵn có:

1. Tách vùng chọn tại ranh giới thơ, tiêu đề, metadata và chú thích; xử lý cả các phần văn xuôi còn lại.
2. Giữ đường xử lý cũ cho vùng chọn nằm trọn trong một bài thơ hoặc tiêu đề thơ.
3. Với đoạn hỗn hợp trong một đoạn văn, chỉ nhận ngữ cảnh cha khi ít nhất hai anchor văn xuôi có thứ tự cùng chỉ về một đoạn đích thắng duy nhất. Đây là bằng chứng ngữ cảnh, không phải xác nhận đúng nghĩa của model.
4. Tìm lại câu thơ trong đoạn đích ấy bằng chuỗi từ trùng duy nhất, đúng thứ tự. So sánh có chuẩn hóa Unicode và bỏ dấu chú thích để tìm kiếm; vị trí trả về luôn là UTF16 của text gốc. Không sửa artifact hay liên kết từ để chuyển vị trí.
5. Kiểm tra phần nguồn chưa được kết quả bao phủ, kể cả các khoảng bị loại bởi `parts`. Trả `unmatchedSource`; nếu còn thiếu thì bỏ tô sáng chính xác và hiển thị thông báo dùng kết quả làm ngữ cảnh.
6. Nếu thiếu liên kết ở các vế nối nhưng có ngữ cảnh cha đủ căn cứ, trả một đoạn đối chiếu liên tục trong ngữ cảnh ấy. Không ghép các kết quả lạc sang đoạn khác vào câu trả lời.

Giữ kiểm tra source quote/revision, giới hạn 2.000 UTF16, 32 phần/kết quả và giới hạn response API hiện có. Các guard thơ không ghép với văn xuôi, không lấy liên kết từ của dòng khác, không ép ánh xạ cho thơ chưa ghép và không tô sáng chính xác rendering `contextOnly` vẫn được giữ trong bộ xử lý cũ.

## Ca ảnh: kiểm tra trước và sau trên production

Request: chương 1, EN revision 2, khoảng UTF16 `[1291,1743)` — từ `"That poem you composed` đến ngay trước `Now, as for`.

| Kết quả | Trước | Sau |
| --- | --- | --- |
| Có lời chất vấn, hai cặp thơ và nhận xét cuối | Không | Có |
| Số passage | 2, chỉ thơ | 1, đoạn lời thoại tương ứng |
| Vị trí đoạn Việt | Lần thơ ở đầu chương | `[1126,1398)`, lần trích trong lời thoại |
| Trạng thái | `uncertain` | `context-only` |
| Phần chưa có liên kết tin cậy | Không được ghi nhận | `True,` và `—are accurate enough.` |

Đoạn Việt sau sửa có cả `kể cũng là đúng`. Hai liên kết model sai không được sửa bằng cách ép ghép: chúng bị loại khỏi kết quả chính xác, và toàn đoạn được trả làm ngữ cảnh, không có highlight.

## Kiểm thử

- Tái hiện trước sửa: sáu ca mới thất bại do mất lời thoại, tiêu đề/chú thích hoặc không ghi nhận nguồn còn thiếu; các ca thơ cũ trong lượt này vẫn qua.
- Sau sửa: **319 Vitest**, **80 Python unittest**, typecheck và production build đều qua.
- 13 test mới gồm hai chiều, lần trích lặp lại, thơ riêng, lời bình, chú thích lệch số, thơ chưa ghép, chọn một phần dòng, nguồn còn thiếu, không sửa artifact, thêm nội dung không liên quan, Unicode NFD và ký tự supplementary.
- Trình duyệt local: **54 ca riêng biệt** trên desktop Chrome, Pixel 7 và iPhone 13 WebKit đã qua. Lượt đầu 51 qua, 3 hết thời gian chờ 5 giây ở server dev; ba ca này chạy lại tuần tự đều qua. Kiểm tra riêng ca mới trên local production build cũng qua.
- Production: **15/15 ca trình duyệt qua**, gồm đoạn hỗn hợp, cặp thơ riêng, lời bình, caption chú thích không có từ đối ứng trực tiếp và tên Hàn Dũ trong chú thích lệch số; chạy cả ba loại thiết bị.
- API production: đoạn hỗn hợp đúng, không highlight thiếu căn cứ, response `no-store`; **20/20** mục artifact `ready` có SHA256 và kích thước trùng các file trước phát hành, recipe vẫn `labse-poetry-mbert-3`.

Đối chiếu cùng bộ dữ liệu 20 chương trước/sau, gồm 87 request thơ và 16 control văn xuôi:

| Chỉ số trên 87 request quan sát | Trước | Sau |
| --- | ---: | ---: |
| Có ngữ cảnh | 87 | 87 |
| Ngữ cảnh nằm trong một rendering được fixture cho phép | 86 | 86 |
| Highlight ra ngoài bài thơ cho phép | 0 | 0 |
| Highlight trùng chính xác khoảng đích quan sát | 67 | 68 |

Đây là kiểm tra hồi quy các khoảng đã quan sát, không phải tỷ lệ dịch đúng nghĩa của toàn bộ sách. Một ca chương 2 đã có ngữ cảnh rộng chứa nhiều rendering từ trước; bản sửa này không giải quyết ca đó.

## Lệnh kiểm tra chính

Chạy trong `D:\codex\2026-10-22\p\outputs\truyen-ky-man-luc`:

```powershell
npm run typecheck
npx vitest run --maxWorkers=2
& 'D:/codex/2026-10-22/p/work/novel-alignment-runtime/Scripts/python.exe' -m unittest discover -s scripts/align-novel -p 'test_*.py'
npm run build

$env:BASE_URL='https://truyen-ky-man-luc.vercel.app'
$env:CONTEXTUAL_PREVIEW='1'
npx playwright test --config playwright.alignment.config.ts --grep 'keeps dialogue around repeated poetry|keeps the complete poetry couplet|shows the full paired note|matches the note by content|matches critique headings' --workers=2
```

Bằng chứng chi tiết tại workspace local `D:\codex\2026-10-22\p\work\mixed-selection-20261114\`: `production-before.json`, `production-after.json`, `local-after.json`, `verify.mts`. Báo cáo 87 ca trước/sau: `D:\codex\2026-10-22\p\work\poetry-audit-20261114\mixed-before-qa.json` và `mixed-after-qa.json`.

## Giới hạn còn lại

Không có hai anchor nhất quán, hoặc câu trích xuất hiện nhiều lần trong cùng đoạn đích, thì không suy đoán vị trí mới. Kết quả có thể vẫn là ngữ cảnh hoặc không tìm thấy. Không rà lại nghĩa từng chữ của 20 chương, không huấn luyện hay nghiên cứu model mới và không thay liên kết model sai bằng fixture kiểm thử.
