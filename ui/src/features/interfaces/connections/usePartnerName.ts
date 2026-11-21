import { useCallback } from "react";
import type { ClientView } from "@/generated/ClientView";
import type { PartnerConnectionSettings } from "@/generated/PartnerConnectionSettings";
import { useCommandQuery } from "@/lib/commands";
import { LIST_CLIENTS } from "../contract";
import { isIncoming } from "../labels";

/**
 * A connection's partner as people know it (#4888): for incoming orders the client's name, as
 * the connection keeps the client by code; for a connection that sends, the text entered. The
 * code shows until the clients are read, or for a client not found.
 */
export function usePartnerName(): (settings: PartnerConnectionSettings) => string {
  const clients = useCommandQuery<ClientView[]>(LIST_CLIENTS).data;
  return useCallback(
    ({ messageType, partner }) => {
      if (!isIncoming(messageType)) return partner;
      return clients?.find((client) => client.code === partner)?.name ?? partner;
    },
    [clients],
  );
}
