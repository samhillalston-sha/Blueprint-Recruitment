"use client";
import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { requestMagicLink } from "@/app/login/actions";
import { initialSignInState } from "@/lib/auth/sign-in";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function SignInForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(requestMagicLink, initialSignInState);
  return <form action={action} className="space-y-5">
    <div><label htmlFor="email" className="mb-2 block text-sm font-semibold">Email address</label><Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} disabled={!configured || pending} aria-describedby={state.message ? "sign-in-message" : undefined} /></div>
    <Button type="submit" className="w-full" disabled={!configured || pending}>{pending ? <><LoaderCircle size={16} className="animate-spin" /> Sending link…</> : <>Send sign-in link <ArrowRight size={16} /></>}</Button>
    {state.message && <p id="sign-in-message" role={state.status === "error" ? "alert" : "status"} className={`rounded-md border p-3 text-sm leading-relaxed ${state.status === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-blue-200 bg-blue-50 text-blue-900"}`}>{state.message}</p>}
  </form>;
}
