import clsx from "clsx";
import React, { type ReactElement, useEffect, useRef } from "react";
import { useEventListener } from "usehooks-ts";
import styles from "./SnapScroll.module.css";

interface SnapScrollProps {
  children: React.ReactNode;
}

export const SnapScroll = ({
  children,
}: SnapScrollProps): React.JSX.Element => {
  const childCount = React.Children.count(children);
  const containerRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const isAnimating = useRef(false);

  const childCountRef = useRef(childCount);
  childCountRef.current = childCount;

  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToIndex = useRef((index: number) => {
    if (!containerRef.current) return;
    const clamped = Math.max(0, Math.min(index, childCountRef.current - 1));
    if (clamped === indexRef.current) return;
    indexRef.current = clamped;
    isAnimating.current = true;
    const target = clamped * containerRef.current.clientHeight;
    containerRef.current.scrollTo({ top: target, behavior: "smooth" });

    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    safetyTimer.current = setTimeout(() => {
      isAnimating.current = false;
    }, 1000);
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (isAnimating.current) return;

      // Sync index from actual scroll position before navigating
      const h = el.clientHeight;
      if (h > 0) indexRef.current = Math.round(el.scrollTop / h);

      if (event.deltaY > 0) {
        scrollToIndex.current(indexRef.current + 1);
      } else if (event.deltaY < 0) {
        scrollToIndex.current(indexRef.current - 1);
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let scrollEndTimer: ReturnType<typeof setTimeout> | null = null;
    const handleScroll = () => {
      if (scrollEndTimer) clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(() => {
        isAnimating.current = false;
        const h = el.clientHeight;
        if (h > 0) indexRef.current = Math.round(el.scrollTop / h);
      }, 100);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle keyboard scroll events
  const handleKeyDown = (event: KeyboardEvent): void => {
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    const syncIndex = () => {
      const el = containerRef.current;
      if (!el) return;
      const h = el.clientHeight;
      if (h > 0) indexRef.current = Math.round(el.scrollTop / h);
    };

    if (
      event.key === "ArrowDown" ||
      event.key === " " ||
      event.key === "PageDown"
    ) {
      event.preventDefault();
      if (isAnimating.current) return;
      syncIndex();
      scrollToIndex.current(indexRef.current + 1);
    } else if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      if (isAnimating.current) return;
      syncIndex();
      scrollToIndex.current(indexRef.current - 1);
    }
  };

  useEventListener("keydown", handleKeyDown);

  return (
    <div
      ref={containerRef}
      className={styles.scrollContainer}
      style={{
        height: "100vh",
        overflowY: "scroll",
        scrollBehavior: "smooth",
      }}
    >
      <div
        style={{
          height: "100%",
          width: "100%",
        }}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            const _child = child as ReactElement<{ className?: string }>;
            return React.cloneElement(_child, {
              className: clsx(styles.scrollItem, _child.props.className),
            });
          }
          return null;
        })}
      </div>
    </div>
  );
};

export default SnapScroll;
