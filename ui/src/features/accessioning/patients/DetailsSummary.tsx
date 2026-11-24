import type { ReactNode } from "react";
import { Facts } from "@/components/Facts";
import { Section } from "@/components/Section";
import { optionalText } from "@/lib/choices";
import { identifierText, orNotRecorded } from "../subjects";
import { NO_PORTAL_EMAIL } from "./portalEmail";
import { type PatientDetailsValues, trimIdentifier } from "./registration";

/** The details about to be registered, as typed. */
export function DetailsSummary({
  details,
  action,
}: {
  details: PatientDetailsValues;
  action: ReactNode;
}) {
  return (
    <Section title="Details to register">
      <Facts
        items={[
          { label: "Family name", value: details.familyName.trim() },
          { label: "Given names", value: orNotRecorded(optionalText(details.givenNames)) },
          { label: "Birth date", value: details.birthDate.trim() },
          {
            label: "Administrative sex",
            value: orNotRecorded(optionalText(details.administrativeSex)),
          },
          { label: "Source", value: details.source.trim() },
          { label: "Identifiers", value: identifierText(details.identifiers.map(trimIdentifier)) },
          { label: "Email", value: optionalText(details.email) ?? NO_PORTAL_EMAIL },
        ]}
      />
      <div>{action}</div>
    </Section>
  );
}
