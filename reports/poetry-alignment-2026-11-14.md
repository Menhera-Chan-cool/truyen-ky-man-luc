# Poetry alignment — 2026-11-14

Đã phát hành production và kiểm chứng trên web. Recipe `labse-poetry-mbert-3`, giữ LaBSE/mBERT gốc đã pin. Không dùng model fine-tune bị từ chối, không gọi LLM/Vilao khi tra.

## Thay đổi

- Nhận diện bài/khổ/dòng từ HTML gốc: thơ hai dòng, đoạn trắng, br, các span nghiêng liền nhau, tiêu đề thường/đậm/đánh số, nhãn Nghĩa là và thơ bị gộp cả đoạn. Không thêm ký tự hoặc đổi Reader UTF16.
- Ghép toàn bài trước; chọn một bản diễn nghĩa nhất quán. Tiêu đề mâu thuẫn chặn ghép nhầm Mưa/Trăng hoặc Ngủ/Cờ. Bài không đủ bằng chứng không được mượn văn xuôi.
- So sánh cả câu gốc và câu có chú thích, giữ bằng chứng rõ hơn; chú thích dài không được làm mất đối ứng câu ngắn. Các cửa sổ1–3 dòng dùng chuỗi thật thay vì lấy trung bình các dòng rời.
- Tra cả dòng dùng cặp dòng đã xác nhận, không bỏ phiếu từ thô. Tra một phần dòng chỉ dùng phạm vi dòng tương ứng; thiếu ánh xạ thì trả ngữ cảnh, không kéo từ ở dòng bên cạnh.
- Trích dẫn thơ trong văn xuôi chỉ dùng lại cửa sổ có quan hệ với bài đã xác nhận. Bản dịch4↔8 dòng có thể trả ngữ cảnh cho một nửa câu; không tự tạo phần dịch chưa xuất hiện trong sách.
- Bỏ dòng ghi người dịch khỏi phạm vi thơ; nội dung ghi công vẫn nguyên trong sách.

## Kết quả kiểm thử có đối chiếu

Đã kiểm kê20 chương/40 bản;12 chương có thơ độc lập,3 có văn biền ngẫu/nhịp điệu,5 không có thơ độc lập quan sát được. Ca đảo chiều dùng lại cùng đoạn nên không phải87 mẫu độc lập ngẫu nhiên.

| Phép đo trên87 yêu cầu đại diện | Số lượng |
| --- | ---: |
| Tìm được ít nhất ngữ cảnh | 86/87 |
| Ngữ cảnh nằm trong một bài/bản được phép | 85/87 |
| Có tô đối ứng, tất cả nằm trong đúng bài | 71/71 |
| Span tô trùng hoàn toàn một đối ứng quan sát đã duyệt | 66/87 |
| Không tìm được đối ứng | 1/87 |
| Lỗi thực thi | 0 |

15 trường hợp trong ảnh: 15/15 ở đúng bài; 9 có span tô trùng đối ứng, 6 chỉ trả ngữ cảnh, không tô như tra chính xác.16 phép thử văn xuôi không bị gắn metadata thơ.

Giới hạn được giữ rõ: bài gặp lại chương2 bị gộp thành đoạn EN không có ranh giới dòng chắc chắn nên ngữ cảnh có thể gồm cả phiên âm/diễn nghĩa; một đoạn bài dài chương5 vẫn chưa tìm được đối ứng. Bài thu có trường hợp chỉ đủ bằng chứng toàn bài, trả context-only. Đây không phải chứng nhận đúng nghĩa từng từ của toàn20 chương.

## Chỉ số toàn sách cùng mẫu số cũ

- Câu/vế có phạm vi lexical ghép: 15475/19551 = 79.15%.
- Từ có liên kết thô: 58.27%; từ phủ đủ ký tự chữ: 48.45%.
- UI trả match trên trọn đơn vị: 4.53%; có ít nhất ngữ cảnh: 90.34%; lỗi=0.

Không tăng các nhãn bằng cách hạ ngưỡng .82/.015 hoặc tự lấp liên kết. Độ phủ lexical có thể giảm khi bỏ những liên kết thơ→văn xuôi sai; ngữ cảnh toàn bài không được cộng thành liên kết từ. Các tỷ lệ này không phải semantic accuracy và không chứng minh >95% mọi từ.

## Kiểm chứng và phát hành

306 Vitest,79 Python, typecheck, production build và51 browser tests trên desktop/Android/WebKit qua. Không có thử điện thoại vật lý.40 version/hash/text xuất bản giữ nguyên.20 artifacts, 9,505,089 byte; 86 cặp metadata bài, 280 ánh xạ dòng và 25 cặp chỉ có ngữ cảnh.

`reports/poetry-alignment-2026-11-14.json` lưu dự đoán, định nghĩa và checksum; `reports/poetry-coverage-2026-11-14.md` có đủ40 hàng chương/ngôn ngữ. Mô hình/dữ liệu work giữ ngoài Git/browser. Migration mới giữ các run cũ đến khi run mới sẵn sàng. Chỉ phát hành online trong phạm vi này.

## Production đã xác minh

Source `879630a749c16142860856e7bfba32b7d6293a41`, deployment `dpl_FYAKhiSnRf8gUVKzTZx9yFdpvTac`, https://truyen-ky-man-luc.vercel.app.20 file tải qua đường đọc công khai khớp SHA256/kích thước local (9505089 byte).15 yêu cầu từ ảnh ở đúng bài;9 có tô đối ứng và6 chỉ ngữ cảnh.15 browser tests production trên desktop/Android/WebKit qua. Workflow hourly đang active;40 bản nội dung xuất bản không đổi.
