// Dev-only preview page — do not deploy to production
import { redirect } from "next/navigation";
import CardPreviewClient from "./CardPreviewClient";

export default function CardPreviewPage() {
  if (process.env.NODE_ENV !== "development") redirect("/");
  return <CardPreviewClient />;
}
