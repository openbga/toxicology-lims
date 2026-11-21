import {
  Check,
  ChevronDown,
  Copy,
  Info,
  Key,
  Lock,
  LogOut,
  RectangleEllipsis,
  Usb,
  UserRound,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  Header,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  Separator,
  VisuallyHidden,
} from "react-aria-components";
import { useNavigate } from "react-router";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import type { AppInfo } from "@/generated/AppInfo";
import type { CommandError } from "@/generated/CommandError";
import type { RoleCode } from "@/generated/RoleCode";
import type { SessionInfo } from "@/generated/SessionInfo";
import { APPEARANCES, type Appearance, useAppearance } from "@/lib/appearance";
import { useCommandMutation, useCommandQuery } from "@/lib/commands";
import { toUserMessage } from "@/lib/errors";
import type { AuthenticationStatus } from "@/lib/securityKey";
import { unsavedFormNames } from "@/lib/unsavedForms";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { SecurityKeysDialog } from "./SecurityKeysDialog";
import { UnlockPinDialog } from "./UnlockPinDialog";
import styles from "./UserMenu.module.css";

/**
 * The signed-in person's menu, top to bottom: who is signed in (ticket #4869); Account security
 * (change password, security keys, unlock PIN settings); Appearance (light, dark or the system's
 * setting, applied at once); "About this app" and the running version, which copies itself
 * (tickets #4584, #4745); then, after a line, Lock now and Sign out, last (ticket #4868). Lock and
 * sign-out clear every cached engine result, so nothing from this session is shown to the next
 * person (REQ-IDN-004). Sign out asks first while a page form has unsaved input (ticket #4585).
 */
export function UserMenu({ session }: { session: SessionInfo }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [changingPassword, setChangingPassword] = useState(false);
  const [managingKeys, setManagingKeys] = useState(false);
  const [managingPin, setManagingPin] = useState(false);
  const [leavingForms, setLeavingForms] = useState<string[]>([]);
  const signedInId = useId();
  const lock = useCommandMutation<null>("lock_session", { invalidates: "all" });
  const signOut = useCommandMutation<null>("sign_out", { invalidates: "all" });
  const onError = (error: CommandError) =>
    toast.show({
      tone: "danger",
      title: "The session did not change",
      description: toUserMessage(error),
    });
  const signOutNow = () => {
    setLeavingForms([]);
    signOut.mutate({}, { onError });
  };

  return (
    <>
      <MenuTrigger>
        <Button variant="quiet" isPending={lock.isPending || signOut.isPending}>
          <UserRound aria-hidden="true" />
          <VisuallyHidden>Signed in as </VisuallyHidden>
          {session.displayName}
          <ChevronDown aria-hidden="true" />
        </Button>
        <Popover placement="bottom end" className={styles.popover}>
          <SignedInAs id={signedInId} session={session} />
          <Menu className={styles.menu} aria-describedby={`${signedInId}-name ${signedInId}-roles`}>
            <AccountSecuritySection
              onChangePassword={() => setChangingPassword(true)}
              onSecurityKeys={() => setManagingKeys(true)}
              onUnlockPin={() => setManagingPin(true)}
            />
            <Separator className={styles.separator} />
            <AppearanceSection userId={session.userId} />
            <Separator className={styles.separator} />
            <MenuItem
              className={styles.item}
              textValue="About this app"
              onAction={() => navigate("/about")}
            >
              <Info aria-hidden="true" className={styles.icon} />
              About this app
            </MenuItem>
            <VersionItem />
            <SessionItems
              onLock={() => lock.mutate({}, { onError })}
              onSignOut={() => {
                const forms = unsavedFormNames();
                if (forms.length > 0) setLeavingForms(forms);
                else signOutNow();
              }}
            />
          </Menu>
        </Popover>
      </MenuTrigger>
      <ChangePasswordDialog isOpen={changingPassword} onClose={() => setChangingPassword(false)} />
      {managingKeys && (
        <SecurityKeysDialog session={session} onClose={() => setManagingKeys(false)} />
      )}
      {managingPin && <UnlockPinDialog onClose={() => setManagingPin(false)} />}
      <LeaveWithoutSavingDialog
        forms={leavingForms}
        onCancel={() => setLeavingForms([])}
        onConfirm={signOutNow}
      />
    </>
  );
}

/** Sign out asks first while a page form has unsaved input; Cancel is the default (ticket #4585). */
function LeaveWithoutSavingDialog({
  forms,
  onCancel,
  onConfirm,
}: {
  forms: string[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      title="Leave without saving?"
      isOpen={forms.length > 0}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel();
      }}
      confirmLabel="Sign out without saving"
      onConfirm={onConfirm}
    >
      <p>
        You have unsaved changes in {forms.join(", ")}. If you sign out, what you typed is lost.
      </p>
    </ConfirmDialog>
  );
}

/**
 * Account security (ticket #4868): Change password (password accounts only), Security keys and
 * Unlock PIN settings, each with its own icon.
 */
