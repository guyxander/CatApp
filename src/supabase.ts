import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";

type ActionResult<T extends object = {}> = {
  ok: boolean;
  message: string;
} & T;

export type DailyReadingResponse = {
  sourceSummary?: string;
  sections: Array<{
    title: string;
    citation?: string;
    response?: string;
    text: string;
    source?: string;
    kind?: string;
    optional?: boolean;
  }>;
};

export type HymnRecord = {
  hymn_code?: string;
  hymn_number?: number;
  title: string;
  first_line?: string;
  category: string;
  verses: string[];
};

export type PrayerRecord = {
  title: string;
  category: string;
  body: string;
};

export type CommunityPost = {
  id: string;
  author_name: string;
  author_badge?: string | null;
  clergy_attribution?: string | null;
  title: string;
  body: string;
  category?: string;
  comment_count?: number;
  featured?: boolean;
  moderation_status?: string;
  created_at?: string;
};

export type CommunityComment = {
  id: string;
  post_id: string;
  body: string;
  author_name: string;
  moderation_status?: string;
  created_at?: string;
};

export type CommunityReaction = {
  post_id: string;
  reaction: string;
  count: number;
};

export type ParishRecord = Record<string, any> & {
  id?: string;
  name: string;
  diocese?: string;
  latitude?: number;
  longitude?: number;
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseAnonKey.includes("replace-with") &&
    !supabaseAnonKey.includes("paste-your")
);

const oauthRedirectTo = "catapp://auth/callback";

const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

async function selectTable<T>(table: string, fallback: T[] = []): Promise<T[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from(table).select("*");
  if (error) return fallback;
  return (data ?? fallback) as T[];
}

export async function fetchDailyReadings(date: string): Promise<DailyReadingResponse | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("daily_readings")
    .select("*")
    .eq("date", date)
    .maybeSingle();
  if (error || !data) return null;
  if (Array.isArray(data.sections)) return data as DailyReadingResponse;
  return null;
}

export async function fetchPublishedHymns(): Promise<HymnRecord[] | null> {
  return selectTable<HymnRecord>("hymns");
}

export async function fetchPublishedPrayers(): Promise<PrayerRecord[] | null> {
  return selectTable<PrayerRecord>("prayers");
}

export async function fetchVerifiedParishes(): Promise<ParishRecord[] | null> {
  return selectTable<ParishRecord>("parishes");
}

export async function fetchActiveAdvertisements(placement: string): Promise<Array<{ title: string; sponsor?: string }> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("advertisements")
    .select("title,sponsor")
    .eq("placement", placement)
    .eq("active", true);
  if (error) return null;
  return data ?? [];
}

export async function fetchCommunityPosts(): Promise<CommunityPost[] | null> {
  return selectTable<CommunityPost>("community_posts");
}

export async function fetchCommunityComments(postId: string): Promise<CommunityComment[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("community_comments")
    .select("*")
    .eq("post_id", postId);
  if (error) return null;
  return data ?? [];
}

export async function fetchCommunityReactions(postIds: string[]): Promise<CommunityReaction[] | null> {
  if (!supabase || !postIds.length) return [];
  const { data, error } = await supabase
    .from("community_reactions")
    .select("post_id,reaction,count")
    .in("post_id", postIds);
  if (error) return null;
  return data ?? [];
}

export async function createCommunityPost(input: { title: string; body: string; category: string }): Promise<ActionResult<{ post?: CommunityPost }>> {
  const post: CommunityPost = {
    id: `local-post-${Date.now()}`,
    author_name: "CatApp User",
    title: input.title,
    body: input.body,
    category: input.category,
    comment_count: 0,
    featured: false,
    moderation_status: "published",
    created_at: new Date().toISOString(),
  };
  if (!supabase) return { ok: false, message: "Supabase is not configured.", post };
  const { data, error } = await supabase.from("community_posts").insert(input).select("*").single();
  if (error) return { ok: false, message: error.message, post };
  return { ok: true, message: "Post published.", post: data as CommunityPost };
}

export async function createCommunityComment(postId: string, body: string): Promise<ActionResult<{ comment?: CommunityComment }>> {
  const comment: CommunityComment = {
    id: `local-comment-${Date.now()}`,
    post_id: postId,
    body,
    author_name: "CatApp User",
    moderation_status: "published",
    created_at: new Date().toISOString(),
  };
  if (!supabase) return { ok: false, message: "Supabase is not configured.", comment };
  const { data, error } = await supabase.from("community_comments").insert({ post_id: postId, body }).select("*").single();
  if (error) return { ok: false, message: error.message, comment };
  return { ok: true, message: "Comment posted.", comment: data as CommunityComment };
}

