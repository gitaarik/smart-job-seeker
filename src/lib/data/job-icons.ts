/**
 * Icon mappings for job taxonomy values.
 * Maps canonical values from job-taxonomy.ts to Font Awesome icons.
 *
 * Client-side only — keep separate from format.ts which is also used server-side.
 */

import type { IconDefinition } from "@fortawesome/fontawesome-common-types";
import {
  faBriefcase,
  faHourglass,
  faFileContract,
  faGraduationCap,
  faHouseLaptop,
  faBuilding,
  faCity,
  faSeedling,
  faLayerGroup,
  faUserTie,
  faSitemap,
  faCrown,
  faChessKing,
  faChessQueen,
  faStar,
} from "@fortawesome/free-solid-svg-icons";

export const JOB_TYPE_ICONS: Record<string, IconDefinition> = {
  full_time: faBriefcase,
  part_time: faHourglass,
  contract: faFileContract,
  internship: faGraduationCap,
};

export const WORK_LOCATION_ICONS: Record<string, IconDefinition> = {
  remote: faHouseLaptop,
  hybrid: faBuilding,
  onsite: faCity,
};

export const EXPERIENCE_LEVEL_ICONS: Record<string, IconDefinition> = {
  entry: faSeedling,
  junior: faSeedling,
  mid: faLayerGroup,
  mid_senior: faLayerGroup,
  senior: faUserTie,
  lead: faSitemap,
  principal: faCrown,
  staff: faChessQueen,
  director: faChessKing,
  executive: faStar,
  internship: faGraduationCap,
};
