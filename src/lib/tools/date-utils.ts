export function formatDateRangeVerbose(
  startDate: Date | null,
  endDate?: Date | null,
): string {
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${monthNames[month]} ${year}`;
  };

  if (!startDate) return "";
  const start = formatDate(startDate);
  const end = endDate ? formatDate(endDate) : "Present";
  return `${start} - ${end}`;
}

export function formatDateRangeCompact(
  startDate: Date | null,
  endDate?: Date | null,
): string {
  const formatDate = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}/${year}`;
  };

  if (!startDate) return "";
  const start = formatDate(startDate);
  const end = endDate ? formatDate(endDate) : "Present";
  return `${start} - ${end}`;
}

export function formatDateRangeYear(
  startDate: Date | null,
  endDate?: Date | null,
): string {
  if (!startDate) return "";
  const startYear = startDate.getFullYear();
  const endYear = endDate ? endDate.getFullYear() : "Present";

  return `${startYear} - ${endYear}`;
}
