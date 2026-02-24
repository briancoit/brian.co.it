import clsx from "clsx";
import React, { type ReactElement, useEffect, useRef, useState } from "react";
import styles from "./SnapScroll.module.css";

interface SnapScrollProps {
  children: React.ReactNode;
  threshold: number; // Scroll threshold to trigger snapping (as a percentage of section height)
}

export const SnapScroll = ({ children, threshold = 0.2 }: SnapScrollProps) => {
  const [scrollIndex, setScrollIndex] = useState(0);
  const childCount = React.Children.count(children);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle wheel scroll events
  const handleWheel = (event: WheelEvent) => {
    if (event.deltaY > 0 && scrollIndex < childCount - 1) {
      setScrollIndex((prevIndex) => prevIndex + 1); // Scroll down
    } else if (event.deltaY < 0 && scrollIndex > 0) {
      setScrollIndex((prevIndex) => prevIndex - 1); // Scroll up
    }
  };

  // Handle keyboard scroll events
  const handleKeyDown = (event: KeyboardEvent) => {
    if (
      event.key === "ArrowDown" ||
      event.key === " " ||
      event.key === "PageDown"
    ) {
      if (scrollIndex < childCount - 1) {
        setScrollIndex((prevIndex) => prevIndex + 1); // Scroll down
      }
    } else if (event.key === "ArrowUp" || event.key === "PageUp") {
      if (scrollIndex > 0) {
        setScrollIndex((prevIndex) => prevIndex - 1); // Scroll up
      }
    }
  };

  // Snap scrolling behavior based on the threshold
  const handleSnap = () => {
    if (containerRef.current) {
      const scrollPosition = containerRef.current.scrollTop;
      const sectionHeight = containerRef.current.clientHeight;

      // Calculate the distance to the next section
      const snapThreshold = sectionHeight * threshold;
      const nextIndex = Math.round(scrollPosition / sectionHeight);

      // If we're close enough to the next or previous section, snap
      if (
        Math.abs(scrollPosition - nextIndex * sectionHeight) < snapThreshold
      ) {
        setScrollIndex(nextIndex);
      }
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    if (containerRef.current) {
      containerRef.current.addEventListener("wheel", handleWheel, {
        passive: true,
      });
      containerRef.current.addEventListener("scroll", handleSnap);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (containerRef.current) {
        containerRef.current.removeEventListener("wheel", handleWheel);
        containerRef.current.removeEventListener("scroll", handleSnap);
      }
    };
  }, [scrollIndex]);

  return (
    <div
      ref={containerRef}
      className={styles.scrollContainer}
      style={{
        height: "100vh",
        overflowY: "scroll", // Make the container scrollable
        scrollSnapType: "y mandatory", // Enable snap scrolling
        scrollBehavior: "smooth", // Enable smooth scroll
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          width: "100%",
        }}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            const _child = child as ReactElement<{ className?: string }>;
            // Clone the child and inject the scrollItem class
            return React.cloneElement(_child, {
              className: clsx(styles.scrollItem, _child.props.className),
            });
          }
          return null; // Return null for non-React elements (shouldn't happen in this case)
        })}
      </div>
    </div>
  );
};

export default SnapScroll;
