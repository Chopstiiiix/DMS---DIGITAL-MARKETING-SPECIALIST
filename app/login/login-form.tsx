"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

const initial: LoginState = { error: null, notice: null };

export function LoginForm({ linkError }: { linkError: boolean }) {
  const [state, action, pending] = useActionState(signIn, initial);
  const error =
    state.error ??
    (linkError && !state.notice
      ? "That sign-in link has expired or was opened in a different browser. Request a new one."
      : null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required className="input" />
      </label>
      <label className="field">
        <span>
          Password <span className="font-normal text-muted">(optional)</span>
        </span>
        <input name="password" type="password" autoComplete="current-password" className="input" />
        <span className="text-xs font-normal text-muted">
          Leave empty to get a one-time sign-in link by email.
        </span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="text-sm">
          {state.notice}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Working…" : "Continue"}
      </button>
    </form>
  );
}
