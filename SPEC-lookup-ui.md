# lookup-ui

Mục tiêu: thay Google bằng kết quả đối ứng từ Novel ngay trên web, hai chiều, desktop/mobile. Phụ thuộc: text-anchors, alignment-publishing.

- Bôi đen từ/cụm/câu → Tra VI↔EN. Snapshot `{chapterId,locale,revision,start,end,text}` trước khi mất focus. Bảng ngoài root văn bản, không thay chiều cao vùng đọc hoặc vị trí scroll/page.
- Hiện nguyên văn source, từ/cụm target và ngữ cảnh; nhãn Gợi ý/Chưa chắc chắn/context-only đúng quality signals. Không tự mở Google/AI bên ngoài khi thiếu kết quả.
- Lỗi mạng retry, thiếu EN/lời tựa, artifact pending/stale đều báo riêng. Abort response cũ khi đổi selection/chapter/locale. Không đọc PDF/TT như Novel text.
- Mở đối chiếu tái dùng ParallelReader với các span đã kiểm, đóng trở về chỗ đọc. VI/EN menu vẫn giữ tiến độ riêng; không đổi chức năng TTS/ghi chú/lật sách.
- Mã component lookup lazy + Reader/ParallelReader, dùng palette và Panel hiện có. 44px targets, focus, Escape, safe-area, không hover-only.
- Tests Vitest cho request state; Playwright VI/EN Scroll/Paged/Book, mobile WebKit/Android, selection/races/scroll và network assertions không Google. Lệnh `BASE_URL=http://localhost:3003 npx playwright test e2e/novel-lookup.spec.ts` (PowerShell đặt env riêng).
- Nghiệm thu: trích đoạn đúng vị trí, không model weights trong client, local review trước production. Không báo số đo chưa chạy.
