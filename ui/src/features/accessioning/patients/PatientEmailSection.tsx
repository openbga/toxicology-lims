import { useState } from "react";
import { Button } from "@/components/Button";
import { Facts } from "@/components/Facts";
import { TextInput } from "@/components/FormFields";
import { Section } from "@/components/Section";
import { Timestamp } from "@/components/Timestamp";
import type { SetSubjectEmail } from "@/generated/SetSubjectEmail";
import type { SubjectEmailSet } from "@/generated/SubjectEmailSet";
import type { SubjectView } from "@/generated/SubjectView";
import { CommandDialog } from "@/lib/CommandDialog";
import { optionalText } from "@/lib/choices";
import { useHasCapability } from "@/lib/commands";
import { NO_PORTAL_EMAIL, PORTAL_EMAIL_CONSENT, validatePortalEmail } from "./portalEmail";

/**
 * The patient's email for the LIMSiq Patient Portal: the patient's consent to portal delivery.
 * Changing or removing it keeps the earlier value in the patient's history.
 */
export function PatientEmailSection({ subject }: { subject: SubjectView }) {
  const canEdit = useHasCapability("enter_orders");
  const [editing, setEditing] = useState<SubjectView | null>(null);
  const email = subject.email;
  return (
    <Section
      title="Patient portal"
      actions={
        canEdit && (
          <Button onPress={() => setEditing(subject)}>
            {email ? "Change email" : "Add email"}
          </Button>
        )
      }
    >
      <Facts
        items={[
          { label: "Email", value: email ? email.address : NO_PORTAL_EMAIL },
          ...(email ? [{ label: "Recorded", value: <Timestamp value={email.recordedAt} /> }] : []),
        ]}
      />
      {editing && (
        <CommandDialog<{ email: string }, SetSubjectEmail, SubjectEmailSet>
          title={email ? "Change patient email" : "Add patient email"}
          submitLabel="Save email"
          command={{ name: "set_subject_email", invalidates: ["get_subject"] }}
          defaultValues={{ email: email?.address ?? "" }}
          toInput={(values) => ({
            subjectId: editing.id,
            expectedRevision: editing.revision,
            email: optionalText(values.email),
          })}
          successTitle={(_, result) => (result.hasEmail ? "Email saved" : "Email removed")}
          onClose={() => setEditing(null)}
        >
          <TextInput
            name="email"
            label="Email"
            description={`${PORTAL_EMAIL_CONSENT} Clear the field to remove the email.`}
            validate={validatePortalEmail}
            autoFocus
          />
        </CommandDialog>
      )}
    </Section>
  );
}
