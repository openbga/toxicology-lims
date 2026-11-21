import type { ReactNode } from "react";
import { BrandLockup } from "@/components/BrandLockup";
import type { AppInfo } from "@/generated/AppInfo";
import type { SetupStatus } from "@/generated/SetupStatus";
import { useCommandQuery } from "@/lib/commands";
import styles from "./auth.module.css";
import { SETUP_STATUS } from "./contract";

interface AuthLayoutProps {
  children: ReactNode;
  aside?: ReactNode;
  /** Names the laboratory under the product, on the setup, sign-in and lock screens. */
  showLaboratory?: boolean;
}

/**
 * The centered frame of the signed-out screens: the product, the laboratory's name under it,
 * the screen, then the analyzers and the running version below the card (ticket #4885).
 */
export function AuthLayout({ children, aside, showLaboratory }: AuthLayoutProps) {
  // A public read; without an answer the line is left out.
  const version = useCommandQuery<AppInfo>("app_info").data?.appVersion;
  return (
    <main className={styles.layout}>
      <div className={styles.card}>
        <div className={styles.identity}>
          <p className={styles.appName}>
            <BrandLockup />
          </p>
          {showLaboratory && <LaboratoryName />}
        </div>
        {children}
      </div>
      {aside && <div className={styles.aside}>{aside}</div>}
      {version && <p className={styles.version}>Version {version}</p>}
    </main>
  );
}

/**
 * The current laboratory profile's name, from the public setup status the signed-out screens
 * already read; left out before a profile exists or when it cannot be read.
 */
function LaboratoryName() {
  const name = useCommandQuery<SetupStatus>(SETUP_STATUS).data?.laboratoryName;
  return name ? <p className={styles.labName}>{name}</p> : null;
}
