import { useState } from "react";
import type { SubjectSearch } from "@/generated/SubjectSearch";
import type { SubjectSummary } from "@/generated/SubjectSummary";
import { PatientSearch } from "../patients/PatientSearch";
import { SearchResults } from "../patients/SearchResults";
import styles from "./PatientStep.module.css";

interface ExactSearchProps {
  onChoose: (subject: SubjectSummary) => void;
  registrationPath: string;
}

/**
 * The exact searches of the Patient step (REQ-IDN-001): the identifier and name fields are
 * shown directly, and patients are read only after a search runs. The search text stays in
 * memory, out of the address and browser storage.
 */
export function ExactSearch({ onChoose, registrationPath }: ExactSearchProps) {
  const [criteria, setCriteria] = useState<SubjectSearch | null>(null);
  return (
    <>
      <PatientSearch onSearch={(input) => setCriteria({ ...input, offset: 0 })} />
      {criteria && (
        <SearchResults
          criteria={criteria}
          filtered
          onChoose={onChoose}
          registrationPath={registrationPath}
          onClear={() => setCriteria(null)}
          onPage={(offset) => setCriteria({ ...criteria, offset })}
          toolbar={(count) => (
            <p role="status" className={styles.count}>
              {count}
            </p>
          )}
        />
      )}
    </>
  );
}
