import { Suspense } from "react";
import OfflineReader from "../../src/components/OfflineReader";
export default function OfflinePage() {
  return (
    <Suspense fallback={<p>Đang mở sách đã tải… / Opening downloaded book…</p>}>
      <OfflineReader />
    </Suspense>
  );
}
