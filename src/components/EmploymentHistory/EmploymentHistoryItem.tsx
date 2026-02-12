import type { ReactNode } from "react";
import { buildSafeId } from "../../util/id";

export type EmploymentHistoryItemProps = {
  dateStart?: string;
  dateEnd?: string;
  title: string;
  company: string;
  description?: ReactNode;
};

export function EmploymentHistoryItem({
  title,
  company,
  dateEnd,
  dateStart,
  description,
}: EmploymentHistoryItemProps) {
  const id = buildSafeId(title);

  return (
    <section className="job" aria-labelledby={id}>
      {dateStart || dateEnd ? (
        <p className="job-date">
          <time dateTime={dateStart}>{dateStart}</time>
          {" - "}
          <time dateTime={dateEnd}>{dateEnd}</time>
        </p>
      ) : null}

      <div className="job-content">
        <h3 id={id}>
          {title}, <span className="company">{company}</span>
        </h3>
        {description ? <p>{description}</p> : null}
      </div>
    </section>
  );
}
