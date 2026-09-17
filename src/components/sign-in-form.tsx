"use client";
import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { signInWithGoogle } from "@/app/login/actions";
import { initialSignInState } from "@/lib/auth/sign-in";
import { Button } from "./ui/button";

export function SignInForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(signInWithGoogle, initialSignInState);
  return <form action={action} className="space-y-5">
    <Button type="submit" variant="outline" className="w-full gap-3" disabled={!configured || pending} aria-describedby={state.message ? "sign-in-message" : undefined}>{pending ? <><LoaderCircle size={16} className="animate-spin" /> Connecting to Google…</> : <><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z" /><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z" /><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z" /></svg>Sign in with Google</>}</Button>
    <p className="text-xs leading-5 text-muted-foreground">Use your individual Google account. Workspace access must be approved by Blueprint leadership.</p>
    {state.message && <p id="sign-in-message" role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-relaxed text-red-800">{state.message}</p>}
  </form>;
}
