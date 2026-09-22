import { Suspense } from "react";
import { Wiki } from "@/components/Wiki";

export default function Home() {
  const title = process.env.WIKI_TITLE?.trim() || "past wiki";
  return (
    <Suspense fallback={null}>
      <Wiki title={title} />
    </Suspense>
  );
}
