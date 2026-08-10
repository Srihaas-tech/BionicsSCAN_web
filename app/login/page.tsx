import type { Metadata } from "next";
import Image from "next/image";
import { LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";
import { getAuthConfigurationError } from "@/src/lib/env";
import { hasPageSession } from "@/src/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await hasPageSession()) {
    redirect("/");
  }

  const { error } = await searchParams;
  const configurationError = getAuthConfigurationError();

  return (
    <main className="login-page" id="main-content">
      <section className="login-card" aria-labelledby="login-title">
        <Image className="login-logo" src="/logo.png" width={96} height={96} alt="BionicsSCAN" priority />
        <div className="eyebrow">Team 4909</div>
        <h1 id="login-title">Open BionicsSCAN</h1>
        <p>Use the shared team password to manage inventory.</p>

        {configurationError ? (
          <div className="alert alert-danger" role="alert">
            <strong>Server setup is incomplete.</strong>
            <span>{configurationError}</span>
          </div>
        ) : null}

        {error === "invalid" ? (
          <div className="alert alert-danger" role="alert">
            The password is incorrect.
          </div>
        ) : null}

        <form className="login-form" action="/api/auth/login" method="post">
          <label htmlFor="password">Team password</label>
          <div className="input-with-icon">
            <LockKeyhole size={19} aria-hidden="true" />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={Boolean(configurationError)}
            />
          </div>
          <button className="button button-primary button-full" type="submit" disabled={Boolean(configurationError)}>
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