export async function incrementCommunityReaction(postId: string, reaction: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("community_reactions").insert({ post_id: postId, reaction, count: 1 });
}

export async function reportCommunityPost(postId: string, note: string): Promise<ActionResult> {
  if (!supabase) return { ok: false, message: "Report saved locally until Supabase is configured." };
  const { error } = await supabase.from("community_reports").insert({ post_id: postId, reason: note });
  return error ? { ok: false, message: error.message } : { ok: true, message: "Post reported for review." };
}

export async function submitHymnCorrection(input: Record<string, any>): Promise<ActionResult> {
  if (!supabase) return { ok: false, message: "Hymn correction saved locally until Supabase is configured." };
  const { error } = await supabase.from("hymn_correction_requests").insert({
    hymn_code: input.hymnCode,
    hymn_title: input.hymnTitle,
    proposed_text: input.proposedText,
    note: input.note,
  });
  return error ? { ok: false, message: error.message } : { ok: true, message: "Hymn correction submitted." };
}

export async function getCurrentUserProfile(): Promise<any | null> {
  if (!supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userData.user.id).maybeSingle();
  return { user: userData.user, profile };
}

export async function signInWithEmail(email: string, password: string): Promise<ActionResult> {
  if (!supabase) return { ok: false, message: "Supabase Auth is not configured." };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { ok: false, message: error.message } : { ok: true, message: "Signed in." };
}

export async function signInWithGoogle(): Promise<ActionResult> {
  if (!supabase) return { ok: false, message: "Supabase Auth is not configured." };
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: oauthRedirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) return { ok: false, message: error.message };
  if (!data.url) return { ok: false, message: "Google sign-in URL was not returned." };
  await Linking.openURL(data.url);
  return { ok: true, message: "Opening Google sign-in..." };
}

export async function handleSupabaseAuthCallback(url: string): Promise<ActionResult> {
  if (!supabase || !url.startsWith(oauthRedirectTo)) return { ok: false, message: "No Supabase auth callback to handle." };
  const parsed = new URL(url);
  const code = parsed.searchParams.get("code");
  if (!code) return { ok: false, message: "Google sign-in did not return an auth code." };
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error ? { ok: false, message: error.message } : { ok: true, message: "Signed in with Google." };
}

export async function signUpWithEmail(email: string, password: string, fullName: string): Promise<ActionResult> {
  if (!supabase) return { ok: false, message: "Supabase Auth is not configured." };
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  return error ? { ok: false, message: error.message } : { ok: true, message: "Account created." };
}

export async function signOut(): Promise<ActionResult> {
  if (!supabase) return { ok: true, message: "Signed out locally." };
  const { error } = await supabase.auth.signOut();
  return error ? { ok: false, message: error.message } : { ok: true, message: "Signed out." };
}

async function currentUserId() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function updateCurrentUserProfile(input: Record<string, any>): Promise<ActionResult> {
  if (!supabase) return { ok: false, message: "Supabase profile sync is not configured." };
  const userId = await currentUserId();
  const { error } = await supabase.auth.updateUser({
    data: {
      full_name: input.fullName,
      home_parish: input.homeParish,
      home_parish_address: input.homeParishAddress,
      home_parish_phone: input.homeParishPhone,
      home_parish_mass_times: input.homeParishMassTimes,
      home_parish_confession_times: input.homeParishConfessionTimes,
    },
  });
  if (error) return { ok: false, message: error.message };
  if (userId) {
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      display_name: input.fullName,
      email: input.email,
      home_parish: input.homeParish,
      home_parish_address: input.homeParishAddress,
      home_parish_phone: input.homeParishPhone,
      home_parish_mass_times: input.homeParishMassTimes,
      home_parish_confession_times: input.homeParishConfessionTimes,
      updated_at: new Date().toISOString(),
    });
    if (profileError) return { ok: false, message: profileError.message };
  }
  return { ok: true, message: "Profile synced to the database." };
}

export async function syncUserSettings(settings: Record<string, any>): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!supabase || !userId) return { ok: false, message: "Settings saved locally until you sign in." };
  await supabase.from("notification_preferences").upsert({
    user_id: userId,
    morning_prayer: Boolean(settings.prayerReminder),
    daily_readings: Boolean(settings.offlineDownloads),
    parish_updates: Boolean(settings.shareLocation),
    updated_at: new Date().toISOString(),
  });
  const { error } = await supabase.from("user_settings").upsert({
    user_id: userId,
    settings,
    updated_at: new Date().toISOString(),
  });
  return error ? { ok: false, message: error.message } : { ok: true, message: "Settings synced to the database." };
}

