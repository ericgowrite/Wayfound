import { Metadata } from "next";
import AssessClient from "./AssessClient";

export const metadata: Metadata = {
  title: "Find your travel style — Wayfound",
};

export default async function AssessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <AssessClient token={token} />;
}
