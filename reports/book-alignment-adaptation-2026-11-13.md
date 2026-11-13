# Book-specific alignment adaptation — 2026-11-13

Trạng thái: đã triển khai mã và tạo lại dữ liệu local; đang hoàn tất kiểm thử trước khi phát hành online.

## Thay đổi

- Thơ: nhận diện track từ các dòng DOM; từng bản diễn nghĩa được chọn nhất quán cho toàn bài. Ghép cụm1–3 dòng bằng embedding của chuỗi thực, thay cho lấy trung bình vector từng dòng. Ngưỡng whole-track .5 và joined-line .35 giữ nguyên. Bản gốc yếu không buộc phải ghép theo số dòng.
- Chương1: bản diễn nghĩa hiện đủ8 dòng, gồm cả hai dòng cuối trước đây bị thiếu khi tra. Chương3: nhận diện riêng các bản diễn nghĩa được hỗ trợ. Thơ bị gộp thành đoạn DOM dài vẫn giữ cách xử lý cũ; không tuyên bố toàn bộ thơ đã giải quyết hoàn toàn.
- Chú thích: thêm nội dung tham chiếu cùng ngôn ngữ vào phần đánh giá ngữ nghĩa, có chặn chu trình, sâu tối đa3, thêm tối đa2048 ký tự. Không lấy số chú thích VI/EN làm danh tính và không nới phạm vi liên kết từ.
- Từ điển: 126 mục được chấp nhận theo chương, tương ứng115 cặp chữ quan sát khác nhau; thêm599 liên kết nằm trong phạm vi đã ghép. 15131 ứng viên tên/thuật ngữ còn được giữ riêng. Chỉ tên phiên âm nhiều từ, có bằng chứng độc lập và không mơ hồ mới tự áp dụng; thuật ngữ từ raw model chưa tự được xem là đúng nghĩa.
- Đối chiếu trên mobile: tô vị trí ngay cả khi font tải chậm; căn lại vị trí sau khi font sẵn sàng. Không để chờ font ngăn đánh dấu hoặc bỏ qua vị trí đang tra.
- Recipe mới có job riêng; giữ các run LaBSE/E5 cũ làm fallback. Không sửa nội dung, revision, hash hoặc tọa độ Reader của40 bản đã xuất bản. Chưa làm tính năng đọc offline.

## Fine-tune thật và quyết định chọn model

Đã chạy300 bước, seed42, CPU2 luồng. Nguồn có547 cặp sạch;300 cặp được dùng cho300 bước. Huấn luyện14.175.744 tham số thuộc encoder6/7, có ảnh hưởng trực tiếp đến hidden-state8 đang dùng để ghép từ. Mục tiêu: frozen-teacher SO + bilingual masked LM. Thời gian toàn tác vụ ghi nhận123.60s; đây là fine-tune một phần mBERT, không phải huấn luyện toàn bộ model.

Chia theo toàn chương: test1/2/3/14/19, dev4; các chương còn lại cho train. Loại trùng cả chuỗi nguồn và đích qua các split; không dùng từ điển hay đáp án gold làm nhãn huấn luyện.

| Bộ kiểm thử giữ riêng:40 ca dương tính | Model gốc | Candidate |
| --- | ---: | ---: |
| Macro precision | 71.63% | 71.58% |
| Macro recall | 57.29% | 55.47% |
| Macro F1 | 61.41% | 60.39% |
| Ca âm tính/ngữ cảnh có liên kết không rỗng | 17/19 | 18/19 |

**Giữ model gốc.** Candidate không qua điều kiện tăng F1 ít nhất .02 và không tăng chỉ báo ca âm tính không rỗng. Dev4 tăng F1 nhưng không được dùng để lấn át kết quả test. Không chọn model chỉ vì loss giảm và không tiếp tục sửa tham số theo kết quả test. Checkpoint safetensors được giữ local, không đưa vào Git/browser/Supabase hoặc dùng trên web.

Các ca kiểm thử là những ví dụ phát triển đã có, giữ ngoài lần train này; không phải bộ đánh giá độc lập từ chuyên gia mới.24 ca thiếu ngữ cảnh ghép được liệt kê riêng;12 ca dương tính giữ từ bị thiếu phạm vi trong mẫu số recall. Chỉ báo âm tính không rỗng không đồng nghĩa mọi liên kết của ca đó sai: một tên riêng vẫn có thể có đối ứng trong câu bị lược. F1 không phải tỷ lệ câu đúng nghĩa toàn sách.

## Tỷ lệ trên cùng mẫu số toàn sách

| Chỉ số tự động | Trước | Sau |
| --- | ---: | ---: |
| Câu/vế có phạm vi ghép | 83.81% | 83.76% |
| Từ có liên kết thô | 60.91% | 60.87% |
| Từ phủ đủ ký tự chữ | 50.29% | 50.44% |
| UI trả match khi chọn nguyên đơn vị | 4.30% | 4.30% |
| UI có ít nhất ngữ cảnh | 89.20% | 89.24% |

Mẫu số: 19,551 đơn vị câu/vế,128,973 từ. Lỗi truy vấn UI=0; không thay đổi ngưỡng .82/.015 để tăng nhãn match. Toàn bộ20 artifacts=9,544,734 byte; có53 nhóm thơ có metadata track.

Các chỉ số tổng gần như không đổi; cải thiện chính là tính nhất quán và tránh cắt phần đối ứng ở các trường hợp cấu trúc đã xác nhận. Không đồng nhất mở rộng từ hiển thị với độ phủ raw, không hứa >95% hoặc100%. Xem báo cáo coverage đi kèm để có đủ40 hàng chương/ngôn ngữ và mẫu số.

## Kiểm chứng và hiện vật

- Local:55 Python tests,269 Vitest tests, typecheck, production build và36 browser tests online trên desktop/Android/WebKit đã qua. Không kiểm thử điện thoại vật lý. Kết quả candidate cuối cùng dùng phạm vi ghép của recipe mới; so sánh trước khi sửa cấu trúc cũng đã từ chối candidate.
- Repro local: `scripts/align-novel/adaptation_data.py`, `train_word_model.py`; thực nghiệm/manifest/checkpoint/evaluator ở `D:/codex/2026-10-22/p/work/book-adaptation-20261113/`.
- Checkpoint SHA256 `d202cfd18fc3968b32f760f596a3743c6312c6fd616e263dff8ec98175f6f4c3`; dataset SHA256 `e86ce20cf1a52154833d584efad74528ddc5f8d0010d8990a0c53e9858120416`.
- `reports/book-alignment-adaptation-2026-11-13.json` chứa từng dự đoán kiểm thử, source bindings, cấu hình và coverage đầy đủ. Checkpoint, dữ liệu train và toàn bộ sidecar từ điển không nằm trong Git.
