"use client";
import { Panel } from "./Ui";
import type { Locale } from "../lib/types";
export default function ReaderGuide({
  locale,
  onClose,
}: {
  locale: Locale;
  onClose: () => void;
}) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en);
  return (
    <Panel
      title={L("Hướng dẫn thao tác", "Reading guide")}
      onClose={onClose}
      closeLabel={L("Đóng", "Close")}
    >
      <ol className="reader-guide">
        <li>
          <h3>{L("Kéo mép giấy trên PC", "Drag paper edges on PC")}</h3>
          <p>
            {L(
              "Trong giao diện Sách, giữ chuột trái ở mép phải rồi kéo trái để tới trang sau; kéo mép trái sang phải để lùi. Kéo ngắn sẽ trả giấy về.",
              "In Book view, hold the right paper edge and drag left to advance; drag the left edge right to go back. A short pull returns the paper.",
            )}
          </p>
        </li>
        <li>
          <h3>{L("Vuốt trên điện thoại", "Swipe on your phone")}</h3>
          <p>
            {L(
              "Vuốt nhẹ trái/phải hoặc chạm mép phải/trái của tờ giấy để tiến/lùi trang. Thanh dưới tự ẩn; chạm vùng trống ở giữa giấy hoặc mép dưới để hiện lại. Có thể nhập số trang trong Tiện ích đọc.",
              "Swipe gently left/right, or tap the right/left paper edge to go forward/back. Bottom controls hide automatically; tap blank space in the middle or the bottom edge to reveal them. Reading tools also lets you enter a page number.",
            )}
          </p>
        </li>
        <li>
          <h3>
            {L(
              "Chọn chữ để ghi chú hoặc nghe",
              "Select text to annotate or listen",
            )}
          </h3>
          <p>
            {L(
              "Kéo chuột hoặc giữ ngón tay trên chữ, chọn đoạn rồi dùng bảng hiện ra để tô màu, ghi chú, sao chép, nghe hoặc trích dẫn.",
              "Drag the mouse or hold a finger on text, select a passage, then highlight, annotate, copy, listen or create a quote using its toolbar.",
            )}
          </p>
        </li>
        <li>
          <h3>{L("Mở chú thích", "Open footnotes")}</h3>
          <p>
            {L(
              "Số nhỏ màu xanh là chú thích. Trên điện thoại, chạm để đọc thẻ tại chỗ. PC rê chuột để xem trước, bấm để tới chú thích cuối chương; Back quay lại chỗ cũ.",
              "Blue superscript numbers are footnotes. On phones, tap to open a card. On PC, hover to preview or click to visit the endnote; Back returns to the previous passage.",
            )}
          </p>
        </li>
      </ol>
      <p className="tiny muted">
        {L(
          "Đổi VI/EN giữ cùng chương và chỗ đọc riêng. Tiến độ, ghi chú và phông riêng lưu trên thiết bị; có thể xuất bản sao trong Cài đặt.",
          "VI/EN switches keep the same chapter and separate reading positions. Progress, notes and personal fonts stay on your device; reader data can be backed up in Settings.",
        )}
      </p>
    </Panel>
  );
}
