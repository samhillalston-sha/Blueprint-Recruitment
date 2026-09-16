"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="mx-auto max-w-lg px-6 py-24"><h1 className="text-2xl font-semibold">Something isn’t available right now.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">We couldn’t load this workspace. Try again, or ask your administrator to check the connection and database setup.</p><Button className="mt-6" onClick={reset}>Try again</Button></div>;
}
