import { lazy, Suspense, useEffect, useState } from "react";
import styles from "./App.module.css";
import { ContactForm } from "./components/ContactForm/ContactForm";
import { EmploymentHistory } from "./components/EmploymentHistory/EmploymentHistory";

// const ContactForm = lazy(() =>
//   import(/* @vite-preload */ "./components/ContactForm/ContactForm").then(({ContactForm}) => ({
//     default: ContactForm,
//   })),
// );

const SpaceHeroCanvas = lazy(() =>
  import(/* @vite-preload */ "./components/SpaceHeroCanvas").then(
    ({ SpaceHeroCanvas }) => ({
      default: SpaceHeroCanvas,
    }),
  ),
);

export function App() {
  const [heroOpacity, setHeroOpacity] = useState(1);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      // Hold at 1 for first 700px, then fade out over next 500px
      const opacity = Math.max(0, Math.min(1, 1 - (scrollY - 700) / 500));
      setHeroOpacity(opacity);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroStickyContainer}>
          <Suspense fallback={null}>
            <SpaceHeroCanvas />
          </Suspense>
          <div className={styles.wrapper} style={{ opacity: heroOpacity }}>
            <h1>
              brian<span className={styles.soft}>coit</span>
              <br />
              Hi, I'm Brian.{" "}
              <div className={styles.soft}>
                Principal Software Engineer. Let's get to work.
              </div>
            </h1>
          </div>
        </div>
      </section>
      <section className={styles.middleSection}>
        <div className={`${styles.wrapper} ${styles.bentoGrid}`}>
          <div className={`${styles.bentoCard} ${styles.bentoCardBio}`}>
            <p>
              I build software that works and lasts. I've led teams, shipped
              cloud platforms, and improved code, all with one goal: make things
              run well.
            </p>
            <p>
              No fluff, no endless meetings—just focused effort. I care about
              results, clear process, and making sure the work stands up to
              real-world use.
            </p>
            <p>
              Every project needs honest feedback and strong execution. If you
              want straight answers, real progress, and a transparent approach,
              let's talk.
            </p>
          </div>
          <EmploymentHistory />
        </div>
      </section>
      <section className={styles.contactWrapper}>
        <div className={styles.wrapper}>
          <Suspense fallback={null}>
            <ContactForm />
          </Suspense>
        </div>
      </section>
    </>
  );
}
