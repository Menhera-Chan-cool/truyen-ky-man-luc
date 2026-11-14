# Sửa ghép vế và ghép từ trong văn xuôi

Hoàn tất ngày 2026-11-15, múi giờ Asia/Saigon. Một agent thực hiện; giữ nguyên source text và model.

## Production

- URL: https://truyen-ky-man-luc.vercel.app
- Runtime/worker commit: `cbb06108a43a20e6753601032e85817f2bdeecf1`.
- Deployment `dpl_DdxFD5hcXLAMZqkcemFde51iKN8V`, `READY`, target `production`; alias và commit đã được kiểm tra qua Vercel.
- URL cố định: https://truyen-ky-man-muct437lg-anh-tun.vercel.app
- 20/20 job Supabase đã `ready`. Cả 20 file đã tải qua đường đọc công khai và khớp SHA256/kích thước local, tổng 8.744.874 byte. Workflow hourly vẫn active.

## Lỗi và cách sửa chung

Ca chương 5 có hai lỗi nối tiếp: vế chứa “flowers” bị ghép vào phần Việt kết thúc bằng “diệu tuyệt”; bộ tách từ Việt còn gộp “hoa ý” thành một từ. Một điểm liên kết subword cao không đủ chứng minh đối ứng từ đúng.

1. Worker chấm lại các nhóm văn xuôi yếu hoặc vượt ranh giới đoạn bằng **nguyên text ghép của đoạn**, dùng LaBSE đã pin. Chỉ xét các cặp đoạn đã có căn cứ từ nhóm cũ; yêu cầu điểm hỗ trợ và thắng đối thủ theo cả hai chiều. Phạm vi tối đa 1.024 UTF16 mỗi đoạn, không qua thơ, không sửa note. Các phần không có căn cứ không bị ép ghép.
2. Sau sửa phạm vi, chạy lại mBERT hiện tại cho các nhóm thay đổi. Cache chỉ tái sử dụng liên kết của phạm vi text/offset và recipe khớp; source bindings được đối chiếu trước khi tái sử dụng.
3. Lookup không trả đối ứng **từ** từ nhóm có score dưới `.5` hoặc margin dưới `.015`. Câu đầy đủ vẫn có thể dùng đối ứng nguyên nhóm, với nhãn độ chắc chắn hiện có; không dùng ngoại lệ này để cho một từ lọt qua ngưỡng.
4. Kiểm tra cạnh tranh giữa các từ nguồn khác nhau cùng đòi một từ đích. Không coi việc đọc ngược cùng một cạnh là bằng chứng độc lập.
5. Xem segmentation là gợi ý: chỉ tách một từ ghép khi các từ nguồn khác nhau hỗ trợ đầy đủ những từ viết rời, không chồng nhau. Hỗ trợ vài subword không đủ để tự tách; giữ guard tên riêng và thơ. Áp dụng ở cả phía nguồn và đích để tránh mất một phần khi chọn “hoa ý”.
6. Không tự điền nội dung giữa các highlight rời. Với cụm nhỏ, bỏ fragment chỉ gồm hư từ khi đã có đối ứng nội dung, và giữ nhãn `uncertain` cho các fragment còn rời nhau.

Không có mapping runtime riêng `flowers → hoa`, không đổi threshold để tăng phần trăm đẹp, không sinh bản dịch mới.

## Ca ảnh đã kiểm tra trên API và trình duyệt production

| Vùng chọn | Kết quả hiện tại |
| --- | --- |
| flowers, trong “With words like flowers…” | hoa |
| words like flowers | lời hoa |
| brocade, cùng câu | gấm |
| wonderfully, câu trước | diệu tuyệt |
| hoa, trong “lời hoa ý gấm” | flowers |

Các kết quả vẫn có nhãn `uncertain`; score không phải xác suất dịch đúng. Không còn lấy “diệu tuyệt” làm đáp án cho “flowers”.

