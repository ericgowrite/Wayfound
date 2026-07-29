// Dev-only preview page — do not deploy to production
import { redirect } from "next/navigation";
import OnboardingPreviewClient from "./OnboardingPreviewClient";

export default function OnboardingPreviewPage() {
  if (process.env.NODE_ENV !== "development") redirect("/");
  return <OnboardingPreviewClient />;
}
