export function formatDateRangeVerbose(
  startDate: Date,
  endDate?: Date,
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
    return `${monthNames[parseInt(month)]} ${year}`;
  };

  const start = formatDate(startDate);
  const end = endDate ? formatDate(endDate) : "Present";
  return `${start} - ${end}`;
}

export function formatDateRangeCompact(
  startDate: string,
  endDate?: string,
): string {
  const formatDate = (date: string) => {
    const [year, month] = date.split("-");
    return `${month.padStart(2, "0")}/${year}`;
  };

  const start = formatDate(startDate);
  const end = endDate ? formatDate(endDate) : "Present";
  return `${start} - ${end}`;
}

export function formatDateRangeYear(
  startDate: string,
  endDate?: string,
): string {
  const startYear = startDate.split("-")[0];
  const endYear = endDate ? endDate.split("-")[0] : "Present";

  if (endYear === "Present" || startYear === endYear) {
    return endYear === "Present" ? startYear : startYear;
  }

  return `${startYear} - ${endYear}`;
}
