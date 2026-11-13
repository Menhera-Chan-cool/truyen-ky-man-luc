# Thử nghiệm XLM-RoBERTa Large cho tra từ VI–EN — 2026-11-13

**Kết luận:** chưa thay mBERT trên web. Trong thử nghiệm nhỏ này, ngay cả tầng XLM-R Large có kết quả tốt nhất trên chính bộ mẫu cũng kém mBERT. Đây là model gốc chưa fine-tune; kết quả không phủ định một bản được huấn luyện chuyên cho alignment.

## Phạm vi và phép đo

- 12 ca có sẵn từ các lỗi người dùng: 9 ca có từ/cụm đối ứng và 3 ca không có đối ứng trực tiếp hoặc chỉ có ngữ cảnh. Thêm chiều ngược lại của 9 ca dương tính: tổng 21 lượt, 18 lượt dương tính. Các chiều ngược không phải ca độc lập mới.
- Cung cấp trước cặp ngữ cảnh đúng. Chỉ đo ghép từ; không đo tìm đoạn, UI match/uncertain, toàn bộ 20 chương hoặc độ chính xác chung của sách.
- Macro precision/recall/F1 trung bình theo 18 lượt dương tính, dựa trên vị trí từ đích; không phải phần trăm câu dịch đúng. Exact là số lượt lấy đúng đủ tập từ đích, không thừa hoặc thiếu.
- Tách từ VI bằng Underthesea và kiểm tra offset. Giữ cùng dữ liệu, cửa sổ 192 subtoken/chồng 32, cùng bộ trích liên kết cho hai encoder. Không sửa đáp án, không dùng từ điển gán tay hoặc hạ ngưỡng theo gold.
- Hai decoder: dot-product softmax hai chiều >0.001, tối đa 3 đích/subtoken/cửa sổ; và cosine mutual nearest neighbor để kiểm tra ảnh hưởng thang độ lớn vector. Đây là phép thử trích đặc trưng tương thích XLM-R, không phải tuyên bố Awesome-align gốc hỗ trợ XLM-R.
- Các tầng XLM-R 8/12/16/20/24 được khai báo trước khi chạy. Chọn tầng tốt nhất sau khi xem kết quả là thăm dò trên bộ mẫu, chưa có kiểm thử độc lập để chọn tầng.
- CPU float32, 2 luồng. Không gửi nội dung sách ra API, không huấn luyện, không đổi dữ liệu Supabase/model đang chạy hoặc deploy.

## Kết quả

| Encoder / tầng | Softmax precision | Softmax recall | Softmax F1 | Exact softmax /18 | Cosine MNN F1 | Exact cosine /18 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| mbert-layer8 | 72.22% | 63.79% | 65.88% | 7 | 65.88% | 7 |
| xlmr-large-layer8 | 28.70% | 26.62% | 23.64% | 1 | 23.27% | 2 |
| xlmr-large-layer12 | 44.72% | 38.81% | 38.30% | 4 | 38.83% | 4 |
| xlmr-large-layer16 | 54.63% | 58.91% | 51.00% | 4 | 51.80% | 5 |
| xlmr-large-layer20 | 50.37% | 60.08% | 52.18% | 4 | 55.22% | 6 |
| xlmr-large-layer24 | 35.92% | 77.26% | 45.71% | 0 | 20.00% | 1 |

mBERT F1 65.88%; XLM-R Large tốt nhất 55.22% (cosine/tầng20), thấp hơn 10.66 điểm. Với cùng decoder softmax: 65.88% so với 52.18%. Trên riêng 9 ca dương tính gốc: softmax mBERT 58.55%, XLM-R tầng20 43.25%; mBERT tái hiện kết quả thử nghiệm trước.

Cả mBERT softmax và XLM-R tầng20 vẫn cho liên kết không rỗng ở cả 3 ca âm tính/ngữ cảnh. Không được đọc số này thành 3 liên kết sai nghĩa: một câu bị lược vẫn có thể chứa tên riêng có đối ứng, nhưng các liên kết đó không chứng minh cả câu có bản tương ứng. Cần giữ tầng kiểm tra phạm vi và quyền từ chối trả kết quả.

