# auto-alignment

Mục tiêu: tự ghép hai bản Novel có sẵn theo ngữ cảnh, câu rồi từ/cụm, không sinh bản dịch. Phụ thuộc: text-anchors. Không yêu cầu editor ghép/duyệt.

- Input: chapterId, hai revision, codec/text hash, text và sentences có map. Output artifact có version, sentence groups nhiều-nhiều, word links và quality signals; mọi span là trích dẫn nguyên văn.
- Thử chương1/18, đo chất lượng/độ phủ và tài nguyên trước khi mở rộng. E5-small ghép câu; mBERT contextual vectors cho word links, có thể đổi nếu POC không đạt. Pin model commit và dùng safetensors, không chạy remote model code.
- Không ép một-đối-một hoặc giả điểm cosine là xác suất. Trường hợp thiếu/thoát nghĩa trả context-only/uncertain. Cặp rời nhau được giữ thành nhiều span, không nối thành câu mới.
- Pipeline ở `scripts/align-novel/`; Python/weights/cache ngoài repo trong work. Dependency runtime tách khỏi Next/Vercel request.
- Tests Python unittest cho merge/skip/path/token↔UTF-16 và artifact validation; test TS cho consumer artifact. Lệnh Python cụ thể ghi trong README của pipeline sau khi tạo.
- Nghiệm thu: span đúng100%, có báo cáo đánh giá giữ lại và ví dụ sai, measured RAM/time; artifact không bị cắt thầm512 token.
- Không tự cấu hình dịch vụ trả phí, sửa nguồn hoặc công bố chất lượng chưa đo.
