export function formatDate(date: Date | any): string {
  if (!date) return "-";
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatDateShort(date: Date | any): string {
  if (!date) return "-";
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString("pt-BR");
}

export function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function parseDate(date: any): Date {
  if (!date) return new Date();
  if (typeof date.toDate === "function") return date.toDate();
  if (date instanceof Date) return date;
  return new Date(date);
}
