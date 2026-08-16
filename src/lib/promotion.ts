/** Paid "TOP" placement plans for a single listing. */
export const TOP_PLANS = [
  { id: "d3", days: 3, price: 9990 },
  { id: "d7", days: 7, price: 19990 },
  { id: "d30", days: 30, price: 59990 },
] as const;

export type TopPlanId = (typeof TOP_PLANS)[number]["id"];
