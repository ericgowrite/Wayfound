import { SearchCategory } from "@/types";

export const CATEGORY_META: Record<SearchCategory, { icon: string; label: string; hint: string }> = {
  accommodation: { icon: "🏨", label: "Accommodation", hint: "Hotels, resorts, rentals" },
  tour:          { icon: "🎫", label: "Tour",          hint: "Guided trips, itineraries" },
  restaurant:    { icon: "🍽️", label: "Restaurant",    hint: "Dining" },
  activity:      { icon: "🎯", label: "Activity",      hint: "Excursions, classes, experiences" },
  attraction:    { icon: "📍", label: "Attraction",    hint: "Parks, cities, landmarks" },
};
