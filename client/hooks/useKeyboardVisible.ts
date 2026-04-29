/**
 * Tracks whether the on-screen keyboard is currently visible on mobile.
 * Uses the Capacitor Keyboard plugin when available (inside APK),
 * with a visualViewport fallback for browser-based testing.
 */
import { useEffect, useState } from "react";

export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setupCapacitor = async () => {
      try {
        const { Keyboard } = await import("@capacitor/keyboard");
        const showHandle = await Keyboard.addListener("keyboardWillShow", () => setVisible(true));
        const hideHandle = await Keyboard.addListener("keyboardWillHide", () => setVisible(false));
        cleanup = () => {
          void showHandle.remove();
          void hideHandle.remove();
        };
      } catch {
        // Capacitor not available — use visualViewport fallback
        const vv = window.visualViewport;
        if (!vv) return;
        const onResize = () => {
          const keyboardHeight = window.innerHeight - vv.height;
          setVisible(keyboardHeight > 80);
        };
        vv.addEventListener("resize", onResize);
        cleanup = () => vv.removeEventListener("resize", onResize);
      }
    };

    void setupCapacitor();
    return () => cleanup?.();
  }, []);

  return visible;
}
