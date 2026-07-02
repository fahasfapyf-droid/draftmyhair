import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://www.draftmyhair.com",
      priority: 1,
    },
    {
      url: "https://www.draftmyhair.com/gallery",
      priority: 0.9,
    },
    {
      url: "https://www.draftmyhair.com/salons",
      priority: 0.8,
    },
    {
      url: "https://www.draftmyhair.com/contact",
      priority: 0.7,
    },
    {
      url: "https://www.draftmyhair.com/faq",
      priority: 0.7,
    },
    {
      url: "https://www.draftmyhair.com/privacy",
      priority: 0.5,
    },
    {
      url: "https://www.draftmyhair.com/terms",
      priority: 0.5,
    },
  ];
}