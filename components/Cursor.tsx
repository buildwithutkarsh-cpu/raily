"use client";

import { useEffect, useRef } from "react";

/**
 * Polished custom cursor.
 * - Only activates on devices with a fine pointer (no touch/mobile)
 * - Subtle dot with border that scales on interactive elements
 * - Degrades gracefully — default cursor shows on touch devices
 */
export default function Cursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const isTouchRef = useRef(false);

  useEffect(() => {
    // Detect touch device — don't show custom cursor
    isTouchRef.current =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (isTouchRef.current) return;

    const cursor = cursorRef.current;
    if (!cursor) return;

    let mouseX = -100;
    let mouseY = -100;
    let cursorX = -100;
    let cursorY = -100;
    let rafId: number;
    let isVisible = false;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isVisible) {
        isVisible = true;
        cursor.style.opacity = "1";
      }
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest(
        'a, button, [role="button"], input, textarea, select'
      );
      if (target) {
        cursor.classList.add("expanded");
      } else {
        cursor.classList.remove("expanded");
      }
    };

    const handleMouseLeave = () => {
      isVisible = false;
      cursor.style.opacity = "0";
    };

    const handleMouseEnter = () => {
      isVisible = true;
      cursor.style.opacity = "1";
    };

    const animate = () => {
      cursorX += (mouseX - cursorX) * 0.15;
      cursorY += (mouseY - cursorY) * 0.15;
      cursor.style.left = `${cursorX}px`;
      cursor.style.top = `${cursorY}px`;
      rafId = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseover", handleMouseOver, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);
    rafId = requestAnimationFrame(animate);

    // Show cursor initially if mouse is already over the page
    cursor.style.display = "block";

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return <div ref={cursorRef} className="custom-cursor" />;
}
