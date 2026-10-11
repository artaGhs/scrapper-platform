import type { SourceItem } from "./types";

// Fictional fixtures: no invented authors, original URLs, or publication times.
const examples = [
  [
    "food-1",
    "Is there a calorie app that works from a photo?",
    "I want to keep track of my meals, but entering every ingredient takes too long. Is there an app that can estimate calories from a food photo?",
  ],
  [
    "food-2",
    "A simpler way to log meals?",
    "Looking for a food tracker with picture logging. I do not need perfect precision, just an easier daily habit than manual ingredient entry.",
  ],
  [
    "food-3",
    "Alternatives to typing every meal",
    "Anyone recommend a calorie tracking alternative where I can take a photo instead of typing ingredients?",
  ],
  [
    "noise-1",
    "Thinking about nutrition",
    "Calories are one part of nutrition. Here are a few thoughts on food and daily exercise.",
  ],
  [
    "shop-1",
    "Unique welcome discounts for my Shopify store",
    "Is there a Shopify app that sends a unique discount code in each welcome email? Manually creating codes is getting difficult.",
  ],
  [
    "shop-2",
    "Personalized discount codes in email",
    "Looking for a tool for my Shopify store that can create personalized discount codes for email subscribers automatically.",
  ],
  [
    "shop-3",
    "Discount app alternative?",
    "Anyone recommend a Shopify discount app alternative with automatic unique codes for welcome emails?",
  ],
  [
    "uptime-1",
    "A Slack alert when my website goes down",
    "Looking for a simple uptime monitor that alerts our Slack channel when the website goes offline. What tool would you recommend?",
  ],
  [
    "uptime-2",
    "Website monitoring for a small team",
    "Is there an affordable website uptime tool with notifications? I need an alert when my site is down.",
  ],
  [
    "uptime-3",
    "Uptime monitoring alternatives",
    "Anyone recommend an uptime monitoring alternative that sends website downtime alerts to Slack?",
  ],
];
export function sampleItems(): SourceItem[] {
  return examples.map(([id, title, text]) => ({
    id,
    title,
    text,
    url: null,
    community: null,
    publishedAt: null,
    synthetic: true,
  }));
}
