import React from "react";
import { RequestStatus } from "@/types";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  RequestStatus,
  { label: string; className: string }
> = {
  EN_ATTENTE_DEPT: {
    label: "Att. Département",
    className:
      "bg-status-pending-bg text-status-pending border-status-pending/30",
  },
  REFUSEE_DEPT: {
    label: "Refusée (Dept)",
    className:
      "bg-status-rejected-bg text-status-rejected border-status-rejected/30",
  },
  EN_ATTENTE_STOCK: {
    label: "Att. Stock",
    className: "bg-status-stock-bg text-status-stock border-status-stock/30",
  },
  REFUSEE_STOCK: {
    label: "Refusée (Stock)",
    className:
      "bg-status-rejected-bg text-status-rejected border-status-rejected/30",
  },
  VALIDEE: {
    label: "Validée",
    className:
      "bg-status-approved-bg text-status-approved border-status-approved/30",
  },
  PARTIELLEMENT_VALIDEE: {
    label: "Partiellement validée",
    className: "bg-yellow-100 text-yellow-700 border-yellow-300",
  },
  LIVREE: {
    label: "Livrée",
    className:
      "bg-status-delivered-bg text-status-delivered border-status-delivered/30",
  },
  ANNULEE: {
    label: "Annulée",
    className:
      "bg-gray-100 text-gray-500 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600",
  },
};

interface StatusBadgeProps {
  status: RequestStatus;
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        config.className,
        className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {config.label}
    </span>
  );
};

export default StatusBadge;
