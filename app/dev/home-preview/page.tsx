// Dev-only preview page — do not deploy to production
import { redirect } from "next/navigation";
import HomePreviewClient from "./HomePreviewClient";

export default function HomePreviewPage() {
  if (process.env.NODE_ENV !== "development") redirect("/");
  return <HomePreviewClient />;
}
