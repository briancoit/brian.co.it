import clsx from "clsx";
import React, { lazy, Suspense, useEffect, useRef } from "react";
import styles from "./App.module.css";
import { ContactForm } from "./components/ContactForm/ContactForm";
import { EmploymentHistory } from "./components/EmploymentHistory/EmploymentHistory";
import { SnapScroll } from "./SnapScroll";

// Load heavy WebGL component lazily to ensure it doesn't block the main thread
// during initial page load, which hurts Lighthouse and FCP metrics.
const LazySpaceHeroCanvas = lazy(() =>
  import("./components/SpaceHeroCanvas").then(({ SpaceHeroCanvas }) => ({
    default: SpaceHeroCanvas,
  })),
);

// const ContactForm = lazy(() =>
//   import(/* @vite-preload */ "./components/ContactForm/ContactForm").then(({ContactForm}) => ({
//     default: ContactForm,
//   })),
// );

export const App = React.memo(function App() {
  const heroWrapperRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lastScrollTop = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!heroWrapperRef.current) return;

      // Try to find a scrollable parent container (from SnapScroll or similar)
      let scrollContainer = null;
      let scrollY = 0;

      // Check if there's a scroll container ancestor
      let parent = heroWrapperRef.current.parentElement;
      while (parent) {
        const hasOverflow =
          window.getComputedStyle(parent).overflowY === "scroll" ||
          window.getComputedStyle(parent).overflowY === "auto";
        if (hasOverflow && parent.scrollHeight > parent.clientHeight) {
          scrollContainer = parent;
          break;
        }
        parent = parent.parentElement;
      }

      if (!scrollContainer) {
        const allElements = document.querySelectorAll(
          '[style*="overflow-y"], [style*="overflowY"], [class*="scrollContainer"]',
        );
        for (const el of allElements) {
          const overflow = window.getComputedStyle(el).overflowY;
          if (
            (overflow === "scroll" || overflow === "auto") &&
            el.scrollHeight > el.clientHeight
          ) {
            scrollContainer = el as Element;
            break;
          }
        }
      }

      // Use scroll container if found, otherwise use window
      if (scrollContainer) {
        scrollY = scrollContainer.scrollTop;
      } else {
        scrollY = window.scrollY;
      }

      // Hold at 1 for first 700px, then fade out over next 500px
      const opacity = Math.max(0, Math.min(1, 1 - (scrollY - 700) / 500));
      heroWrapperRef.current.style.opacity = String(opacity);
    };

    // Try to find and attach to scroll container
    let scrollTarget: Window | Element | null = null;
    let parent = heroWrapperRef.current?.parentElement;
    while (parent) {
      const hasOverflow =
        window.getComputedStyle(parent).overflowY === "scroll" ||
        window.getComputedStyle(parent).overflowY === "auto";
      if (hasOverflow && parent.scrollHeight > parent.clientHeight) {
        scrollTarget = parent;
        break;
      }
      parent = parent.parentElement;
    }

    if (!scrollTarget) {
      const allElements = document.querySelectorAll(
        '[style*="overflow-y"], [style*="overflowY"], [class*="scrollContainer"]',
      );
      for (const el of allElements) {
        const overflow = window.getComputedStyle(el).overflowY;
        if (
          (overflow === "scroll" || overflow === "auto") &&
          el.scrollHeight > el.clientHeight
        ) {
          scrollTarget = el;
          break;
        }
      }
    }

    // Default to window if no scroll container found
    scrollTarget = scrollTarget || window;

    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => scrollTarget?.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
    if (cards.length === 0) return;

    const scrollContainer =
      cards[0].closest('[style*="overflowY"]') ||
      cards[0].closest(".scrollContainer") ||
      null;
    const scrollEl = scrollContainer as HTMLElement | null;

    const updateDirection = () => {
      const top = scrollEl ? scrollEl.scrollTop : window.scrollY;
      const dir = top >= lastScrollTop.current ? "down" : "up";
      lastScrollTop.current = top;
      for (const card of cards) {
        if (!card.classList.contains(styles.cardVisible)) {
          if (dir === "up") {
            card.classList.add(styles.cardUp);
          } else {
            card.classList.remove(styles.cardUp);
          }
        }
      }
    };

    const target = scrollEl || window;
    target.addEventListener("scroll", updateDirection, { passive: true });

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add(styles.cardVisible);
          } else {
            (entry.target as HTMLElement).classList.remove(styles.cardVisible);
          }
        }
      },
      { threshold: 0.15, root: scrollEl },
    );

    for (const card of cards) observer.observe(card);

    return () => {
      observer.disconnect();
      target.removeEventListener("scroll", updateDirection);
    };
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <LazySpaceHeroCanvas />
      </Suspense>
      <SnapScroll>
        <section className={styles.hero}>
          <div className={styles.heroStickyContainer}>
            <div ref={heroWrapperRef} className={styles.wrapper}>
              <h1>
                {/* brian<span className={styles.soft}>coit</span>
              <br /> */}
                Hi, I'm Brian.{" "}
                <div className={styles.soft}>
                  Principal Software Engineer.{/* Let's get to work.*/}
                </div>
              </h1>
            </div>
          </div>
        </section>
        <section className={styles.middleSection}>
          <div className={clsx(styles.wrapper, styles.bentoGrid)}>
            <div
              ref={(el) => {
                cardRefs.current[0] = el;
              }}
              className={clsx(styles.bentoCard, styles.bentoCardBio)}
            >
              <p>
                I build software that works and lasts. I've led teams, shipped
                cloud platforms, and improved code, all with one goal: make
                things run well.
              </p>
              <p>
                No fluff, no endless meetings—just focused effort. I care about
                results, clear process, and making sure the work stands up to
                real-world use.
              </p>
              <p>
                Every project needs honest feedback and strong execution. If you
                want straight answers, real progress, and a transparent
                approach, let's talk.
              </p>
            </div>
          </div>
        </section>
        <section>
          <div className={clsx(styles.wrapper, styles.bentoGrid)}>
            <div
              ref={(el) => {
                cardRefs.current[1] = el;
              }}
              className={clsx(styles.bentoCard, styles.bentoCardBio)}
            >
              <EmploymentHistory />
            </div>
          </div>
        </section>
        <section>
          <div className={clsx(styles.wrapper, styles.bentoGrid)}>
            <div
              ref={(el) => {
                cardRefs.current[2] = el;
              }}
              className={clsx(styles.bentoCard, styles.bentoCardBio)}
            >
              <div className={styles.wrapper}>
                <Suspense fallback={null}>
                  <ContactForm />
                </Suspense>
              </div>
            </div>
          </div>
        </section>
      </SnapScroll>
    </>
  );
});
