import { useId } from "react";

export type EmploymentHistoryItemProps = {
  dateStart?: Date;
  dateEnd?: Date;
  title: string;
  company: string;
  description?: React.ReactNode;
};

const DATE_FORMATTER_DATETIME_ATTR = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
});
const DATE_FORMATTER_DISPLAY = new Intl.DateTimeFormat("en-GB", {
  year: "2-digit",
  month: "short",
});

export function EmploymentHistoryItem({
  title,
  company,
  dateEnd,
  dateStart,
  description,
}: EmploymentHistoryItemProps): React.JSX.Element {
  const id = useId();

  return (
    <section className="job" aria-labelledby={id}>
      {dateStart || dateEnd ? (
        <p className="job-date">
          {dateStart ? <Time date={dateStart} /> : "unknown"}
          {" - "}
          {dateEnd ? <Time date={dateEnd} /> : "Present"}
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

type TimeProps = {
  date: Date;
};

function Time({ date }: TimeProps): React.JSX.Element {
  return (
    <time
      dateTime={DATE_FORMATTER_DATETIME_ATTR.format(date).replace(/\//, "-")}
    >
      {DATE_FORMATTER_DISPLAY.format(date)}
    </time>
  );
}
