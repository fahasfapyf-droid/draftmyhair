export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
  popular?: boolean;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "credits-5",
    name: "5 Credits",
    credits: 5,
    priceUsd: 5,
  },
  {
    id: "credits-10",
    name: "10 Credits",
    credits: 10,
    priceUsd: 9,
    popular: true,
  },
  {
    id: "credits-25",
    name: "25 Credits",
    credits: 25,
    priceUsd: 20,
  },
  {
    id: "credits-50",
    name: "50 Credits",
    credits: 50,
    priceUsd: 35,
  },
  {
    id: "credits-100",
    name: "100 Credits",
    credits: 100,
    priceUsd: 60,
  },
];