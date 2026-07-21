export type PricingPlan = {
  id: "starter" | "explorer" | "premium";
  name: string;
  price: number;
  badge?: string;
  popular?: boolean;
  description: string;
  previews: number;
  features: string[];
};

export const pricingPlans: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 2.99,
    description: "Perfect for trying a new look.",
    previews: 1,
    features: [
      "1 Premium Preview",
      "Fast AI Processing",
      "High Resolution",
      "Identity Preserved",
      "Commercial Use",
    ],
  },

  {
    id: "explorer",
    name: "Explorer",
    price: 5.99,
    badge: "Most Popular",
    popular: true,
    description: "Compare multiple styles before deciding.",
    previews: 5,
    features: [
      "5 Premium Previews",
      "Enhanced AI Processing",
      "Higher Identity Accuracy",
      "Better Hair Detail",
      "Priority Processing",
      "High Resolution",
    ],
  },

  {
    id: "premium",
    name: "Premium",
    price: 9.99,
    description: "Maximum quality for your final decision.",
    previews: 10,
    features: [
      "10 Premium Previews",
      "Highest Quality Processing",
      "Maximum Hair Detail",
      "Highest Identity Accuracy",
      "Priority Processing",
      "High Resolution",
    ],
  },
];