import {
  lazy,
  Suspense,
  useState,
  useEffect
} from "react";
import { EmploymentHistory } from "./components/EmploymentHistory/EmploymentHistory";
import { SpaceHeroCanvas } from "./components/SpaceHeroCanvas";
import { ContactForm } from "./components/ContactForm/ContactForm";

// const ContactForm = lazy(() =>
//   import(/* @vite-preload */ "./components/ContactForm/ContactForm").then(({ContactForm}) => ({
//     default: ContactForm,
//   })),
// );

// const SpaceHeroCanvas = lazy(() =>
//   import(/* @vite-preload */ "./components/SpaceHeroCanvas").then(({SpaceHeroCanvas}) => ({
//     default: SpaceHeroCanvas,
//   })),
// );

// const SpaceContactCanvas = lazy(() =>
//   import(/* @vite-preload */ "./components/SpaceContactCanvas").then(({SpaceContactCanvas}) => ({
//     default: SpaceContactCanvas,
//   })),
// );

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
      <section className="hero">
        <div className="hero-sticky-container">
          <Suspense fallback={null}>
            <SpaceHeroCanvas />
          </Suspense>
          <div className="wrapper" style={{ opacity: heroOpacity }}>
            <h1>
              brian<span className="soft">coit</span><br />
              Hi, I'm Brian.{" "}
              <div className="soft">
                Principal Software Engineer. Let's get to work.
              </div>
            </h1>
          </div>
        </div>
      </section>
      <section className="middle-section">
        <div className="wrapper glass-card">
          <div className="what-i-do">
            <p>
              I build software that works and lasts. I've led teams, shipped cloud
              platforms, and improved code, all with one goal: make things run
              well.
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
      <section className="contact-wrapper">
        {/* <Suspense fallback={null}>
          <SpaceContactCanvas />
        </Suspense> */}
        <div className="wrapper">
          <Suspense fallback={null}>
            <ContactForm />
          </Suspense>
        </div>
      </section>
    </>
  );
}
