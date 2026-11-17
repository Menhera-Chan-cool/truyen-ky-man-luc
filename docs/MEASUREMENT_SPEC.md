# Đặc tả cách đo các mục tiêu đối ứng VI↔EN (giai đoạn 0)

Lập ngày 2026-11-17. Thay cho bảng chỉ tiêu cũ ("Điểm neo 41,7% / 56,4%", "Probe 33 / 27 / 39", "LaBSE 90,0% / 98,3%", "Tập mới 78% / 73%"), vốn trộn nhiều cách đo khác nhau. Dữ liệu `phr21`, mã `613d493`. Kế hoạch tiếp theo nằm trong `docs/PLAN_MUC_TIEU.md`.

## 1. Phát hiện chính

1. **Không thể có tập kiểm độc lập lớn bằng số chú thích.** Cả sách chỉ có **163 cặp câu chắc chắn** (cùng một tập số chú thích xuất hiện đúng một lần ở mỗi bản) và 7 cặp nội suy. Cả 163 đã dùng làm tập dev, blind hoặc tuned, nên chỉ còn 4 cặp chưa dùng (chương 8). Tập "blind" cũng không còn nguyên vẹn sau khi được đo nhiều lần. Muốn có hàng trăm ca độc lập mới phải dựa vào người kiểm.
2. **Đáp án chuẩn hiện tại đo thiếu.** Tiếng Anh hay tách một câu Việt thành nhiều câu, nên câu trả lời đúng nhưng dài hơn hay ngắn hơn câu chuẩn bị chấm "sai". Với cách chấm có dung sai theo độ dài kỳ vọng, "trúng" của cùng tập tăng từ 84,0% lên 90,7%.
3. **Phần thiếu chủ yếu là độ phủ và phạm vi, không phải trả lời sai.** Trong số câu đã trả lời, 96,8% trúng và chỉ 1,3% sai hẳn.

## 2. Định nghĩa từng chỉ tiêu

Luật "đạt": **cận dưới của khoảng Wilson 95% phải đạt ngưỡng**, không phải giá trị trung bình.

### M1. Cặp câu (tập tham chiếu 166 cặp = dev + blind + tuned, 332 ca hai chiều)

Công cụ: `npx tsx scripts/align-novel/measure-sentences.ts DATA OUT.json heldout/gold.json heldout/blind.json`.

Ca: chọn nguyên một câu của một bản, đáp án là câu đối ứng ở bản kia.
- **Trúng (có dung sai):** F1 ký tự ≥ 0,5; hoặc phần tô phủ câu chuẩn (≥ 90%) và không dài quá 1,6 lần độ dài kỳ vọng; hoặc phần tô nằm trong câu chuẩn (≥ 90%) và dài ít nhất một nửa độ dài kỳ vọng. Độ dài kỳ vọng là độ dài câu được chọn nhân 1,17 (Việt→Anh) hoặc chia 1,17 (Anh→Việt); 1,17 là trung vị tỷ lệ độ dài Anh/Việt của các cặp chuẩn.
- **Độ phủ**, **trúng trong số đã trả lời**, **sai trong số đã trả lời**, và **đoạn trả về có chứa câu chuẩn** (đo độ đúng của khâu ghép nhóm, thay cho "LaBSE top-1").

| | Việt→Anh | Anh→Việt |
|---|---|---|
| Độ phủ | 95,2% [90,8–97,5] | 92,2% [87,1–95,4] |
| Trúng (chặt) | 86,7% [80,7–91,1] | 81,3% [74,7–86,5] |
| **Trúng (có dung sai)** | **92,8% [87,8–95,8]** | **88,6% [82,8–92,5]** |
| Trúng trong số đã trả lời | 97,5% [93,7–99,0] | 96,1% [91,7–98,2] |
| Sai hẳn trong số đã trả lời | 1,9% [0,6–5,4] | 0,7% [0,1–3,6] |
| Đoạn trả về có câu chuẩn (ghép nhóm) | 99,4% [96,7–99,9] | 90,4% [84,9–94,0] |

Ngưỡng >98% **chưa đạt** theo luật cận dưới ở mọi dòng. Khâu ghép nhóm Việt→Anh gần đạt (cận dưới 96,7%), Anh→Việt là chỗ yếu nhất.

