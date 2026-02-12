import { EmploymentHistory } from "./components/EmploymentHistory/EmploymentHistory";

export function App() {
  return (
    <div className="wrapper">
      <section className="hero">
        <h1>
          Hi, I’m Brian.{" "}
          <span className="soft">
            Principal Software Engineer. Let’s get to work.
          </span>
        </h1>
      </section>
      <div className="what-i-do">
        <p>
          I build software that works and lasts. I’ve led teams, shipped cloud
          platforms, and improved code, all with one goal: make things run well.
        </p>
        <p>
          No fluff, no endless meetings—just focused effort. I care about
          results, clear process, and making sure the work stands up to
          real-world use.
        </p>
        <p>
          Every project needs honest feedback and strong execution. If you want
          straight answers, real progress, and a transparent approach, let’s
          talk.
        </p>
      </div>
      <EmploymentHistory />
    </div>
  );
  // return <>test</>;
}