function AccountSecuritySection({
  onChangePassword,
  onSecurityKeys,
  onUnlockPin,
}: {
  onChangePassword: () => void;
  onSecurityKeys: () => void;
  onUnlockPin: () => void;
}) {
  const authentication = useCommandQuery<AuthenticationStatus>("get_authentication_status");
  return (
    <MenuSection>
      <Header className={styles.header}>Account security</Header>
      {authentication.data?.method === "password_totp" && (
        <MenuItem className={styles.item} textValue="Change password" onAction={onChangePassword}>
          <Key aria-hidden="true" className={styles.icon} />
          Change password
        </MenuItem>
      )}
      <MenuItem className={styles.item} textValue="Security keys" onAction={onSecurityKeys}>
        <Usb aria-hidden="true" className={styles.icon} />
        Security keys
      </MenuItem>
      <MenuItem className={styles.item} textValue="Unlock PIN settings" onAction={onUnlockPin}>
        <RectangleEllipsis aria-hidden="true" className={styles.icon} />
        Unlock PIN settings
      </MenuItem>
    </MenuSection>
  );
}

/** The session actions, at the bottom after a line; Sign out is the last item (ticket #4868). */
function SessionItems({ onLock, onSignOut }: { onLock: () => void; onSignOut: () => void }) {
  return (
    <>
      <Separator className={styles.separator} />
      <MenuItem className={styles.item} textValue="Lock now" onAction={onLock}>
        <Lock aria-hidden="true" className={styles.icon} />
        Lock now
      </MenuItem>
      <MenuItem className={styles.item} textValue="Sign out" onAction={onSignOut}>
        <LogOut aria-hidden="true" className={styles.icon} />
        Sign out
      </MenuItem>
    </>
  );
}

/** Light, Dark or System, applied at once and remembered for this account on this computer. */
function AppearanceSection({ userId }: { userId: string }) {
  const [appearance, chooseAppearance] = useAppearance(userId);
  return (
    <MenuSection
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[appearance]}
      onSelectionChange={(keys) => {
        const [key] = keys === "all" ? [] : keys;
        if (key !== undefined) chooseAppearance(key as Appearance);
      }}
    >
      <Header className={styles.header}>Appearance</Header>
      {APPEARANCES.map((option) => (
        <MenuItem key={option.id} id={option.id} className={styles.item} textValue={option.label}>
          {({ isSelected }) => (
            <>
              <Check
                aria-hidden="true"
                className={styles.icon}
                visibility={isSelected ? "visible" : "hidden"}
              />
              {option.label}
            </>
          )}
        </MenuItem>
      ))}
    </MenuSection>
  );
}

/** Every role, so the menu can say "All roles" instead of listing all eight (ticket #4869). */
const ROLE_CODES: Record<RoleCode, true> = {
  accessioner: true,
  analyst: true,
  technical_reviewer: true,
  releaser: true,
  quality_manager: true,
  billing: true,
  auditor: true,
  administrator: true,
};

/** "All roles", "No roles" or the roles' short names, as the engine names them. */
function rolesText(session: SessionInfo): string {
  if (new Set(session.roles).size === Object.keys(ROLE_CODES).length) return "All roles";
  return session.roleLabels.length === 0 ? "No roles" : session.roleLabels.join(", ");
}

/**
 * Who is signed in, at the top of the menu: the name, then the roles (ticket #4869). It is
 * information only, outside the menu's items, so it takes no focus; the menu names it as its
 * description so a screen reader reads it when the menu opens.
 */
function SignedInAs({ id, session }: { id: string; session: SessionInfo }) {
  return (
    <div className={styles.signedIn}>
      <span id={`${id}-name`} className={styles.signedInName}>
        {session.displayName}
      </span>
      <span id={`${id}-roles`} className={styles.signedInRoles}>
        {rolesText(session)}
      </span>
    </div>
  );
}

/** How long "Copied" or "Not copied" shows after the version row is chosen. */
const COPY_RESULT_SHOWN_MS = 2000;

/**
 * The running version, after About this app and from the same `app_info` query. A menu holds only items,
 * so the whole row copies the version; a small copy icon right after the version, in the same
 * text style, is the hint (ticket #4745). The menu stays open to show "Copied" briefly.
 */
function VersionItem() {
  const info = useCommandQuery<AppInfo>("app_info");
  const [copy, setCopy] = useState<"idle" | "Copied" | "Not copied">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const version = info.data?.appVersion;
  if (version === undefined) return null;
  const show = (result: "Copied" | "Not copied") => {
    setCopy(result);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopy("idle"), COPY_RESULT_SHOWN_MS);
  };
  return (
    <>
      <Separator className={styles.separator} />
      <MenuItem
        className={styles.item}
        textValue={`Version ${version}`}
        aria-label={
          copy === "idle" ? `Copy version ${version}` : `Version ${version} ${copy.toLowerCase()}`
        }
        shouldCloseOnSelect={false}
        onAction={() =>
          void navigator.clipboard.writeText(version).then(
            () => show("Copied"),
            () => show("Not copied"),
          )
        }
      >
        <span className={styles.version}>
          Version {version}
          {copy === "Copied" ? (
            <Check aria-hidden="true" className={styles.copyIcon} />
          ) : (
            <Copy aria-hidden="true" className={styles.copyIcon} />
          )}
          {copy !== "idle" && copy}
        </span>
      </MenuItem>
    </>
  );
}
