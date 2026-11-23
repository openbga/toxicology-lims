import { DetailPanel } from "@/components/DetailPanel";
import { Facts } from "@/components/Facts";
import { type ActionItem, RecordActions } from "@/components/RowActions";
import type { UserSummary } from "@/generated/UserSummary";
import type { OpenRecord } from "@/lib/openRecord";
import { Authenticator, authenticationLabel, Lockout, StatusTag } from "./userColumns";
import styles from "./users.module.css";

interface UserPanelProps {
  user: UserSummary;
  roleNames: (user: UserSummary) => string;
  /** The actions offered on this account; the first is the main one, unless destructive. */
  actions: readonly ActionItem[];
  /** The account is the signed-in person's own. */
  own: boolean;
  record: OpenRecord;
}

/** One account in view mode: roles, status and sign-in state, and the changes offered. */
export function UserPanel({ user, roleNames, actions, own, record }: UserPanelProps) {
  return (
    <DetailPanel
      identifier={user.displayName}
      status={<StatusTag user={user} />}
      actions={actions.length > 0 && <RecordActions items={actions} />}
      onClose={record.close}
      onPrevious={record.previous}
      onNext={record.next}
    >
      {own && (
        <p className={styles.panelNote}>
          Ask someone else to change your own roles or reset your sign-in.
        </p>
      )}
      <Facts
        items={[
          { label: "Username", value: user.username },
          { label: "Roles", value: roleNames(user) },
          { label: "Sign-in method", value: authenticationLabel(user) },
          { label: "Authenticator", value: <Authenticator user={user} /> },
          { label: "Sign-in lockout", value: <Lockout user={user} /> },
        ]}
      />
    </DetailPanel>
  );
}
