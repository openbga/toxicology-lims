import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Breadcrumb, Breadcrumbs, Link } from "react-aria-components";
import { useRecordSwitching } from "@/lib/recordQuery";
import styles from "./Page.module.css";
import { type SequenceLinks, SequenceNav } from "./SequenceNav";

/** One step of a breadcrumb. */
interface Crumb {
  label: string;
  href: string;
}

interface PageHeaderProps {
  /** The page's only `h1`: the navigation label, or a record's identifier and name. */
  title: string;
  description?: string;
  /** Page-level buttons, aligned to the end. */
  actions?: ReactNode;
  /** Record pages: the list first and this page last, as "Tests and panels › TOXDEF". */
  breadcrumbs?: readonly Crumb[];
  /** A record's status, such as a `StatusBadge`, beside the `h1`. */
  status?: ReactNode;
  /** A record's several status chips, in a row under the `h1`. */
  chips?: ReactNode;
  /** Record pages opened from a list: Previous and Next in its order (`useRecordSequence`). */
  sequence?: SequenceLinks | null;
}

/** The header of one screen: breadcrumb, `h1` with status, description, and actions. */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  status,
  chips,
  sequence,
}: PageHeaderProps) {
  const switching = useRecordSwitching();
  const hasEnd = Boolean(actions) || Boolean(sequence);
  return (
    <header className={styles.header}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <Breadcrumbs className={styles.breadcrumbs}>
            {breadcrumbs.map((crumb) => (
              <Breadcrumb id={crumb.href} key={crumb.href} className={styles.crumb}>
                {({ isCurrent }) => (
                  <>
                    <Link href={crumb.href} className={styles.crumbLink}>
                      {crumb.label}
                    </Link>
                    {!isCurrent && <ChevronRight aria-hidden="true" className={styles.icon} />}
                  </>
                )}
              </Breadcrumb>
            ))}
          </Breadcrumbs>
        </nav>
      )}
      <div className={styles.titleRow}>
        <div className={styles.heading}>
          <div className={styles.titleLine}>
            <h1 className={styles.title}>{title}</h1>
            {status}
          </div>
          {chips && <div className={styles.chips}>{chips}</div>}
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {hasEnd && (
          <div className={styles.actions}>
            {sequence && <SequenceNav sequence={sequence} />}
            {actions && (
              <div
                className={switching ? `${styles.pageActions} ${styles.stale}` : styles.pageActions}
                inert={switching}
              >
                {actions}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
