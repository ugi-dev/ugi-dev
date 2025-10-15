const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Calendar distance between two dates, e.g. "6 years, 6 months, 10 days". */
export function orbit(from: Date, to: Date): string {
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  let months = to.getUTCMonth() - from.getUTCMonth();
  let days = to.getUTCDate() - from.getUTCDate();

  if (days < 0) {
    months -= 1;
    // borrow the length of the month before `to`
    days += new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return [unit(years, "year"), unit(months, "month"), unit(days, "day")].join(", ");
}
