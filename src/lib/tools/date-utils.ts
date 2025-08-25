export function formatDateRangeVerbose(startDate: string, endDate?: string): string {
  const formatDate = (date: string) => {
    const [year, month] = date.split("-");
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
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  const start = formatDate(startDate);
  const end = endDate ? formatDate(endDate) : "Present";
  return `${start} - ${end}`;
}

export function formatDateRangeCompact(startDate: string, endDate?: string): string {
  const formatDate = (date: string) => {
    const [year, month] = date.split("-");
    return `${month.padStart(2, '0')}/${year}`;
  };

  const start = formatDate(startDate);
  const end = endDate ? formatDate(endDate) : "Present";
  return `${start} - ${end}`;
}