
"use client";

import { useState } from "react";
import { createClient } from "../../utils/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const supabase = createClient();

  const sendCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
    });

    if (error) {
      setError(error.message);
    } else {
      setCodeSent(true);
      setMessage("Check your email for your verification code.");
    }

    setLoading(false);
  };

  const verifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/";
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12 text-gray-900">
      <section className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-sm sm:p-10">
        <a
          href="/"
          className="text-sm font-semibold text-gray-500 hover:text-gray-900"
        >
          ← Travel Logbook
        </a>

        <div className="mt-10">
          <p className="text-sm font-medium text-gray-400">
            YOUR NEXT JOURNEY STARTS HERE
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            {codeSent ? "Check your inbox." : "Welcome, traveller."}
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-500">
            {codeSent
              ? `Enter the verification code sent to ${email}.`
              : "Sign in or create an account using your email. No password needed."}
          </p>
        </div>

        {!codeSent ? (
          <form onSubmit={sendCode} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium"
              >
                Email address
              </label>

              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-gray-900"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gray-900 px-5 py-3 font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send verification code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="code"
                className="mb-2 block text-sm font-medium"
              >
                Verification code
              </label>

              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={10}
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\s/g, ""))
                }
                placeholder="Enter your code"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-center text-xl tracking-[0.3em] outline-none transition focus:border-gray-900"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full rounded-xl bg-gray-900 px-5 py-3 font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify and sign in"}
            </button>

            <button
              type="button"
              onClick={() => {
                setCode("");
                setCodeSent(false);
                setMessage("");
                setError("");
              }}
              className="w-full rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold transition hover:bg-gray-50"
            >
              Change email address
            </button>
          </form>
        )}

        {message && (
          <p role="status" className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-800">
            {message}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <p className="mt-8 text-center text-xs leading-5 text-gray-400">
          By continuing, you agree to use Travel Logbook responsibly and
          contribute honest experiences.
        </p>
      </section>
    </main>
  );
}
