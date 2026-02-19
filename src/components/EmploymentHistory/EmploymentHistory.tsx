import { memo } from "react";
import LinkedInIcon from "../../linkedin.svg?react";
import { EmploymentHistoryItem } from "./EmploymentHistoryItem";

export const EmploymentHistory = memo(function EmploymentHistory() {
  return (
    <div>
      <div className="timeline">
        <EmploymentHistoryItem
          title="Principal Engineer"
          company="Dare International"
          dateStart={new Date("2023-05-01")}
          // dateEnd={new Date("2026-04-01")}
        />
        <EmploymentHistoryItem
          title="Principal Engineer"
          company="Trustpilot"
          dateStart={new Date("2021-03-01")}
          dateEnd={new Date("2023-05-01")}
        />
        <EmploymentHistoryItem
          title="Senior Principal Engineer"
          company="Wood Mackenzie"
          dateStart={new Date("2018-03-01")}
          dateEnd={new Date("2021-03-01")}
        />
        {/* <EmploymentHistoryItem
        title="Engineer"
        company="Peoples Postcode Lottery"
        dateStart={new Date("2017-03-01")}
        dateEnd={new Date("2017-12-01")}
      />
      <EmploymentHistoryItem
        title="Principal Engineer"
        company="Signal / Blonde Digital"
        dateStart={new Date("2012-03-01")}
        dateEnd={new Date("2017-03-01")}
      />
      <EmploymentHistoryItem
        title="Engineer"
        company="Line Digital"
        dateStart={new Date("2010-03-01")}
        dateEnd={new Date("2012-03-01")}
      /> */}
      </div>
      <LinkedInIcon width={48} height={48} />
    </div>
  );
});
