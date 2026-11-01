"use client";
import {useEffect, useState} from "react";

export default function NetworkNotice({active, activity, locale, className = "admin-message"}: {
  active: boolean; activity?: string; locale: "vi" | "en"; className?: string;
}) {
  const [offline, setOffline] = useState(false), [waiting, setWaiting] = useState(false);
  useEffect(() => {
    const update = () => setOffline(navigator.onLine === false);
    update();
    window.addEventListener("online", update);window.addEventListener("offline", update);
    return () => {window.removeEventListener("online", update);window.removeEventListener("offline", update);};
  }, []);
  useEffect(() => {
    setWaiting(false);
    if (!active) return;
    const timer = setTimeout(() => setWaiting(true), 8000);
    return () => clearTimeout(timer);
  }, [active, activity]);
  if (!offline && !(active && waiting)) return null;
  const vi = locale === "vi";
  return <div className={className} data-network-notice role="status" aria-live="polite" aria-atomic="true">
    {offline
      ? vi ? "Mất kết nối mạng." : "Network connection lost."
      : vi ? "Thao tác vẫn đang chờ hoàn tất." : "The operation is still pending."}
    {active && (vi
      ? " Giữ trang này mở; thao tác vừa gửi có thể vẫn hoàn tất. Chờ kết quả trước khi thử lại."
      : " Keep this page open; the submitted operation may still complete. Wait for the result before trying again.")}
    {offline && !active && (vi ? " Giữ trang này mở để tiếp tục soạn nội dung." : " Keep this page open to continue editing.")}
  </div>;
}
