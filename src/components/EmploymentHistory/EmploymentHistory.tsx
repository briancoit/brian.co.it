import { EmploymentHistoryItem } from "./EmploymentHistoryItem";

export function EmploymentHistory() {
  return (
    <div>
      <EmploymentHistoryItem
        title="Principal Engineer"
        company="Dare"
        dateStart="May 23"
        dateEnd="Apr 25"
      />
      <EmploymentHistoryItem
        title="Principal Engineer"
        company="Trustpilot"
        dateStart="Mar 21"
        dateEnd="May 23"
      />
      <EmploymentHistoryItem
        title="Senior Principal Engineer"
        company="Wood Mackenzie"
        dateStart="Mar 18"
        dateEnd="Mar 21"
      />
      <EmploymentHistoryItem
        title="Engineer"
        company="Peoples Postcode Lottery"
        dateStart="Mar 17"
        dateEnd="Dec 17"
      />
      <EmploymentHistoryItem
        title="Principal Engineer"
        company="Signal / Blonde Digital"
        dateStart="Mar 12"
        dateEnd="Mar 17"
      />
      <EmploymentHistoryItem
        title="Engineer"
        company="Line Digital"
        dateStart="Mar 10"
        dateEnd="Mar 12"
      />
    </div>
  );
}