## Bảo toàn và kiểm thử

- 40 text/hash/versionId/revision và các paragraph breaks không đổi.
- Metadata `poems`, `poetryScopes`, `notePairs` và các group thơ của bản phát hành trước được giữ lại. Kiểm tra bản dựng mới cho thấy cùng phạm vi/cặp thơ; sai số float nhỏ của lần chạy lại và các scope tiêu đề thừa không được đưa vào bản phát hành này.
- Không thay `models.json`, trọng số, recipe `labse-poetry-mbert-3`, codec, API request limits, RLS, schema hay nội dung xuất bản. Không thêm dependency.
- **328 Vitest, 87 Python unittest**, typecheck và production build đều qua.
- **57/57** ca trình duyệt local qua trong lượt cuối; **18/18** ca production qua. Dùng desktop Chromium, Pixel 7 Chromium và iPhone 13 WebKit mô phỏng, không phải điện thoại vật lý.
- Bộ 87 request thơ và 16 control văn xuôi không hồi quy: 87 có ngữ cảnh, 68 khớp khoảng highlight quan sát, 0 highlight ngoài bài cho phép. Ca ngữ cảnh rộng ở chương 2 có từ trước vẫn còn.
- Có kiểm thử trước/sau cho chặn parent yếu, cạnh tranh trong từ ghép, tách segmentation nhiễu ở cả hai chiều, không mất vế khi sửa ranh giới lời dẫn và từ chối các parent trùng/mơ hồ.

## Số đo phát triển, không phải tỷ lệ dịch đúng toàn sách

Bộ `scripts/align-novel/evaluation.json` có 120 lượt ở chương 1 và 18, gồm cả hai chiều. “Đạt” ở bảng này nghĩa là highlight đạt character-span F1 ≥ 0,5 so với khoảng quan sát, **không phải** đã được người đọc xác nhận đúng nghĩa.

| Loại | Trước | Sau |
| --- | ---: | ---: |
| Từ | 33/40 | 32/40 |
| Cụm | 16/40 | 18/40 |
| Câu | 37/40 | 38/40 |
| Tổng | 86/120 | 88/120 |

Số từ đạt giảm một mẫu ròng do một số liên kết yếu chuyển sang ngữ cảnh; đây là đánh đổi rõ ràng, không báo là mọi loại đều tốt hơn. Không có căn cứ khẳng định >95% cho toàn bộ từ/cụm/câu của 20 chương.

## Tái kiểm chứng

Tại repository `D:\codex\2026-10-22\p\outputs\truyen-ky-man-luc`:

```powershell
npm run typecheck
npx vitest run --maxWorkers=2
& 'D:/codex/2026-10-22/p/work/novel-alignment-runtime/Scripts/python.exe' -m unittest discover -s scripts/align-novel -p 'test_*.py'
npm run build
$env:BASE_URL='https://truyen-ky-man-luc.vercel.app'
$env:CONTEXTUAL_PREVIEW='1'
npx playwright test --config playwright.alignment.config.ts --grep 'separates prose words|keeps dialogue around repeated poetry|keeps the complete poetry couplet|shows the full paired note|matches the note by content|matches critique headings' --workers=2
```

Manifest và kết quả API: `verification/prose-word-2026-11-15.json`. Bằng chứng local chi tiết tại `D:\codex\2026-10-22\p\work\prose-quality-20261114\`: `artifact-check.json`, `production-verification.json`, `poetry-qa-final.json`, `evaluation-before.json`, `evaluation-after.json`, `pipeline.log`, `publish.log`. Các file `.glossary.json` là sidecar, không phải artifact được upload.

Giới hạn: chưa rà nghĩa từng chữ toàn sách, chưa sửa các đoạn dài không đủ anchor, chưa làm lại luồng offline. Các query thiếu căn cứ vẫn trả ngữ cảnh hoặc không tìm thấy, thay vì ép một đáp án từ.
