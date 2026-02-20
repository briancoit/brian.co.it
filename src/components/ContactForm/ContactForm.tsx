import { memo, useRef, useState } from "react";
import styles from "./ContactForm.module.css";

type Status = "idle" | "submitting" | "success" | "error";

export const ContactForm = memo(function ContactForm(): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>("idle");

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;

    setStatus("submitting");

    try {
      const res = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(
          new FormData(form) as unknown as Record<string, string>,
        ).toString(),
      });
      if (!res.ok) {
        throw new Error("Network response was not ok");
      }

      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className={styles.contact}>
      <h2>Let's talk</h2>
      {status === "success" ? (
        <p className={`${styles.formStatus} ${styles.success}`}>
          Thanks! I'll be in touch.
        </p>
      ) : (
        <form
          ref={formRef}
          name="contact"
          method="POST"
          data-netlify="true"
          netlify-honeypot="bot-field"
          onSubmit={handleSubmit}
        >
          <input type="hidden" name="form-name" value="contact" />
          <p className="hidden">
            <label>
              Don't fill this out: <input name="bot-field" />
            </label>
          </p>
          <div className={styles.formGroup}>
            <label htmlFor="name">Name</label>
            <input
              type="text"
              id="name"
              name="name"
              autoComplete="name"
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              name="message"
              rows={5}
              autoComplete="off"
              required
            />
          </div>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={status === "submitting"}
          >
            Send
          </button>
          {status === "error" && (
            <p className={`${styles.formStatus} ${styles.error}`}>
              Something went wrong. Please try again.
            </p>
          )}
        </form>
      )}
    </section>
  );
});