## Ví dụ đầu ra

Các ô bên dưới liệt kê những từ đích được chọn; dấu ` · ` chỉ là dấu phân cách, không ghép chúng thành một bản dịch mới.

| Truy vấn | Đáp án mong đợi | mBERT softmax | XLM-R tầng20 cosine |
| --- | --- | --- | --- |
| Alas! | Than ôi | Than · ôi | Than · thẹn |
| Hegemon Xiang | Hạng vương | Hạng | Hạng · vương bắt |
| Gu Yaya | Cổ áp Nha | (rỗng) | (rỗng) |
| Hàn Dũ | Han Yu | Han · Yu | Han · Yu |
| Hồng Phất | Hongfu | Li · Hongfu | Li · Jing · knocked |
| tranh | zither | (rỗng) | (rỗng) |
| Ôm tranh nhẹ bấm một đôi bài. | Tipsy, I clasp the silver zither, plucking and strumming anew. | Tipsy · clasp · the · silver · zither | Tipsy · clasp · strumming |
| Cố nhân tìm cố nhân | An old friend comes seeking an old friend | An · friend · seeking · old · friend | An · friend · seeking |
| Tây Thi | Xi Shi | Xi · Fuchai | Shi |
| Cữu và Tư Mã Hân đều tự tử chết. | (không có từ đối ứng trực tiếp) | Cao · Cao · Qiu | Cao · Xiang · refuse |
| Zhangtai willow | (không có từ đối ứng trực tiếp) | Xem | chuyện |
| Tản Viên từ phán sự lục. | (không có từ đối ứng trực tiếp) | Dao · nghiep · oan | Dao · oan |

## Chi phí chạy và tính tái lập

- mBERT: nạp 1.16s; toàn bộ 21 lượt + hai decoder 2.62s. XLM-R: nạp 3.29s; toàn bộ lượt + hai decoder trên cả 5 tầng 8.98s. Các tầng dùng chung forward; không cộng thời gian 5 lần. Đây là thời gian của script thăm dò CPU, không phải độ trễ web/GPU hay benchmark tốc độ chỉ riêng một tầng.
- XLM-R weights safetensors: 2,244,817,354 byte; SHA256 `2dfa19f172412917cab174da04b46e2134811b723666965fd0aabd97caa6e23b` đã đối chiếu với metadata Hugging Face.
- Revision XLM-R: `c23d21b0620b635a76227c604d44e43a9f0ee389`; mBERT: `3f076fdb1ab68d5b2880cb87a0886f315b8146f8`.
- SHA256 tập 21 lượt: `80131699fb5f8af7341c23cb0292324ec03f99f558a4426a711ff7799e6c7fd5`.
- Mã chạy: `D:/codex/2026-10-22/p/work/alignment-model-study/benchmark_xlmr_large.py`; tái sử dụng helper `benchmark_words.py` cùng thư mục. Manifest tải, tập ca, log và kết quả JSON đầy đủ nằm cùng thư mục. Không đưa model 2.24GB vào Git hoặc browser bundle.
- Kiểm tra: self-check metric/UTF16/21 vị trí truy vấn chính xác; model load không thiếu/mismatch trọng số encoder; đối chiếu lại số trung bình từ từng ca và tái hiện F1 mBERT gốc. Hai lượt chạy cho cùng các kết quả chất lượng.

## Quyết định

Giữ LaBSE + mBERT cho bản online. Ưu tiên sửa khoanh vùng thơ/chú thích, bổ sung từ điển tên riêng/thuật ngữ và fine-tune có tập đánh giá riêng. Chỉ cân nhắc XLM-R sau thử nghiệm alignment-specific training có bằng chứng cải thiện trên dữ liệu giữ lại.

Chưa kiểm tra fine-tuning, GPU/ROCm, ghép câu hoặc toàn bộ 20 chương. Bộ mẫu nhỏ, cố ý thiên về ca khó; không thể suy ra tỷ lệ matched toàn sách hoặc hứa >95%.

Nguồn model: https://huggingface.co/FacebookAI/xlm-roberta-large ; phương pháp tham khảo: https://github.com/neulab/awesome-align
