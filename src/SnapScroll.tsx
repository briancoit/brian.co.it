import clsx from "clsx";
import React, { type ReactElement, useRef, useState } from "react";
import { useEventListener } from "usehooks-ts";
import styles from "./SnapScroll.module.css";

interface SnapScrollProps {
  children: React.ReactNode;
  threshold?: number; // Scroll threshold to trigger snapping (as a percentage of section height)
}

export const SnapScroll = ({
  children,
  threshold = 0.2,
}: SnapScrollProps): React.JSX.Element => {
  const [scrollIndex, setScrollIndex] = useState(0);
  const childCount = React.Children.count(children);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle wheel scroll events
  const handleWheel = (event: WheelEvent): void => {
    if (event.deltaY > 0 && scrollIndex < childCount - 1) {
      setScrollIndex((prevIndex) => prevIndex + 1); // down
    } else if (event.deltaY < 0 && scrollIndex > 0) {
      setScrollIndex((prevIndex) => prevIndex - 1); // up
    }
  };

  // Handle keyboard scroll events
  const handleKeyDown = (event: KeyboardEvent): void => {
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

  const handleScroll = (): void => {
    if (!containerRef.current) {
      return;
    }

    const scrollPosition = containerRef.current.scrollTop;
    const sectionHeight = containerRef.current.clientHeight;

    // Calculate the distance to the next section
    const snapThreshold = sectionHeight * threshold;
    const nextIndex = Math.round(scrollPosition / sectionHeight);

    // If we're close enough to the next or previous section, snap
    if (Math.abs(scrollPosition - nextIndex * sectionHeight) < snapThreshold) {
      setScrollIndex(nextIndex);
    }
  };

  useEventListener("keydown", handleKeyDown);
  useEventListener("wheel", handleWheel, undefined, { passive: true });
  useEventListener("scroll", handleScroll);

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
