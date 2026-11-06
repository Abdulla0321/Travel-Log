"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../utils/supabase/client";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
];

type Media = {
  id: string;
  entry_id: string;
  media_type: "image" | "video";
  storage_path: string;
  mime_type: string;
  sort_order: number;
  publicUrl: string;
};

type SelectedMedia = {
  file: File;
  previewUrl: string;
  mediaType: "image" | "video";
};

type Reply = {
  id: string;
  entry_id: string;
  parent_reply_id: string | null;
  user_id: string;
  text: string;
  created_at: string;
  username: string;
  children: Reply[];
};

type Entry = {
  id: string;
  user_id: string;
  text: string;
  timestamp: string;
  media: Media[];
  replies: Reply[];
  is_deleted: boolean;
};

type Logbook = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  entries: Entry[];
};

type LogbookRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  created_at: string;
  location_context: Record<string, unknown> | null;
};

type EntryRow = {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  is_deleted: boolean;
};

type MediaRow = Omit<Media, "publicUrl">;

type ReplyRow = Omit<Reply, "username" | "children">;

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
};

type Props = {
  params: Promise<{ id: string }>;
};

function buildReplyTree(rows: ReplyRow[], profiles: ProfileRow[]): Reply[] {
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const nodes = new Map<string, Reply>();

  for (const row of rows) {
    const profile = profileMap.get(row.user_id);

    nodes.set(row.id, {
      ...row,
      username: profile?.username || profile?.display_name || "Traveller",
      children: [],
    });
  }

  const roots: Reply[] = [];

  for (const row of rows) {
    const node = nodes.get(row.id);
    if (!node) continue;

    const parent = row.parent_reply_id
      ? nodes.get(row.parent_reply_id)
      : undefined;

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function countReplies(replies: Reply[] = []): number {
  return replies.reduce(
    (total, reply) => total + 1 + countReplies(reply.children ?? []),
    0
  );
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ReplyBranch({
  reply,
  onReply,
}: {
  reply: Reply;
  onReply: (text: string, parentReplyId: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [replying, setReplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || saving) return;

    setSaving(true);
    setError("");

    try {
      await onReply(draft.trim(), reply.id);
      setDraft("");
      setReplying(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post reply.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 border-l-2 border-orange-200 pl-3 sm:pl-5">
      <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-800">
            {reply.username.charAt(0).toUpperCase()}
          </span>

          <p className="text-sm font-semibold text-gray-900">
            @{reply.username}
          </p>

          <time className="text-xs text-gray-400">
            {formatDateTime(reply.created_at)}
          </time>
        </div>

        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">
          {reply.text}
        </p>

        <button
          type="button"
          onClick={() => setReplying((current) => !current)}
          className="mt-3 text-xs font-semibold text-orange-800 transition hover:text-orange-600"
        >
          {replying ? "Cancel" : "↳ Reply"}
        </button>

        {replying && (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`Reply to @${reply.username}...`}
              rows={2}
              maxLength={5000}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!draft.trim() || saving}
              className="rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Posting..." : "Post reply"}
            </button>
          </form>
        )}
      </div>

      {reply.children.length > 0 && (
        <div className="mt-3 space-y-3">
          {reply.children.map((child) => (
            <ReplyBranch key={child.id} reply={child} onReply={onReply} />
          ))}
        </div>
      )}
    </div>
  );
}

function EntryReplies({
  entry,
  onReply,
}: {
  entry: Entry;
  onReply: (
    entryId: string,
    text: string,
    parentReplyId: string | null
  ) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || saving) return;

    setSaving(true);
    setError("");

    try {
      await onReply(entry.id, draft.trim(), null);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post reply.");
    } finally {
      setSaving(false);
    }
  }

  const replyCount = countReplies(entry.replies);

  return (
    <div className="mt-7 border-t border-gray-100 pt-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold tracking-tight text-gray-900">
          Conversation
        </h3>

        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-800">
          {replyCount} {replyCount === 1 ? "reply" : "replies"}
        </span>
      </div>

      <form onSubmit={submit} className="mt-4">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Share a thought or help another traveller..."
          rows={3}
          maxLength={5000}
          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        />

        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={!draft.trim() || saving}
            className="rounded-xl bg-gray-900 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Posting..." : "Add a reply"}
          </button>
        </div>
      </form>

      {entry.replies.length > 0 && (
        <div className="mt-5 space-y-3">
          {entry.replies.map((reply) => (
            <ReplyBranch
              key={reply.id}
              reply={reply}
              onReply={(text, parentId) =>
                onReply(entry.id, text, parentId)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LogbookPage({ params }: Props) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [logbook, setLogbook] = useState<Logbook | null>(null);
  const [entryText, setEntryText] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingEntry, setSavingEntry] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

  const previewUrls = useRef(new Set<string>());

  useEffect(() => {
    return () => {
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current.clear();
    };
  }, []);

  const loadLogbook = useCallback(
    async (logbookId: string) => {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;
        setCurrentUserId(user?.id ?? null);

        const { data: logbooks, error: logbookError } =
          await supabase.rpc("get_map_logbooks");

        if (logbookError) throw logbookError;

        const row = ((logbooks ?? []) as LogbookRow[]).find(
          (item) => item.id === logbookId
        );

        if (!row) {
          setLogbook(null);
          return;
        }

        const { data: entries, error: entriesError } = await supabase
          .from("entries")
          .select("id, user_id, text, created_at, is_deleted")
          .eq("logbook_id", logbookId)
          .order("created_at", { ascending: false });

        if (entriesError) throw entriesError;

        const entryRows = (entries ?? []) as EntryRow[];

        // Keep deleted entries in the thread so their replies remain attached.
        const entryIds = entryRows.map((entry) => entry.id);

        // Never load media for deleted entries.
        const visibleEntryIds = entryRows
          .filter((entry) => !entry.is_deleted)
          .map((entry) => entry.id);

        let mediaRows: MediaRow[] = [];
        let replyRows: ReplyRow[] = [];
        let profiles: ProfileRow[] = [];

        if (visibleEntryIds.length > 0) {
          const { data: media, error: mediaError } = await supabase
            .from("entry_media")
            .select(
              "id, entry_id, media_type, storage_path, mime_type, sort_order"
            )
            .in("entry_id", visibleEntryIds)
            .order("sort_order", { ascending: true });

          if (mediaError) throw mediaError;
          mediaRows = (media ?? []) as MediaRow[];
        }

        // Fetch replies for ALL entries, including deleted ones.
        if (entryIds.length > 0) {
          const { data: replies, error: repliesError } = await supabase
            .from("replies")
            .select(
              "id, entry_id, parent_reply_id, user_id, text, created_at"
            )
            .in("entry_id", entryIds)
            .order("created_at", { ascending: true });

          if (repliesError) throw repliesError;
          replyRows = (replies ?? []) as ReplyRow[];

          const userIds = [
            ...new Set(replyRows.map((reply) => reply.user_id)),
          ];

          if (userIds.length > 0) {
            const { data: profileRows, error: profilesError } =
              await supabase
                .from("profiles")
                .select("id, username, display_name")
                .in("id", userIds);

            if (profilesError) throw profilesError;
            profiles = (profileRows ?? []) as ProfileRow[];
          }
        }

        const mappedMedia: Media[] = mediaRows.map((item) => {
          const { data } = supabase.storage
            .from("travel-media")
            .getPublicUrl(item.storage_path);

          return { ...item, publicUrl: data.publicUrl };
        });

        // Keep every entry in its original chronological position.
        const mappedEntries: Entry[] = entryRows.map((entry) => ({
          id: entry.id,
          user_id: entry.user_id,
          text: entry.is_deleted ? "" : entry.text ?? "",
          timestamp: entry.created_at,
          is_deleted: entry.is_deleted,
          media: entry.is_deleted
            ? []
            : mappedMedia.filter((item) => item.entry_id === entry.id),
          replies: buildReplyTree(
            replyRows.filter((reply) => reply.entry_id === entry.id),
            profiles
          ),
        }));

        setLogbook({
          id: row.id,
          name: row.name,
          latitude: row.latitude,
          longitude: row.longitude,
          createdAt: row.created_at,
          entries: mappedEntries,
        });
      } catch (err) {
        console.error("Could not load logbook:", err);
        setError(
          err instanceof Error ? err.message : "Could not load this logbook."
        );
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    let cancelled = false;

    params
      .then(({ id: logbookId }) => {
        if (cancelled) return;

        setId(logbookId);
        void loadLogbook(logbookId);
      })
      .catch((err) => {
        console.error("Could not read logbook URL:", err);

        if (!cancelled) {
          setError("Could not read the logbook address.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params, loadLogbook]);

  const handleMediaSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";

    if (files.length === 0) return;

    const accepted: SelectedMedia[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        rejected.push(`${file.name}: unsupported file type.`);
        continue;
      }

      if (file.size === 0) {
        rejected.push(`${file.name}: the file is empty.`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name}: exceeds the 50 MB limit.`);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);

      accepted.push({
        file,
        previewUrl,
        mediaType: file.type.startsWith("video/") ? "video" : "image",
      });
    }

    if (accepted.length > 0) {
      setSelectedMedia((current) => [...current, ...accepted]);
    }

    setError(rejected.length > 0 ? rejected.join(" ") : "");
  };

  const removeSelectedMedia = (index: number) => {
    setSelectedMedia((current) => {
      const item = current[index];

      if (item) {
        URL.revokeObjectURL(item.previewUrl);
        previewUrls.current.delete(item.previewUrl);
      }

      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const addEntry = async () => {
    if (
      !logbook ||
      (!entryText.trim() && selectedMedia.length === 0) ||
      savingEntry
    ) {
      return;
    }

    setSavingEntry(true);
    setError("");
    setUploadProgress("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: newEntry, error: insertError } = await supabase
        .from("entries")
        .insert({
          logbook_id: logbook.id,
          user_id: user.id,
          text: entryText.trim(),
        })
        .select("id, text, created_at")
        .single();

      if (insertError) throw insertError;

      const uploadErrors: string[] = [];

      for (let index = 0; index < selectedMedia.length; index++) {
        const item = selectedMedia[index];
        const file = item.file;

        setUploadProgress(
          `Uploading ${index + 1} of ${selectedMedia.length}: ${file.name}`
        );

        const safeFileName = file.name
          .normalize("NFKD")
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .slice(-120);

        const storagePath = `${user.id}/${newEntry.id}/${crypto.randomUUID()}-${safeFileName}`;

        const { error: storageError } = await supabase.storage
          .from("travel-media")
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (storageError) {
          uploadErrors.push(`${file.name}: ${storageError.message}`);
          continue;
        }

        const { error: metadataError } = await supabase
          .from("entry_media")
          .insert({
            entry_id: newEntry.id,
            uploaded_by: user.id,
            media_type: item.mediaType,
            storage_path: storagePath,
            mime_type: file.type,
            file_size_bytes: file.size,
            sort_order: index,
          });

        
if (metadataError) {
  // The file exists in Storage, but its database record failed.
  // Try to remove the unreferenced file to prevent orphaned media.
  const { error: cleanupError } = await supabase.storage
    .from("travel-media")
    .remove([storagePath]);

  if (cleanupError) {
    console.error(
      "Media metadata insert and storage cleanup both failed:",
      {
        fileName: file.name,
        storagePath,
        metadataError: metadataError.message,
        cleanupError: cleanupError.message,
      }
    );

    uploadErrors.push(
      `${file.name}: metadata failed, and uploaded-file cleanup also failed. ${cleanupError.message}`
    );
  } else {
    uploadErrors.push(
      `${file.name}: media metadata could not be saved, so the uploaded file was removed. ${metadataError.message}`
    );
  }
}

      }

      selectedMedia.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
        previewUrls.current.delete(item.previewUrl);
      });

      setEntryText("");
      setSelectedMedia([]);
      setUploadProgress("");

      await loadLogbook(logbook.id);

      if (uploadErrors.length > 0) {
        setError(
          `Entry saved, but some media failed:\n${uploadErrors.join("\n")}`
        );
      }
    } catch (err) {
      console.error("Could not save entry:", err);

      setError(
        err instanceof Error
          ? `Couldn't save the entry: ${err.message}`
          : "Couldn't save the entry. Please try again."
      );
    } finally {
      setSavingEntry(false);
      setUploadProgress("");
    }
  };

  const runEntryDeletionCleanup = async (entryId: string) => {
    if (deletingEntryId) return;

    setDeletingEntryId(entryId);
    setError("");

    try {
      const { data: paths, error: prepareError } = await supabase.rpc(
        "prepare_entry_deletion",
        { p_entry_id: entryId }
      );

      if (prepareError) throw prepareError;

      const storagePaths = Array.isArray(paths) ? (paths as string[]) : [];

      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("travel-media")
          .remove(storagePaths);

        if (storageError) {
          throw new Error(
            `The entry is hidden, but media cleanup failed: ${storageError.message}`
          );
        }
      }

      const { data: finalized, error: finalizeError } = await supabase.rpc(
        "finalize_entry_deletion",
        { p_entry_id: entryId }
      );

      if (finalizeError) throw finalizeError;

      if (finalized !== true) {
        throw new Error("Cleanup could not be finalized. Please retry.");
      }

      if (logbook) await loadLogbook(logbook.id);
    } catch (err) {
      console.error("Entry deletion cleanup failed:", err);

      const message =
        err instanceof Error
          ? err.message
          : "Deletion cleanup failed. Please retry.";

      if (logbook) await loadLogbook(logbook.id);
      setError(message);
    } finally {
      setDeletingEntryId(null);
    }
  };

  const deleteEntry = async (entryId: string) => {
    if (deletingEntryId) return;

    const confirmed = window.confirm(
      "Delete this entry? It will be hidden from the logbook. Replies will be preserved."
    );

    if (!confirmed) return;
    await runEntryDeletionCleanup(entryId);
  };

  const postReply = async (
    entryId: string,
    text: string,
    parentReplyId: string | null
  ) => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;

    if (!user) {
      router.push("/login");
      throw new Error("Please sign in to join the discussion.");
    }

    const { error: insertError } = await supabase.from("replies").insert({
      entry_id: entryId,
      parent_reply_id: parentReplyId,
      user_id: user.id,
      text,
    });

    if (insertError) throw insertError;

    if (logbook) {
      await loadLogbook(logbook.id);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-5 py-16 text-gray-900 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="h-2 w-24 animate-pulse rounded-full bg-orange-200" />
          <p className="mt-5 text-sm text-gray-500">
            Opening your logbook...
          </p>
        </div>
      </main>
    );
  }

  if (!logbook) {
    return (
      <main className="min-h-screen bg-white px-5 py-16 text-gray-900 sm:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white p-8 sm:p-12">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">
            Living Logbook
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            This page is out of the map.
          </h1>
          <p className="mt-3 text-sm leading-7 text-gray-500">
            This logbook may have been removed or the address may be incorrect.
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-6 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-700"
          >
            Back to discover
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <section className="mx-auto max-w-5xl px-5 pb-20 pt-8 sm:px-8 sm:pt-12">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition hover:text-orange-700"
        >
          <span aria-hidden="true">←</span>
          Back to discover
        </button>

        <header className="relative overflow-hidden rounded-[2rem] bg-gray-900 text-white shadow-sm">
          <div
            aria-hidden="true"
            className="absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="absolute right-8 top-8 h-40 w-40 rounded-full border border-orange-400/30"
          />

          <div className="relative px-6 py-9 sm:px-10 sm:py-12">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 text-lg">
                📖
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">
                  The destination journal
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Real experiences. Shared by travellers.
                </p>
              </div>
            </div>

            <h1 className="mt-8 max-w-3xl break-words text-4xl font-bold tracking-tight sm:text-5xl">
              {logbook.name}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-300 sm:text-base">
              A living record of this place, written by people who have
              actually been here. Discover what awaits before you arrive.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3 text-xs font-medium text-gray-300">
              <span className="rounded-full border border-white/15 px-3 py-2">
                <span className="mr-2 text-orange-400">●</span>
                Community logbook
              </span>
              <span className="rounded-full border border-white/15 px-3 py-2">
                {logbook.latitude.toFixed(4)}, {logbook.longitude.toFixed(4)}
              </span>
            </div>
          </div>

          <div className="relative grid border-t border-white/10 bg-black/10 sm:grid-cols-3">
            <div className="px-6 py-5 sm:px-10">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-gray-400">
                Entries
              </p>
              <p className="mt-2 text-2xl font-bold">
                {logbook.entries.length}
              </p>
            </div>

            <div className="border-t border-white/10 px-6 py-5 sm:border-l sm:border-t-0 sm:px-10">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-gray-400">
                Conversations
              </p>
              <p className="mt-2 text-2xl font-bold">
                {logbook.entries.reduce(
                  (total, entry) => total + countReplies(entry.replies),
                  0
                )}
              </p>
            </div>

            <div className="border-t border-white/10 px-6 py-5 sm:border-l sm:border-t-0 sm:px-10">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-gray-400">
                Established
              </p>
              <p className="mt-2 text-sm font-semibold">
                {new Date(logbook.createdAt).toLocaleDateString([], {
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mt-6 whitespace-pre-wrap rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
          >
            {error}
            <button
              onClick={() => setError("")}
              className="ml-3 font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <section className="mt-10 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex items-start gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-xl sm:flex">
              ✍️
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-700">
                Leave your mark
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Add to the story.
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Share something useful, memorable, or unexpected about this
                place.
              </p>
            </div>
          </div>

          <textarea
            value={entryText}
            onChange={(event) => setEntryText(event.target.value)}
            placeholder="What should the next traveller know?"
            rows={5}
            className="mt-6 w-full resize-y rounded-2xl border border-gray-200 bg-gray-50/70 px-5 py-4 text-sm leading-7 outline-none transition placeholder:text-gray-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-50"
          />

          {selectedMedia.length > 0 && (
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900">
                  Your attachments
                </p>
                <span className="text-xs text-gray-400">
                  {selectedMedia.length} selected
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {selectedMedia.map((item, index) => (
                  <div
                    key={item.previewUrl}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
                  >
                    {item.mediaType === "image" ? (
                      <img
                        src={item.previewUrl}
                        alt={`Selected image ${index + 1}`}
                        className="h-36 w-full object-cover"
                      />
                    ) : (
                      <video
                        src={item.previewUrl}
                        controls
                        preload="metadata"
                        className="h-36 w-full bg-gray-900 object-contain"
                      />
                    )}

                    <div className="flex items-center justify-between gap-2 p-3">
                      <p className="truncate text-xs text-gray-500">
                        {item.file.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeSelectedMedia(index)}
                        disabled={savingEntry}
                        className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs leading-5 text-gray-400">
                Maximum 50 MB per file. JPEG, PNG, WebP, AVIF, MP4 and WebM.
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <label
              className={`inline-flex w-fit items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition ${
                savingEntry
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer hover:border-orange-300 hover:bg-orange-50/50"
              }`}
            >
              <span className="text-lg">＋</span>
              Add photos or videos
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"
                multiple
                onChange={handleMediaSelection}
                disabled={savingEntry}
                className="hidden"
              />
            </label>

            <button
              onClick={addEntry}
              disabled={
                (!entryText.trim() && selectedMedia.length === 0) ||
                savingEntry
              }
              className="rounded-xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 focus:outline-none focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingEntry
                ? uploadProgress || "Saving entry..."
                : "Publish entry →"}
            </button>
          </div>

          {savingEntry && (
            <p className="mt-3 text-xs text-gray-400">
              Keep this page open while your entry and attachments are saved.
            </p>
          )}
        </section>

        <section className="mt-14">
          <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">
                Field notes
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                From the travellers.
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Every entry adds another perspective to this destination.
              </p>
            </div>

            <span className="w-fit rounded-full border border-gray-200 px-4 py-2 text-xs font-medium text-gray-500">
              {logbook.entries.length}{" "}
              {logbook.entries.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          {logbook.entries.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50/50 px-6 py-16 text-center sm:px-12">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-3xl">
                📓
              </div>
              <h3 className="mt-5 text-xl font-bold tracking-tight">
                A blank page. A chance to begin.
              </h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-gray-500">
                Be the first traveller to share an observation, a photograph,
                or a useful tip about this place.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {logbook.entries.map((entry, index) => (
                <article
                  key={entry.id}
                  className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:border-gray-300 hover:shadow-md"
                >
                  <div className="p-5 sm:p-8">
                    {entry.is_deleted ? (
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-sm font-bold text-gray-400">
                          {String(logbook.entries.length - index).padStart(
                            2,
                            "0"
                          )}
                        </div>

                        <div className="min-w-0 flex-1 rounded-xl bg-gray-50 px-4 py-4">
                          <p className="text-sm italic text-gray-500">
                            This entry was deleted by the user.
                          </p>
                          <time className="mt-2 block text-xs text-gray-400">
                            {formatDateTime(entry.timestamp)}
                          </time>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-sm font-bold text-orange-800">
                            {String(logbook.entries.length - index).padStart(
                              2,
                              "0"
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-bold text-gray-900">
                                  Traveller&apos;s note
                                </p>
                                <p className="mt-1 text-xs text-gray-400">
                                  An observation from the field
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-3">
                                <time className="text-xs font-medium text-gray-400">
                                  {formatDateTime(entry.timestamp)}
                                </time>

                                {entry.user_id === currentUserId && (
                                  <button
                                    type="button"
                                    onClick={() => void deleteEntry(entry.id)}
                                    disabled={deletingEntryId !== null}
                                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {deletingEntryId === entry.id
                                      ? "Deleting..."
                                      : "Delete entry"}
                                  </button>
                                )}
                              </div>
                            </div>

                            {entry.text && (
                              <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-gray-700 sm:text-base sm:leading-8">
                                {entry.text}
                              </p>
                            )}
                          </div>
                        </div>

                        {entry.media.length > 0 && (
                          <div
                            className={`mt-6 grid gap-3 ${
                              entry.media.length === 1
                                ? "grid-cols-1"
                                : "grid-cols-1 sm:grid-cols-2"
                            }`}
                          >
                            {entry.media.map((media) => (
                              <div
                                key={media.id}
                                className="overflow-hidden rounded-2xl bg-gray-100"
                              >
                                {media.media_type === "image" ? (
                                  <a
                                    href={media.publicUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="Open full-size image"
                                  >
                                    <img
                                      src={media.publicUrl}
                                      alt="Photo contributed to this logbook"
                                      loading="lazy"
                                      className={`w-full object-contain ${
                                        entry.media.length === 1
                                          ? "max-h-[560px]"
                                          : "max-h-[360px]"
                                      }`}
                                    />
                                  </a>
                                ) : (
                                  <video
                                    src={media.publicUrl}
                                    controls
                                    preload="metadata"
                                    className="max-h-[480px] w-full bg-gray-900"
                                  >
                                    Your browser does not support video playback.
                                  </video>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Replies stay visible even when the parent entry is deleted. */}
                    <EntryReplies entry={entry} onReply={postReply} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-14 border-t border-gray-200 pt-6 text-center">
          <p className="text-xs leading-6 text-gray-400">
            Every destination has a story. Every traveller adds a page.
          </p>
        </footer>
      </section>
    </main>
  );
}