Cảnh báo: tập này đã được dùng khi phát triển, nên các số trên không chứng minh chất lượng trên văn bản mới.

### M2. Điểm neo chú thích (303 neo, 606 lượt, `scripts/align-novel/anchor-eval.ts`)

Đáp án là vị trí dấu chú thích, chính xác với tên riêng, nhiễu với từ thường, nên báo riêng từng loại và không dùng một con số chung.

| Loại | n | Chỉ liên kết | Có nhãn viết tay |
|---|---:|---|---|
| Tên cùng chữ (bỏ dấu) | 120 | 98,3% [94,1–99,5] | 98,3% |
| Tên khác cách viết | 225 | 64,9% [58,4–70,8] | 79,6% [73,8–84,3] |
| Từ thường | 261 | 42,5% [36,7–48,6] | 70,1% [64,3–75,3] |

Mục tiêu >95% chỉ áp dụng cho **tên riêng**. Từ thường đo bằng M4. Cột "có nhãn" bị thổi phồng vì nhãn viết tay phủ cùng các nhóm đó.

### M3. Dev probes (120 ca, `evaluate.ts`)

Chỉ dùng để phát hiện hồi quy, **không dùng để kết luận**. Hiện 37 / 29 / 40 (từ / cụm / câu, trên 40); chỉ liên kết: 35 / 28 / 40; lúc đo bảng cũ: 33 / 27 / 39.

### M4. Độ đúng khi trả lời, người kiểm chấm tuyệt đối trên mẫu ngẫu nhiên toàn sách

Đây là cách duy nhất để khẳng định ">98% đúng khi trả lời" cho từ, cụm và câu mà không cần đáp án cặp câu. Phiếu 22 (102 ca: 34 câu, 34 cụm, 34 từ, hai chiều, 84 ca có tô và 18 ca không tô) ở https://claude.ai/artifact/ATkkdbxHMNAvhjDNqcUeVj. Mỗi ca chấm "đúng / một phần / sai"; ca không tô thì chấm đoạn trả về có chứa bản dịch hay không.

### M5. Độ phủ văn xuôi (tự động)

Tỷ lệ lượt chọn không có tô sáng trên mẫu toàn sách 18.296 lượt: 15,2% (`docs/EVALUATION_PROTOCOL.md`, vòng thứ ba). Mục tiêu phụ 10%.

### M6. Bộ mã hóa LaBSE: chỉ còn là chỉ số chẩn đoán

Top-1 thô trên 60 cặp dev: 90,0% / 98,3%, không đổi (mô hình cố định). Sản phẩm không dùng top-1 thô mà ghép tuần tự, nên chỉ tiêu quyết định là **đoạn trả về có chứa câu chuẩn** ở M1.

## 3. Cần bao nhiêu ca để chứng minh một ngưỡng

Số ca tối thiểu để cận dưới Wilson 95% của tỷ lệ đúng đạt ngưỡng, tùy số lỗi quan sát được:

| Số lỗi | 0 | 1 | 2 | 3 | 5 |
|---|---:|---:|---:|---:|---:|
| Chứng minh ≥ 95% | 73 | 110 | 142 | 173 | 230 |
| Chứng minh ≥ 98% | 189 | 280 | 361 | 437 | 581 |

Phiếu 22 có 84 ca có tô: nếu không ca nào sai thì chứng minh được ≥ 95% (cận dưới 95,6%); muốn chứng minh ≥ 98% cần ít nhất khoảng 190 ca có tô mà không sai ca nào, thực tế 280 đến 440 ca, tức khoảng ba đến bốn phiếu như phiếu 22.

## 4. Việc cần người làm

1. Chấm phiếu 22 (khoảng 25 đến 30 phút) rồi dán CSV vào đây. Kết quả cho M4 lần đầu, kèm khoảng tin cậy.
2. Nếu muốn chứng minh ≥ 98%: ba phiếu nữa cùng thiết kế, mẫu mới mỗi lần. Tôi dựng phiếu bằng `work/pilot/gold3/sample_sheet22.py` (hạt giống khác) và `work/human-check/make_sheet22.py`.
3. Trong lúc chờ, các giai đoạn 1 đến 4 của kế hoạch vẫn làm được và đo bằng M1, M2, M5.
