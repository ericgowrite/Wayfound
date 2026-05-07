import { SearchCategory } from "@/types";

export const CATEGORY_META: Record<SearchCategory, { icon: string; label: string }> = {
  accommodation: { icon: "🏨", label: "Accommodation" },
  tour:          { icon: "🎫", label: "Tour" },
  restaurant:    { icon: "🍽️", label: "Restaurant" },
  activity:      { icon: "🎯", label: "Activity" },
  destination:   { icon: "📍", label: "Destination" },
};
