import { Info } from "lucide-react";
import { Button, Tooltip, TooltipTrigger } from "react-aria-components";
import styles from "./InfoTip.module.css";

/**
 * An info icon beside a label that shows `text` on hover or keyboard focus, for help that
 * would crowd the form if always shown. Screen readers hear it as the icon's description.
 */
export function InfoTip({ label, text }: { label: string; text: string }) {
  return (
    <TooltipTrigger delay={200}>
      <Button className={styles.trigger} aria-label={`About ${label}`}>
        <Info aria-hidden="true" size={14} />
      </Button>
      <Tooltip placement="top" className={styles.tooltip}>
        {text}
      </Tooltip>
    </TooltipTrigger>
  );
}
