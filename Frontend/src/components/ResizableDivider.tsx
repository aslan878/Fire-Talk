import React, { useRef, useEffect } from "react";
import "./ResizableDivider.css";

interface ResizableDividerProps {
  onResize: (newWidth: number) => void;
  minWidth?: number;
  maxWidth?: number;
}

export const ResizableDivider: React.FC<ResizableDividerProps> = ({
  onResize,
  minWidth = 260,
  maxWidth = 600,
}) => {
  const dividerRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const divider = dividerRef.current;
    if (!divider) return;

    const clampWidth = (width: number) =>
      Math.min(maxWidth, Math.max(minWidth, width));

    const stopFrame = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      const sidebar = divider.previousElementSibling as HTMLElement | null;
      if (!sidebar) return;

      e.preventDefault();
      isResizingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = sidebar.getBoundingClientRect().width;
      divider.setPointerCapture(e.pointerId);
      divider.classList.add("resizing");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isResizingRef.current) return;

      isResizingRef.current = false;
      stopFrame();
      if (divider.hasPointerCapture(e.pointerId)) {
        divider.releasePointerCapture(e.pointerId);
      }
      divider.classList.remove("resizing");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isResizingRef.current) return;

      const nextWidth = clampWidth(
        startWidthRef.current + e.clientX - startXRef.current,
      );

      stopFrame();
      frameRef.current = window.requestAnimationFrame(() => {
        onResize(nextWidth);
        frameRef.current = null;
      });
    };

    const handleLostPointerCapture = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        stopFrame();
        divider.classList.remove("resizing");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    divider.addEventListener("pointerdown", handlePointerDown);
    divider.addEventListener("pointermove", handlePointerMove);
    divider.addEventListener("pointerup", handlePointerUp);
    divider.addEventListener("pointercancel", handlePointerUp);
    divider.addEventListener("lostpointercapture", handleLostPointerCapture);

    return () => {
      stopFrame();
      divider.removeEventListener("pointerdown", handlePointerDown);
      divider.removeEventListener("pointermove", handlePointerMove);
      divider.removeEventListener("pointerup", handlePointerUp);
      divider.removeEventListener("pointercancel", handlePointerUp);
      divider.removeEventListener(
        "lostpointercapture",
        handleLostPointerCapture,
      );
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [onResize, minWidth, maxWidth]);

  return <div ref={dividerRef} className="resizable-divider" />;
};
