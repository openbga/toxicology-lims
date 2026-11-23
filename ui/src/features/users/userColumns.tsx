import type { DataGridColumn } from "@/components/DataGrid";
import { StatusBadge } from "@/components/StatusBadge";
import type { RoleInfo } from "@/generated/RoleInfo";
import type { UserSummary } from "@/generated/UserSummary";

/** A user's roles as the engine's role labels, such as "Analyst, Auditor". */
function roleListOf(roles: readonly RoleInfo[]): (user: UserSummary) => string {
  const labels = new Map<string, string>(roles.map((role) => [role.code, role.label]));
  return (user) => user.roles.map((code) => labels.get(code) ?? code).join(", ") || "No roles";
}

/** Like `roleListOf`, but "All roles" for a user who holds every role the catalog has. */
export function roleNamesOf(roles: readonly RoleInfo[]): (user: UserSummary) => string {
  const list = roleListOf(roles);
  return (user) =>
    roles.length > 0 && roles.every((role) => user.roles.includes(role.code))
      ? "All roles"
      : list(user);
}

export function StatusTag({ user }: { user: UserSummary }) {
  return (
    <StatusBadge tone={user.status === "active" ? "success" : "neutral"}>
      {statusLabel(user)}
    </StatusBadge>
  );
}

const statusLabel = (user: UserSummary) =>
  user.status === "active" ? "Active" : "Disabled";

export const authenticationLabel = (user: UserSummary) =>
  user.authenticationMethod === "security_key" ? "Security key" : "Password + authenticator app";

export function Authenticator({ user }: { user: UserSummary }) {
  return user.mfaEnrolled ? (
    <StatusBadge tone="success">Set up</StatusBadge>
  ) : (
    <StatusBadge tone="warning">Not set up</StatusBadge>
  );
}

export function Lockout({ user }: { user: UserSummary }) {
  return user.lockedOut ? <StatusBadge tone="warning">Locked out</StatusBadge> : "None";
}

/** The user grid's columns; role codes show as the engine's role labels. */
export function userColumns(
  roles: readonly RoleInfo[],
  /** Beside the side panel the list keeps only the columns that identify a user. */
  compact = false,
): DataGridColumn<UserSummary>[] {
  const roleNames = roleNamesOf(roles);
  const roleList = roleListOf(roles);
  const all: DataGridColumn<UserSummary>[] = [
    {
      id: "username",
      header: "Username",
      identifier: true,
      cell: (user) => user.username,
      sortValue: (user) => user.username,
      width: 160,
    },
    {
      id: "displayName",
      header: "Display name",
      cell: (user) => user.displayName,
      sortValue: (user) => user.displayName,
    },
    {
      id: "roles",
      header: "Roles",
      cell: (user) => <span title={roleList(user)}>{roleNames(user)}</span>,
      sortValue: roleNames,
    },
    {
      id: "authentication",
      header: "Sign-in method",
      cell: authenticationLabel,
      sortValue: authenticationLabel,
    },
    {
      id: "mfa",
      header: "Authenticator",
      cell: (user) => <Authenticator user={user} />,
      sortValue: (user) => (user.mfaEnrolled ? 1 : 0),
      width: 150,
    },
    {
      id: "status",
      header: "Status",
      cell: (user) => <StatusTag user={user} />,
      sortValue: (user) => user.status,
      width: 130,
    },
    {
      id: "lockout",
      header: "Sign-in lockout",
      cell: (user) => <Lockout user={user} />,
      sortValue: (user) => (user.lockedOut ? 1 : 0),
      width: 150,
    },
  ];
  if (!compact) return all;
  // Without a fixed width the three columns share the list's width in equal parts.
  return all
    .filter((column) => COMPACT_COLUMNS.includes(column.id))
    .map((column) => ({ ...column, width: undefined }));
}

const COMPACT_COLUMNS = ["username", "displayName", "status"];
