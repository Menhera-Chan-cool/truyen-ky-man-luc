# text-anchors

Mục tiêu: ánh xạ kết quả ML về chính xác chuỗi DOM mà Reader đang dùng, giữ nguyên chữ, offset ghi chú và chú thích. Phụ thuộc: không. Kế hoạch đã duyệt: tasks/novel-bilingual-lookup-plan.md.

- Hợp đồng: `extractAlignmentText(html, locale)` trả `codec`, `text`, các sentence span UTF-16, vùng truyện/lời bình/chú thích và đơn vị text phục vụ model có map về text gốc.
- Mỗi span có start/end/quote; `text.slice(start,end) === quote`. Text phải bằng DOM `textContent` sau `cleanHtml`, không lấy `node-html-parser.textContent` trực tiếp vì br.
- Bỏ ký hiệu dẫn khỏi model view bằng khoảng trắng cùng độ dài, không đổi chuỗi Reader. Không ghép qua ranh giới phần; giữ mapping khi thêm khoảng trắng ảo giữa khối.
- Kiểm HTML inline, br, entity, paragraph, Unicode tổ hợp/emoji, thơ và đoạn bị chia vụn. Không phụ thuộc phông, giao diện hoặc số trang.
- Mã `src/lib/novel-alignment.ts`; tests `tests/novel-alignment.test.ts`. TypeScript strict, dùng kiểu `Locale` hiện có và `{start:number;end:number;quote:string}`.
- Lệnh: `npx vitest run tests/novel-alignment.test.ts --maxWorkers=2`; `npm run typecheck`.
- Luôn kiểm quote/range; không sửa nội dung hoặc schema. Nghiệm thu: mọi fixture bằng DOM và round-trip vị trí chính xác.
