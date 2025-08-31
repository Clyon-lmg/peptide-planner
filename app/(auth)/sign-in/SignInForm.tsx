'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';

interface State {
  error: string;
}

interface Props {
  sendMagicLink: (formData: FormData) => Promise<void>;
  signInWithPassword: (
    prevState: State,
    formData: FormData
  ) => Promise<State>;
  err: string;
  msg: string;
  redirect: string;
}

export default function SignInForm({
  sendMagicLink,
  signInWithPassword,
  err,
  msg,
  redirect,
}: Props) {
  const [method, setMethod] = useState<'magic' | 'password'>('magic');
  const [state, formAction] = useFormState<State, FormData>(signInWithPassword, {
    error: '',
  });

  return (
    <div className="space-y-4">
      {method === 'magic' ? (
        <>
          {err ? (
                      <div className="rounded border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {err}
            </div>
          ) : (
                          <div className="rounded border border-info/20 bg-info/10 p-3 text-sm text-info">
              {msg}
            </div>
          )}
          <form action={sendMagicLink} className="space-y-3">
            <input type="hidden" name="redirect" value={redirect} />
            <label className="block text-sm">
              Email
              <input
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </label>
            <button
              type="submit"
                          className="rounded px-4 py-2 text-sm bg-success hover:bg-success/90 text-white"
            >
              Send magic link
            </button>
          </form>
        </>
      ) : (
        <>
          {state.error ? (
                          <div className="rounded border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          ) : (
                              <div className="rounded border border-info/20 bg-info/10 p-3 text-sm text-info">
              Enter your email and password to sign in.
            </div>
          )}
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="redirect" value={redirect} />
            <label className="block text-sm">
              Email
              <input
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Password
              <input
                name="password"
                type="password"
                required
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </label>
            <button
              type="submit"
                              className="rounded px-4 py-2 text-sm bg-success hover:bg-success/90 text-white"
            >
              Sign in
            </button>
          </form>
        </>
      )}
          <div className="text-xs text-muted">
        {method === 'magic' ? (
          <button
            type="button"
            onClick={() => setMethod('password')}
            className="underline"
          >
            Use email & password instead
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMethod('magic')}
            className="underline"
          >
            Use magic link instead
          </button>
        )}
      </div>
    </div>
  );
}