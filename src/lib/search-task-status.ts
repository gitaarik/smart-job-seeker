import {
  faBan,
  faCheck,
  faCircle,
  faExclamationTriangle,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";

interface SearchTaskStatusInput {
  status: string | null;
  last_run: Date | string | null;
}

interface SearchTaskStatusResult {
  icon: IconDefinition | null;
  colorClass: string;
  iconSize: string;
  spinner: boolean;
}

export function getSearchTaskStatusIcon(
  task: SearchTaskStatusInput,
): SearchTaskStatusResult {
  if (task.status === "running" || task.status === "queued") {
    return {
      icon: null,
      colorClass: "text-blue-500",
      iconSize: "w-3 h-3",
      spinner: true,
    };
  }
  if (task.status === "stopping") {
    return {
      icon: null,
      colorClass: "text-orange-500",
      iconSize: "w-3 h-3",
      spinner: true,
    };
  }
  if (task.status === "success") {
    return {
      icon: faCheck,
      colorClass: "text-[var(--dash-success)]",
      iconSize: "w-3 h-3",
      spinner: false,
    };
  }
  if (task.status === "error") {
    return {
      icon: faTimes,
      colorClass: "text-red-500",
      iconSize: "w-3 h-3",
      spinner: false,
    };
  }
  if (task.status === "blocked" || task.status === "partial") {
    return {
      icon: faExclamationTriangle,
      colorClass: "text-yellow-500",
      iconSize: "w-3 h-3",
      spinner: false,
    };
  }
  if (task.status === "cancelled") {
    return {
      icon: faBan,
      colorClass: "text-[var(--dash-text-muted)]",
      iconSize: "w-3 h-3",
      spinner: false,
    };
  }
  // Fallback: task has run before but status is null/unrecognized (legacy data)
  if (task.last_run) {
    return {
      icon: faCheck,
      colorClass: "text-[var(--dash-success)]",
      iconSize: "w-3 h-3",
      spinner: false,
    };
  }
  // Never run (idle or truly unknown)
  return {
    icon: faCircle,
    colorClass: "text-[var(--dash-text-muted)]",
    iconSize: "w-2 h-2",
    spinner: false,
  };
}
