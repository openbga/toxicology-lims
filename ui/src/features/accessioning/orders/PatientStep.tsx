import { Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { FindField } from "@/components/FindField";
import { LoadingState } from "@/components/LoadingState";
import { Section } from "@/components/Section";
import type { FindOrderPatientsInput } from "@/generated/FindOrderPatientsInput";
import type { OrderPatientChoice } from "@/generated/OrderPatientChoice";
import type { OrderPatientChoices } from "@/generated/OrderPatientChoices";
import { useCommandQuery } from "@/lib/commands";
import { subjectName } from "../subjects";
import { FIND_ORDER_PATIENTS } from "./contract";
import { ExactSearch } from "./ExactSearch";
import { PatientChoiceGrid } from "./PatientChoiceGrid";
import styles from "./PatientStep.module.css";

/** Most matching patients listed; a narrower search finds the rest. */
const MATCH_LIMIT = 25;
const REGISTRATION_PATH = "/patients/register?intent=new-order";

interface PatientStepProps {
  onChoose: (subjectId: string) => void;
}

/**
 * The first step of New order (REQ-ORD-001, REQ-IDN-001): one box finds patients by name,
 * birth date or identifier while typing, recent patients are one click away, and the exact
 * searches stay folded below. Every read is audited by the engine; the find text stays in
 * memory, out of the address and browser storage.
 */
export function PatientStep({ onChoose }: PatientStepProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [exact, setExact] = useState(false);
  const input: FindOrderPatientsInput = { query: query.trim() || null, limit: MATCH_LIMIT };
  const found = useCommandQuery<OrderPatientChoices>(
    FIND_ORDER_PATIENTS,
    { input },
    { keepPrevious: true },
  );
  return (
    <Section title="Who is the order for?">
      <FindField
        label="Find patient by name, birth date or identifier"
        placeholder="Name, birth date (YYYY-MM-DD) or identifier"
        isLabelHidden
        isWide
        autoFocus
        value={query}
        onChange={setQuery}
      />
      {found.isPending ? (
        <LoadingState label="Loading patients…" />
      ) : found.isError ? (
        <ErrorState
          title="Patients could not be loaded"
          error={found.error}
          onRetry={() => void found.refetch()}
        />
      ) : (
        <>
          <RecentPatients recent={found.data.recent} onChoose={onChoose} />
          {query.trim() && (
            <Matches query={query.trim()} matches={found.data.matches} onChoose={onChoose} />
          )}
        </>
      )}
      <div className={styles.register}>
        <Plus aria-hidden="true" />
        <p>
          <strong>Not in the list?</strong> Register the patient. You come back here with the
          patient chosen.
        </p>
        <Button onPress={() => navigate(REGISTRATION_PATH)}>Register patient</Button>
      </div>
      <details className={styles.exact} onToggle={(event) => setExact(event.currentTarget.open)}>
        <summary>
          Exact search{" "}
          <span className={styles.muted}>
            By identifier (identifier, assigning authority, type) or by family name, given names and
            birth date
          </span>
        </summary>
        {exact && (
          <ExactSearch
            onChoose={(subject) => onChoose(subject.subjectId)}
            registrationPath={REGISTRATION_PATH}
          />
        )}
      </details>
    </Section>
  );
}

interface RecentPatientsProps {
  recent: readonly OrderPatientChoice[];
  onChoose: (subjectId: string) => void;
}

/** The patients the signed-in user entered orders for most recently, newest first. */
function RecentPatients({ recent, onChoose }: RecentPatientsProps) {
  if (recent.length === 0) return null;
  return (
    <fieldset aria-label="Recent patients" className={styles.recent}>
      <span className={styles.muted}>Recent:</span>
      {recent.map(({ subject }) => (
        <Button key={subject.subjectId} onPress={() => onChoose(subject.subjectId)}>
          {`${subjectName(subject)} · ${subject.birthDate}`}
        </Button>
      ))}
    </fieldset>
  );
}

interface MatchesProps {
  query: string;
  matches: readonly OrderPatientChoice[];
  onChoose: (subjectId: string) => void;
}

function Matches({ query, matches, onChoose }: MatchesProps) {
  const count =
    matches.length === 0
      ? `No patients match “${query}”`
      : `${matches.length === MATCH_LIMIT ? "First " : ""}${matches.length} ${
          matches.length === 1 ? "patient matches" : "patients match"
        } “${query}”`;
  return (
    <>
      <p role="status" className={styles.count}>
        {count}
      </p>
      {matches.length > 0 && <PatientChoiceGrid choices={matches} onChoose={onChoose} />}
    </>
  );
}