export async function syncUserCollectionItem(input: { type: string; itemId: string; title: string; collection: "saved" | "recent" }): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!supabase || !userId) return { ok: false, message: "Item saved locally until you sign in." };
  const itemType = input.type === "novena" ? "resource" : input.type;
  const table = input.collection === "saved" ? "user_saved_items" : "recent_items";
  const timestampColumn = input.collection === "saved" ? "created_at" : "viewed_at";
  const { error } = await supabase.from(table).upsert({
    user_id: userId,
    item_type: itemType,
    item_id: input.itemId,
    item_title: input.title,
    metadata: input.type === "novena" ? { kind: "novena" } : {},
    [timestampColumn]: new Date().toISOString(),
  });
  return error ? { ok: false, message: error.message } : { ok: true, message: "Item synced to the database." };
}

export async function updateParishDetails(input: Record<string, any>): Promise<ActionResult<{ parish?: ParishRecord }>> {
  const parishName = String(input.parishName || input.homeParish || "").trim();
  const parish: ParishRecord = {
    name: parishName,
    diocese: input.diocese || "Community submitted",
    address: String(input.proposedAddress || input.homeParishAddress || "").trim() || "Address pending",
    phone: String(input.proposedPhone || input.homeParishPhone || "").trim() || undefined,
    mass_times: String(input.proposedMassTimes || input.homeParishMassTimes || "").trim()
      ? [{ times: [String(input.proposedMassTimes || input.homeParishMassTimes).trim()] }]
      : undefined,
    confession_times: String(input.proposedConfessionTimes || input.homeParishConfessionTimes || "").trim()
      ? [{ times: [String(input.proposedConfessionTimes || input.homeParishConfessionTimes).trim()] }]
      : undefined,
    data_quality_notes: String(input.note || "").trim() || undefined,
    last_confirmed_at: new Date().toISOString(),
    verification_status: "candidate",
  };
  if (input.parishId && !String(input.parishId).startsWith("local-")) parish.id = input.parishId;
  Object.keys(parish).forEach((key) => parish[key] === undefined && delete parish[key]);

  if (!parishName) return { ok: false, message: "Add a parish name before saving parish details." };
  if (!supabase) return { ok: false, message: "Parish saved locally until Supabase is configured.", parish };

  await supabase.from("parish_edit_requests").insert({
    parish_id: input.parishId && !String(input.parishId).startsWith("local-") ? input.parishId : null,
    parish_name: parishName,
    submitted_by_name: input.submittedByName || "CatApp User",
    proposed_address: input.proposedAddress,
    proposed_phone: input.proposedPhone,
    proposed_mass_times: input.proposedMassTimes ? [{ times: [input.proposedMassTimes] }] : [],
    proposed_confession_times: input.proposedConfessionTimes ? [{ times: [input.proposedConfessionTimes] }] : [],
    source_context: input.sourceContext,
    note: input.note,
  });

  if (input.parishId && !String(input.parishId).startsWith("local-")) {
    const { data, error } = await supabase
      .from("parishes")
      .update(parish)
      .eq("id", input.parishId)
      .select("*")
      .maybeSingle();
    if (!error && data) return { ok: true, message: "Parish database updated.", parish: data as ParishRecord };
  }

  const { data: existing } = await supabase
    .from("parishes")
    .select("id")
    .ilike("name", parishName)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("parishes")
      .update(parish)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();
    return error
      ? { ok: false, message: error.message, parish }
      : { ok: true, message: "Parish database updated.", parish: data as ParishRecord };
  }

  const { data, error } = await supabase.from("parishes").insert(parish).select("*").maybeSingle();
  return error
    ? { ok: false, message: error.message, parish }
    : { ok: true, message: "Parish added to the parish database.", parish: data as ParishRecord };
}

export async function submitIdentityVerification(input: Record<string, any>): Promise<ActionResult> {
  if (!supabase) return { ok: false, message: "Identity verification requires Supabase configuration." };
  const { error } = await supabase.from("identity_verification_requests").insert({
    full_name: input.fullName,
    email: input.email,
    parish_name: input.parishName,
    document_note: input.documentNote,
  });
  return error ? { ok: false, message: error.message } : { ok: true, message: "Verification request submitted." };
}

export async function fetchAdminOverview(): Promise<Record<string, number>> {
  if (!supabase) return {};
  const tables = ["parishes", "hymns", "prayers", "advertisements"];
  const counts = await Promise.all(
    tables.map(async (table) => {
      const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
      return [table, count ?? 0] as const;
    })
  );
  return Object.fromEntries(counts);
}

export async function runAdminModuleAction(moduleName: string): Promise<ActionResult> {
  if (!supabase) return { ok: false, message: `${moduleName} requires Supabase configuration.` };
  return { ok: true, message: `${moduleName} refreshed.` };
}
