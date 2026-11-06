
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../utils/supabase/client";

type Profile = {
  username: string;
  display_name: string;
  bio: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setEmail(user.email ?? "");

      const { data, error } = await supabase
        .from("profiles")
        .select("username, display_name, bio")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        setErrorMessage(
          "Couldn't load your profile: " + error.message
        );
      } else if (data) {
        const profile = data as Profile;
        setUsername(profile.username ?? "");
        setDisplayName(profile.display_name ?? "");
        setBio(profile.bio ?? "");
      }

      setLoading(false);
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    setMessage("");
    setErrorMessage("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage("Couldn't sign out. Please try again.");
      setSigningOut(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    const cleanUsername = username.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();
    const cleanBio = bio.trim();

    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      setErrorMessage(
        "Username must be 3–20 characters using only letters, numbers, and underscores."
      );
      return;
    }

    if (!cleanDisplayName) {
      setErrorMessage("Please enter a display name.");
      return;
    }

    if (cleanDisplayName.length > 50) {
      setErrorMessage(
        "Display name must be 50 characters or fewer."
      );
      return;
    }

    if (cleanBio.length > 300) {
      setErrorMessage("Bio must be 300 characters or fewer.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        username: cleanUsername,
        display_name: cleanDisplayName,
        bio: cleanBio || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        setErrorMessage(
          "That username is already taken. Try another one."
        );
      } else {
        setErrorMessage(
          "Couldn't save your profile: " + error.message
        );
      }
      return;
    }

    setUsername(cleanUsername);
    setDisplayName(cleanDisplayName);
    setBio(cleanBio);
    setMessage("Your profile is ready for the road!");
  }

  const initials = (displayName.trim() || username.trim() || "T")
    .split(/[\s_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#171916] text-[#F4F0E7]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#42463D] border-t-[#F28A4B]" />
          <p className="text-sm tracking-wide text-[#B8B9AD]">
            Unpacking your travel journal...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#171916] text-[#F4F0E7]">
      {/* Top navigation */}
      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <a href="/" className="group flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F28A4B] text-[#211D18] transition-transform group-hover:-rotate-6">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 20 9 5l4 10 3-6 5 11H3Z" />
                <path d="m7 20 5-5 4 5" />
                <path d="M9 5 11 8" />
              </svg>
            </span>
            <span>
              <span className="block text-lg font-bold tracking-tight">
                Travel Logbook
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-[#A7A99B]">
                Field notes from everywhere
              </span>
            </span>
          </a>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/"
              className="rounded-full border border-white/15 px-3 py-2 text-xs text-[#D1D0C5] transition hover:border-[#F28A4B] hover:text-[#F28A4B] sm:px-4 sm:text-sm"
            >
              ← Explore map
            </a>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-full bg-[#F28A4B] px-3 py-2 text-xs font-semibold text-[#211D18] transition hover:bg-[#FFA36C] disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:text-sm"
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {/* Page heading */}
        <div className="mb-9 max-w-2xl">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[#F28A4B]">
            <span className="h-px w-7 bg-[#F28A4B]" />
            Your traveller identity
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Your story.
            <span className="text-[#F28A4B]"> Your way.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[#AEB0A5] sm:text-base">
            Every traveller sees a place differently. Set up your profile
            and give the community a little glimpse of the person behind
            the logbook.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.35fr]">
          {/* Profile preview */}
          <aside className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-[#22251F] p-6 sm:p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full border border-[#F28A4B]/15"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-14 -top-14 -z-10 h-52 w-52 rounded-full border border-[#F28A4B]/15"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-4 -top-4 -z-10 h-32 w-32 rounded-full border border-[#F28A4B]/15"
            />

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#AEB0A5]">
                Field profile
              </span>
              <span className="rounded-full border border-[#F28A4B]/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#F28A4B]">
                Traveller
              </span>
            </div>

            <div className="mt-10 flex flex-col items-start">
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[#F28A4B] text-3xl font-black text-[#211D18] ring-4 ring-[#F28A4B]/15">
                {initials || "T"}
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-4 border-[#22251F] bg-[#D9DFB0]"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3 4 7v5c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V7l-8-4Z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </span>
              </div>

              <h2 className="mt-6 break-words text-2xl font-bold">
                {displayName.trim() || "Name your adventure"}
              </h2>
              <p className="mt-1 break-all text-sm text-[#F28A4B]">
                @{username.trim().toLowerCase() || "your_username"}
              </p>

              <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-[#C1C2B8]">
                {bio.trim() ||
                  "Your next great story begins with a place worth discovering."}
              </p>
            </div>

            <div className="mt-9 border-t border-white/10 pt-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-[#F28A4B]">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    The world is your logbook
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#AEB0A5]">
                    Share the places you visit and the details other
                    travellers should know.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#AEB0A5]">
                Account email
              </p>
              <p className="mt-2 break-all text-sm text-[#F4F0E7]">
                {email}
              </p>
              <p className="mt-2 text-xs text-[#8F9387]">
                Your email is private to your account.
              </p>
            </div>
          </aside>

          {/* Editable profile form */}
          <section className="rounded-3xl border border-white/10 bg-[#F4F0E7] p-6 text-[#24251F] sm:p-9">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#B65C2E]">
                  Make it yours
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  Personal details
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#737368]">
                  Your public identity in the travel community.
                </p>
              </div>
              <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E7DFCE] text-[#B65C2E] sm:flex">
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m14 4 6 6" />
                  <path d="M4 20 5.5 14.5 16 4a2.8 2.8 0 0 1 4 4L9.5 18.5 4 20Z" />
                  <path d="M13 7 17 11" />
                </svg>
              </span>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label
                  htmlFor="displayName"
                  className="mb-2 block text-sm font-bold"
                >
                  Display name
                </label>
                <input
                  id="displayName"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="What should travellers call you?"
                  maxLength={50}
                  required
                  className="w-full rounded-xl border border-[#D8D4C8] bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-[#A4A194] focus:border-[#C76838] focus:ring-4 focus:ring-[#C76838]/10"
                />
                <p className="mt-2 text-xs text-[#858477]">
                  Up to 50 characters.
                </p>
              </div>

              <div>
                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-bold"
                >
                  Username
                </label>
                <div className="flex overflow-hidden rounded-xl border border-[#D8D4C8] bg-white transition focus-within:border-[#C76838] focus-within:ring-4 focus-within:ring-[#C76838]/10">
                  <span className="flex items-center border-r border-[#E7E2D7] bg-[#F8F5EE] px-4 text-sm text-[#B65C2E]">
                    @
                  </span>
                  <input
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="your_username"
                    minLength={3}
                    maxLength={20}
                    autoComplete="username"
                    required
                    className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-[#A4A194]"
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-[#858477]">
                  3–20 characters. Letters, numbers, and underscores only.
                  Your username must be unique.
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="bio" className="text-sm font-bold">
                    Your story
                  </label>
                  <span className="text-xs text-[#858477]">
                    {bio.length}/300
                  </span>
                </div>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Where have you been? What kind of places do you love exploring?"
                  maxLength={300}
                  rows={5}
                  className="w-full resize-y rounded-xl border border-[#D8D4C8] bg-white px-4 py-3.5 text-sm leading-6 outline-none transition placeholder:text-[#A4A194] focus:border-[#C76838] focus:ring-4 focus:ring-[#C76838]/10"
                />
                <p className="mt-2 text-xs text-[#858477]">
                  Optional. Give fellow travellers a feel for who you are.
                </p>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
                >
                  <p className="font-bold">Something went wrong</p>
                  <p className="mt-1 break-words">{errorMessage}</p>
                </div>
              )}

              {message && (
                <div
                  role="status"
                  className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800"
                >
                  ✓ {message}
                </div>
              )}

              <button
                type="submit"
                disabled={saving || signingOut}
                className="group flex w-full items-center justify-center gap-3 rounded-xl bg-[#C76838] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-[#C76838]/15 transition hover:-translate-y-0.5 hover:bg-[#AD552D] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {saving ? "Saving your details..." : "Save profile"}
                {!saving && (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5 transition-transform group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                )}
              </button>

              <p className="text-center text-xs leading-5 text-[#858477]">
                Your profile details are saved to your Travel Logbook account.
              </p>
            </form>
          </section>
        </div>

        <footer className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-[#8F9387] sm:flex-row sm:items-center sm:justify-between">
          <span>TRAVEL LOGBOOK · BUILT FOR THE CURIOUS</span>
          <a href="/" className="transition hover:text-[#F28A4B]">
            Back to the map ↑
          </a>
        </footer>
      </div>
    </main>
  );
}
