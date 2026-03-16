import {
  faBan,
  faCheck,
  faCircle,
  faExclamationTriangle,
  faSpinner,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";

interface SearchTaskStatusInput {
  status: string | null;
  last_run: Date | string | null;
}

interface SearchTaskStatusResult {
  icon: IconDefinition;
  colorClass: string;
  iconSize: string;
  animate: boolean;
}

export function getSearchTaskStatusIcon(
  task: SearchTaskStatusInput,
): SearchTaskStatusResult {
  if (task.status === "running" || task.status === "queued") {
    return {
      icon: faSpinner,
      colorClass: "text-blue-500",
      iconSize: "w-3 h-3",
      animate: true,
    };
  }
  if (task.status === "success") {
    return {
      icon: faCheck,
      colorClass: "text-[var(--dash-success)]",
      iconSize: "w-3 h-3",
      animate: false,
    };
  }
  if (task.status === "error") {
    return {
      icon: faTimes,
      colorClass: "text-red-500",
      iconSize: "w-3 h-3",
      animate: false,
    };
  }
  if (task.status === "blocked" || task.status === "partial") {
    return {
      icon: faExclamationTriangle,
      colorClass: "text-yellow-500",
      iconSize: "w-3 h-3",
      animate: false,
    };
  }
  if (task.status === "cancelled") {
    return {
      icon: faBan,
      colorClass: "text-[var(--dash-text-muted)]",
      iconSize: "w-3 h-3",
      animate: false,
    };
  }
  // Fallback: task has run before but status is null/unrecognized (legacy data)
  if (task.last_run) {
    return {
      icon: faCheck,
      colorClass: "text-[var(--dash-success)]",
      iconSize: "w-3 h-3",
      animate: false,
    };
  }
  // Never run (idle or truly unknown)
  return {
    icon: faCircle,
    colorClass: "text-[var(--dash-text-muted)]",
    iconSize: "w-2 h-2",
    animate: false,
  };
}
