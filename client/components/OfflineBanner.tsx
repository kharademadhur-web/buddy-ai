import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed left-1/2 top-3 z-[9999] flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-lg">
      <WifiOff className="h-4 w-4" />
      Offline - Sync pending
    </div>
  );
}
