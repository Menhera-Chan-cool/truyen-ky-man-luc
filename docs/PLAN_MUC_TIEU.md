# Kế hoạch đạt các mục tiêu đối ứng VI↔EN

Lập ngày 2026-11-17, sau khi đo lại bảng chỉ tiêu trên dữ liệu `phr21` và mã `613d493`. Số đo gốc nằm trong `work/pilot/table/`.

## 1. Hiện trạng và khoảng cách

| Chỉ tiêu | Hiện tại | Mục tiêu | Thiếu | Ghi chú |
|---|---|---|---|---|
| Điểm neo chú thích, trúng (303 neo × 2 chiều) | 61,9% (chỉ liên kết), 79,2% (có nhãn) | >95% | 16–33 điểm | Tên cùng chữ đã 98,3%. Tên khác cách viết 64,9%, từ thường 42,5% |
| Dev probes từ / cụm / câu (trên 40) | 37 / 29 / 40 | >38 mỗi loại | từ 2, cụm 10 | Bộ dev, bị tinh chỉnh nhiều, không dùng làm căn cứ |
| LaBSE top-1 Việt→Anh / Anh→Việt | 90,0% / 98,3% | >98% | Việt→Anh 8 điểm | Mô hình cố định, không đổi |
| Tập blind, trúng Việt→Anh / Anh→Việt | 90,2% / 84,3% | >98% | 8 và 14 điểm | 51 ca mỗi chiều, ±8 điểm |
| Văn xuôi toàn sách, không tô | 15,2% | (mục tiêu phụ) 10% | 5,2 điểm | 2.790 trên 18.296 lượt |

## 2. Trả lời thẳng: có đạt được tất cả không?

Không thể hứa đạt hết. Lý do theo từng chỉ tiêu:

1. **Không chứng minh được >98% với tập đo hiện có.** 51 ca mỗi chiều chỉ cho khoảng tin cậy ±8 điểm. Ngay cả khi trúng 51/51, cận dưới Wilson chỉ khoảng 93%. Muốn khẳng định >98% cần khoảng 400 ca độc lập mỗi chiều đã có người kiểm. Đây là việc phải làm trước, không thì "đạt" chỉ là lời nói.
2. **Đáp án chuẩn hiện tại đo thiếu.** Tiếng Anh hay tách một câu Việt thành nhiều câu, nên đáp án cặp câu tính hệ thống trả đúng vế là "sai". Một phần khoảng cách ở chiều Anh→Việt là do thước đo chứ không do hệ thống.
3. **Điểm neo ">95%" không áp dụng được cho từ thường.** Đáp án là vị trí dấu chú thích, chính xác với tên riêng nhưng nhiễu với từ thường (ví dụ "thấy" trước "(13)" so với "under the Jin"). Mục tiêu hợp lý là >95% cho tên riêng, đo riêng từ thường bằng nhãn người.
4. **LaBSE top-1 Việt→Anh 98% cần mô hình khác hoặc tinh chỉnh.** Các cách đã thử (e5, bge-reranker, ưu tiên vị trí) không nâng được Việt→Anh khỏi 90%. Sản phẩm không dùng top-1 thô, nó dùng ghép tuần tự, nên chỉ tiêu nên chuyển sang độ đúng của khâu ghép nhóm.

Phần **có khả năng đạt**: tên riêng >95% (cùng chữ đã đạt, khác cách viết cần bảng Hán–Việt↔pinyin), dev probes câu (đã 40/40) và từ (cần thêm 2), Anh→Việt của bộ mã hóa (đã 98,3%), và mức không tô 10% cho văn xuôi.

## 3. Các giai đoạn

### Giai đoạn 0: sửa thước đo (bắt buộc trước mọi kết luận)

- Định nghĩa lại từng mục tiêu: chỉ số nào, tập nào, chiều nào, và luật "đạt" = cận dưới Wilson 95% vượt ngưỡng.
- Dựng tập kiểm độc lập lớn: khoảng 400 ca mỗi chiều, rút ngẫu nhiên từ các chương, chưa từng đọc khi phát triển. Đáp án cho phép "một vế" khi tiếng Anh tách câu (sửa lỗi 1↔n).
- Người kiểm ít nhất 100 ca ngẫu nhiên của tập này để biết đáp án tự động sai bao nhiêu.
- Tách chỉ tiêu điểm neo: tên cùng chữ, tên khác cách viết, từ thường. Từ thường đo bằng nhãn người, không bằng vị trí dấu chú thích.
- Đổi chỉ tiêu bộ mã hóa thành "độ đúng của khâu ghép nhóm" (câu nào vào đúng nhóm), đo trên cùng tập.
- Ước lượng: 1–2 phiên làm việc, cộng khoảng 1–2 giờ người kiểm.

