import { memo, useId } from "react";
import styles from "./EmploymentHistoryItem.module.css";

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

export const EmploymentHistoryItem = memo(function EmploymentHistoryItem({
  title,
  company,
  dateEnd,
  dateStart,
  description,
}: EmploymentHistoryItemProps): React.JSX.Element {
  const id = useId();

  return (
    <div className={styles.timelineItem}>
      {dateStart || dateEnd ? (
        <p className={styles.jobDate}>
          {dateStart ? <Time date={dateStart} /> : "unknown"}
          {" - "}
          {dateEnd ? <Time date={dateEnd} /> : "Present"}
        </p>
      ) : null}

      <div className={styles.jobContent}>
        <h3 id={id}>
          {title}, <span className={styles.company}>{company}</span>
        </h3>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
});

type TimeProps = {
  date: Date;
};

const Time = memo(function Time({ date }: TimeProps): React.JSX.Element {
  return (
    <time
      dateTime={DATE_FORMATTER_DATETIME_ATTR.format(date).replace(/\//, "-")}
    >
      {DATE_FORMATTER_DISPLAY.format(date)}
    </time>
  );
});
