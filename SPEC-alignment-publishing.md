# alignment-publishing

Mục tiêu: tạo và phục vụ artifact tự động theo đúng cặp bản công khai. Phụ thuộc: auto-alignment artifact contract.

- Job/run định danh chapter + VI/EN version UUID + codec/model revision; retry có lease và uniqueness. Tạo job sau xuất bản, không theo bản nháp. Novel không bị khóa khi job chậm/lỗi.
- Artifact nằm vùng riêng; public lookup kiểm current published pair, quote và revision. Không nhận UUID từ khách rồi đọc bản nháp. Cache artifact phải kiểm heads trước khi dùng.
- Worker hoàn tất chỉ khi job còn đúng snapshot. Thu hồi hoặc đổi một phía ngừng dùng cặp cũ. Thành viên có quyền được xem trạng thái/retry; khách không ghi được dữ liệu.
- Prototype local dùng artifact trên filesystem ngoài repo với guard production. Chỉ chuyển sang schema/RPC sau khi POC đạt; runner production được chốt theo tài nguyên/cost đã đo.
- Đường mã: `app/api/novel-lookup/`, `src/lib/novel-lookup-server.ts`, pipeline/worker và migration riêng. TypeScript strict; RLS + server auth/CAS, giữ error handling hiện có.
- Kiểm Vitest/PGlite cho public/draft/revoked/stale/race/retry và Playwright cho response đến muộn. Lệnh `npx vitest run --maxWorkers=2`, `npm run typecheck`, `npm run build`.
- Nghiệm thu production: đóng browser editor vẫn chạy tự động, không chỉ script thủ công; không lộ nguồn/nháp/keys. Chưa đạt runner phải ghi rõ, không gắn nhãn hoàn thành toàn hệ thống.