### Giai đoạn 1: chặn hồi quy đã biết (nhanh)

- Giới hạn quy tắc giữ phần tô (`partialRule`) cho vùng chọn ngắn: trên tập blind nó thêm 4 câu có đáp án nhưng 3 tô sai phạm vi, 1 sai hẳn, hit-of-answered giảm từ 96,8% xuống 91,8%.
- Đo lại trên thước đo nhãn, mẫu toàn sách, tập blind.
- Ước lượng: dưới 1 phiên.

### Giai đoạn 2: tên riêng (đòn bẩy cho điểm neo)

- Dùng `scripts/align-novel/build_sino_pinyin.py` để chuyển âm Hán–Việt sang pinyin rồi khớp tên khác cách viết ("Hoài Âm" ↔ "Huaiyin"), có cổng chặn mơ hồ (một ứng viên duy nhất trong ngữ cảnh).
- Kỳ vọng: nhóm tên khác cách viết (225 neo) từ khoảng 65% lên 85–90%. Chưa đo.
- Ước lượng: 1–2 phiên.

### Giai đoạn 3: từ và cụm văn xuôi (đòn bẩy cho probes và mức không tô)

- Nới quy tắc phần tô cho phép một từ có liên kết (đo được: thêm 414 đáp án, khoảng 80% tốt) nhưng chỉ cho vùng chọn ngắn, theo giai đoạn 1.
- Gán nhãn tay khoảng 225 nhóm hụt nhiều nhất (khoảng 45.000 ký tự đọc). Đo trên mẫu mới để tránh lạc quan do chọn nhóm theo mẫu.
- Đòn bẩy cấu trúc: tinh chỉnh bộ ghép từ (mBERT kiểu awesome-align) có giám sát bằng hơn 7.000 cặp nhãn viết tay, chia nhãn theo chương để có tập kiểm riêng. Đây là cách duy nhất chạm vào nhóm "không từ nào có liên kết" (khoảng 31% số lượt không tô). Cần chạy lại đường ống và phát hành lại cả 20 chương.
- Ước lượng: gán nhãn 3–4 phiên, tinh chỉnh bộ ghép từ 3–5 phiên kể cả phát hành lại.

### Giai đoạn 4: khâu dựng nhóm

- Ghép lại các câu nằm ngoài mọi nhóm (544 lượt, 3,0 điểm của mẫu toàn sách) bằng LaBSE trong cửa sổ lân cận, giữ thứ tự.
- Cùng lúc thử bộ ưu tiên vị trí đã đo (Anh→Việt top-1 lên 100% trong thử nghiệm) vào khâu ghép.
- Ước lượng: 2–3 phiên, phát hành lại cả 20 chương.

### Giai đoạn 5: cổng chặn và phát hành

- Mỗi giai đoạn: thước đo nhãn, mẫu toàn sách, mẫu mới, tập kiểm độc lập của giai đoạn 0 (đánh giá một lần trước và một lần sau), cộng một phiếu người kiểm khoảng 30 thẻ.
- Chỉ phát hành khi không mất đáp án đúng và phiếu nghiêng về thay đổi ở ≥80% thẻ có kết luận.

## 4. Thứ tự đề xuất

| Thứ tự | Giai đoạn | Lý do |
|---|---|---|
| 1 | 0 – sửa thước đo | Không có nó thì không biết đã đạt hay chưa |
| 2 | 1 – chặn hồi quy | Rẻ, sửa một lỗi đang chạy trên production |
| 3 | 2 – tên riêng | Đòn bẩy rõ nhất cho điểm neo |
| 4 | 3 – từ và cụm | Lớn nhất, gồm cả việc cần chạy lại đường ống |
| 5 | 4 – dựng nhóm | Phát hành lại toàn bộ, gộp với giai đoạn 3 nếu được |

## 5. Kỳ vọng thực tế sau toàn bộ kế hoạch (ước lượng, chưa đo)

| Chỉ tiêu | Kỳ vọng |
|---|---|
| Tên riêng (cùng chữ và khác cách viết) | ~95% có thể đạt |
| Từ thường (đo bằng nhãn người) | 85–90% |
| Dev probes từ / cụm / câu | 39 / 32–35 / 40 |
| Khâu ghép nhóm (thay cho LaBSE top-1) | 95–98% |
| Tập kiểm độc lập, trúng mỗi chiều | 90–95%; >98% khó, và cần tập ~400 ca/chiều mới chứng minh được |
| Văn xuôi không tô | 8–10% |
