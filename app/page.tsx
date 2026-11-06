
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import WorldMap from "./components/Worldmap";
import { createClient } from "../utils/supabase/client";

type SearchLogbook = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  created_at: string;
  location_context: {
    displayName?: string;
    city?: string;
    town?: string;
    village?: string;
    district?: string;
    state?: string;
    country?: string;
  } | null;
  entryCount: number;
  entryText: string;
};

type SearchEntry = { logbook_id: string; text: string | null; is_deleted: boolean };

export default function Home() {
  const [search, setSearch] = useState("");
  const [logbooks, setLogbooks] = useState<SearchLogbook[]>([]);
  const [logbooksLoading, setLogbooksLoading] = useState(true);
  const [logbooksError, setLogbooksError] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    let mounted = true;

    const loadLogbooks = async () => {
      try {
        const { data, error } = await supabase.rpc("get_map_logbooks");
        if (error) throw error;

        const rows = (data ?? []) as Omit<SearchLogbook, "entryCount" | "entryText">[];
        const { data: entryRows, error: entriesError } = await supabase
          .from("entries")
          .select("logbook_id, text, is_deleted");
        if (entriesError) throw entriesError;

        const entries = (entryRows ?? []) as SearchEntry[];
        const summaries = new Map<string, { count: number; text: string[] }>();
        entries.forEach((entry) => {
          const summary = summaries.get(entry.logbook_id) ?? { count: 0, text: [] };
          if (!entry.is_deleted) {
            summary.count += 1;
            if (entry.text) summary.text.push(entry.text);
          }
          summaries.set(entry.logbook_id, summary);
        });

        if (mounted) {
          setLogbooks(rows.map((row) => {
            const summary = summaries.get(row.id);
            return { ...row, entryCount: summary?.count ?? 0, entryText: summary?.text.join(" ") ?? "" };
          }));
          setLogbooksError("");
        }
      } catch (error) {
        console.error("Could not load community logbooks:", error);
        if (mounted) setLogbooksError("Could not load community logbooks. Please try again.");
      } finally {
        if (mounted) setLogbooksLoading(false);
      }
    };

    void loadLogbooks();
    const refresh = () => void loadLogbooks();
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 15000);
    return () => {
      mounted = false;
      window.removeEventListener("focus", refresh);
      window.clearInterval(interval);
    };
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error("Could not check session:", error.message);
      }

      setIsSignedIn(!!session);
      setAuthLoading(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setIsSignedIn(!!session);
        setAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const filteredLogbooks = logbooks.filter((logbook) => {
    const location = logbook.location_context;
    const searchable = [
      logbook.name,
      location?.displayName,
      location?.city,
      location?.town,
      location?.village,
      location?.district,
      location?.state,
      location?.country,
      `${logbook.latitude} ${logbook.longitude}`,
      logbook.entryText,
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return searchable.includes(search.trim().toLocaleLowerCase());
  });

  return (
    <main className="min-h-screen overflow-hidden bg-[#F4F0E7] text-[#22251F]">
      {/* Navigation */}
      <nav className="border-b border-[#22251F]/10 bg-[#F4F0E7]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#C76838] text-[#FFF8ED] transition-transform group-hover:-rotate-6">
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
              </svg>
            </span>

            <span>
              <span className="block text-lg font-extrabold tracking-tight sm:text-xl">
                Travel Logbook
              </span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-[#77796E] sm:block">
                Field notes from everywhere
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-5">
            <a
              href="#explore"
              className="hidden text-sm font-medium text-[#55594E] transition hover:text-[#C76838] sm:block"
            >
              Explore
            </a>

            {!authLoading && (
              <Link
                href={isSignedIn ? "/profile" : "/login"}
                className="rounded-full bg-[#22251F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#C76838] sm:px-6"
              >
                {isSignedIn ? "My profile ↗" : "Sign in ↗"}
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-[#22251F] text-[#F4F0E7]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-52 -z-10 h-[520px] w-[520px] rounded-full border border-white/[0.07]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-32 -z-10 h-[360px] w-[360px] rounded-full border border-white/[0.07]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-10 top-0 -z-10 h-[180px] w-[180px] rounded-full border border-[#F28A4B]/15"
        />

        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16 lg:py-24">
          <div>
            <p className="mb-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.24em] text-[#F28A4B]">
              <span className="h-px w-8 bg-[#F28A4B]" />
              For the curious traveller
            </p>

            <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
              Some places deserve
              <span className="block text-[#F28A4B]">
                more than a visit.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-[#C4C5B9] sm:text-lg sm:leading-8">
              Discover places worth travelling to. Read the experiences of
              people who have actually been there, then decide where your
              next story begins.
            </p>

            <a
              href="#explore"
              className="mt-8 inline-flex items-center gap-3 rounded-xl bg-[#F28A4B] px-6 py-4 text-sm font-bold text-[#241E18] transition hover:-translate-y-0.5 hover:bg-[#FFA36C]"
            >
              Find your next destination
              <span aria-hidden="true">↗</span>
            </a>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-[#AEB0A5]">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#F28A4B]" />
                Real traveller experiences
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#D8DDB4]" />
                Discover beyond the usual
              </span>
            </div>
          </div>

          {/* Editorial hero illustration */}
          <div className="relative mx-auto w-full max-w-md lg:ml-auto">
            <div className="absolute -inset-3 rotate-3 rounded-[2rem] border border-white/10" />
            <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#343A30] p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4C5B9]">
                  The explorer&apos;s notebook
                </span>
                <span className="text-xl text-[#F28A4B]">✳</span>
              </div>

              <svg
                viewBox="0 0 340 250"
                className="mt-5 w-full"
                fill="none"
                aria-label="Illustration of mountains, a winding trail, and a setting sun"
                role="img"
              >
                <circle cx="248" cy="65" r="35" fill="#F28A4B" />
                <circle
                  cx="248"
                  cy="65"
                  r="48"
                  stroke="#F28A4B"
                  strokeOpacity=".25"
                />
                <path
                  d="M10 190 90 80 130 135 180 47 300 190Z"
                  fill="#7C927A"
                />
                <path
                  d="m90 80 19 26-18-7-14 19Z"
                  fill="#E8E2D3"
                />
                <path
                  d="m180 47 28 44-25-12-19 20Z"
                  fill="#E8E2D3"
                />
                <path
                  d="M0 190 70 135 128 177 205 112 340 200V250H0Z"
                  fill="#526D57"
                />
                <path
                  d="M0 220 95 182 155 213 230 169 340 217V250H0Z"
                  fill="#354D3D"
                />
                <path
                  d="M170 250c-3-29 22-35 12-53-12-19-34-27-22-45 8-12 21-19 20-37"
                  stroke="#F1D3A5"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="4 7"
                />
                <circle
                  cx="180"
                  cy="115"
                  r="7"
                  fill="#F28A4B"
                  stroke="#F4F0E7"
                  strokeWidth="2"
                />
              </svg>

              <div className="mt-3 flex items-end justify-between border-t border-white/10 pt-5">
                <div>
                  <p className="text-xs text-[#BFC2B5]">
                    YOUR NEXT CHAPTER
                  </p>
                  <p className="mt-1 text-xl font-bold">
                    Start somewhere new.
                  </p>
                </div>
                <span className="text-3xl text-[#F28A4B]">↗</span>
              </div>
            </div>
            <p className="mt-5 text-center text-[10px] uppercase tracking-[0.2em] text-[#AEB0A5]">
              Every destination has a story.
            </p>
          </div>
        </div>
      </section>

      {/* Map discovery */}
      <section id="explore" className="scroll-mt-6 px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#B65C2E]">
                01 / Explore
              </p>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                The world is your canvas.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#737568] sm:text-base">
                Find a place you know, discover somewhere unfamiliar, or
                point to a location and see what stories could live there.
              </p>
            </div>

            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#D8D4C8] bg-white/60 px-4 py-2 text-xs font-semibold text-[#55594E]">
              <span className="h-2 w-2 rounded-full bg-[#C76838]" />
              Interactive world map
            </span>
          </div>

          <div className="overflow-hidden rounded-3xl border border-[#D8D4C8] bg-white p-2 shadow-[0_16px_50px_rgba(34,37,31,0.08)] sm:p-3">
            <div className="overflow-hidden rounded-2xl">
              <WorldMap />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 text-xs leading-5 text-[#77796E] sm:flex-row sm:items-center sm:justify-between">
            <p>Move around the map. Follow your curiosity.</p>
            <p>Places are better when experienced, not just rated.</p>
          </div>
        </div>
      </section>

      {/* Community logbook search */}
      <section className="border-y border-[#22251F]/10 bg-[#EAE5D9] px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#B65C2E]">
                02 / Community stories
              </p>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                Search the logbooks.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-[#737568] sm:text-base">
                Find places by name, location, coordinates, or what travellers have shared.
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <label htmlFor="logbook-search" className="sr-only">
                Search community logbooks
              </label>
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#77796E]">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m16 16 4 4" />
                </svg>
              </span>
              <input
                id="logbook-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search logbooks, places, or stories..."
                className="w-full rounded-xl border border-[#D4CEBF] bg-[#F8F5EE] py-3.5 pl-12 pr-4 text-sm outline-none transition placeholder:text-[#969486] focus:border-[#C76838] focus:ring-4 focus:ring-[#C76838]/10"
              />
            </div>
          </div>

          <div className="mt-9 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#77796E]">
              {search
                ? `${filteredLogbooks.length} matching logbooks`
                : "Community-created places"}
            </p>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-xs font-bold text-[#B65C2E] hover:underline"
              >
                Clear search
              </button>
            )}
          </div>

          {logbooksLoading ? (
            <p className="mt-6">Loading community logbooks...</p>
          ) : logbooksError ? (
            <p role="alert" className="mt-6">{logbooksError}</p>
          ) : logbooks.length === 0 ? (
            <p className="mt-6">No community logbooks yet. Explore the map and create the first one.</p>
          ) : filteredLogbooks.length === 0 ? (
            <p className="mt-6">No logbooks found. Try another search.</p>
          ) : (
            <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredLogbooks.map((logbook) => (
                <Link
                  key={logbook.id}
                  href={`/Logbook/${encodeURIComponent(logbook.id)}`}
                  className="group block overflow-hidden rounded-2xl border border-[#D4CEBF] bg-[#F8F5EE] transition duration-300 hover:-translate-y-1 hover:border-[#C76838]/50 hover:shadow-[0_16px_35px_rgba(34,37,31,0.10)]"
                >
                  <div className="overflow-hidden">
                    <div className="transition duration-500 group-hover:scale-[1.025]">
                      <div className="bg-[#F8F5EE] p-5">
                        <h3 className="text-xl font-semibold">{logbook.name}</h3>
                        <p className="mt-2 text-sm text-[#77796E]">{logbook.location_context?.displayName || `${logbook.latitude.toFixed(4)}, ${logbook.longitude.toFixed(4)}`}</p>
                        <p className="mt-4 text-xs text-[#77796E]">{logbook.entryCount} visitor entries · {new Date(logbook.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#D4CEBF]/70 px-5 py-4">
                    <span className="text-xs font-semibold text-[#77796E]">
                      Open destination
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EAE5D9] text-[#B65C2E] transition group-hover:bg-[#C76838] group-hover:text-white">
                      ↗
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Closing invitation */}
      <section className="bg-[#22251F] px-5 py-14 text-[#F4F0E7] sm:px-8 sm:py-16">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#F28A4B]">
              The next page is yours
            </p>
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
              Know a place worth sharing?
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-[#BFC1B5]">
              Help another traveller discover what makes a destination
              special. Real visits, useful details, stories that stay.
            </p>
          </div>

          <Link
            href={isSignedIn ? "/profile" : "/login"}
            className="inline-flex w-fit shrink-0 items-center gap-3 rounded-xl bg-[#F28A4B] px-6 py-4 text-sm font-bold text-[#241E18] transition hover:-translate-y-0.5 hover:bg-[#FFA36C]"
          >
            {isSignedIn ? "Visit your profile" : "Join the journey"}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <div className="mx-auto mt-12 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8F9387] sm:flex-row sm:items-center sm:justify-between">
          <span>Travel Logbook · Field notes from everywhere</span>
          <a href="#top" className="hover:text-[#F28A4B]">
            Back to the top ↑
          </a>
        </div>
      </section>
    </main>
  );
}

