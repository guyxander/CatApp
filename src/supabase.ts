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
  author_id?: string | null;
  author_name: string;
  author_username?: string | null;
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
  author_id?: string | null;
  body: string;
  author_name: string;
  author_username?: string | null;
  moderation_status?: string;
  created_at?: string;
};

export type CommunityReaction = {
  post_id: string;
  reaction: string;
  count: number;
};

export type PublicProfile = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  home_parish?: string | null;
  catholic_status?: string | null;
  verification_status?: string | null;
};

export type ParishRecord = Record<string, any> & {
  id?: string;
  name: string;
  diocese?: string;
  latitude?: number;
  longitude?: number;
};

export type AdvertisementRecord = {
  id?: string;
  title: string;
  sponsor?: string | null;
  body?: string | null;
  placement?: string;
  target_url?: string | null;
  status?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at?: string | null;
  priority?: number | null;
};

export type AdminModuleName =
  | "Content Management"
  | "Daily Reading Approvals"
  | "Hymn Corrections"
  | "Parish Management"
  | "Community Reports"
  | "Identity Verification"
  | "Advertisement Management"
  | "Roles & Access"
  | "Audit Logs";

export type AdminModuleData = {
  rows: Record<string, any>[];
  related?: Record<string, any[]>;
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

function readAuthCallbackParams(url: string) {
  const [, fragment = ""] = url.split("#");
  const [, query = ""] = url.split("?");
  const params = new URLSearchParams(query.split("#")[0]);
  const fragmentParams = new URLSearchParams(fragment);
  fragmentParams.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  return params;
}

const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: "pkce",
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

export async function fetchActiveAdvertisements(placement: string): Promise<AdvertisementRecord[] | null> {
  if (!supabase) return null;
  const now = new Date().toISOString();
  const runQuery = (targetPlacement: string) => supabase
    .from("advertisements")
    .select("id,title,sponsor,body,placement,target_url,status,starts_at,ends_at,created_at,priority")
    .eq("placement", targetPlacement)
    .eq("status", "active")
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(3);
  const { data, error } = await runQuery(placement);
  if (error) {
    console.warn("CatApp advert fetch failed", error.message);
    return null;
  }
  if (data?.length || placement === "today_top") return data ?? [];
  const fallback = await runQuery("today_top");
  if (fallback.error) return [];
  return fallback.data ?? [];
}

export async function createAdvertisement(input: Record<string, any>): Promise<ActionResult<{ advertisement?: Record<string, any> }>> {
  if (!supabase) return { ok: false, message: "Advertisement management is not available yet." };
  try {
    const admin = await ensureAdmin();
    const payload = {
      title: String(input.title || "").trim(),
      sponsor: String(input.sponsor || "").trim() || null,
      placement: String(input.placement || "today_top").trim(),
      status: String(input.status || "active").trim(),
      body: String(input.body || "").trim() || null,
      target_url: String(input.targetUrl || "").trim() || null,
      starts_at: input.startsAt || new Date().toISOString(),
      ends_at: input.endsAt || null,
      updated_at: new Date().toISOString(),
    };
    if (!payload.title) return { ok: false, message: "Add an advert title before saving." };
    const { data, error } = await supabase.rpc("create_catapp_ad", {
      p_title: payload.title,
      p_sponsor: payload.sponsor,
      p_placement: payload.placement,
      p_body: payload.body,
      p_target_url: payload.target_url,
      p_status: payload.status,
      p_starts_at: payload.starts_at,
      p_ends_at: payload.ends_at,
    });
    if (error) {
      const detail = error.code === "42501"
        ? "Advert posting is blocked for this account. Confirm this account is marked as admin."
        : error.message;
      return { ok: false, message: detail };
    }
    await logAdminAction("create_ad", "advertisement", data?.id, { title: payload.title, placement: payload.placement });
    return { ok: true, message: `Advertisement posted by ${admin.profile?.display_name || admin.user.email || "admin"}.`, advertisement: data ?? payload };
  } catch (error: any) {
    return { ok: false, message: error.message ?? "Advertisement could not be posted." };
  }
}

export async function fetchCommunityPosts(): Promise<CommunityPost[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("moderation_status", "published")
    .order("created_at", { ascending: false });
  if (error) return null;
  return data ?? [];
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

export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase.rpc("get_public_community_profile", { p_user_id: userId });
  if (error) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

export async function fetchCommunityPostsByAuthor(userId: string): Promise<CommunityPost[] | null> {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("author_id", userId)
    .eq("moderation_status", "published")
    .order("created_at", { ascending: false });
  if (error) return null;
  return data ?? [];
}

export async function createCommunityPost(input: { title: string; body: string; category: string }): Promise<ActionResult<{ post?: CommunityPost }>> {
  const post: CommunityPost = {
    id: `local-post-${Date.now()}`,
    author_name: "Guest",
    title: input.title,
    body: input.body,
    category: input.category,
    comment_count: 0,
    featured: false,
    moderation_status: "published",
    created_at: new Date().toISOString(),
  };
  if (!supabase) return { ok: false, message: "Community posting is not available yet.", post };
  const { data, error } = await supabase.rpc("create_catapp_community_post", {
    p_title: input.title,
    p_body: input.body,
    p_category: input.category,
  });
  if (error) return { ok: false, message: error.message, post };
  return { ok: true, message: "Post published.", post: data as CommunityPost };
}

export async function createCommunityComment(postId: string, body: string): Promise<ActionResult<{ comment?: CommunityComment }>> {
  const comment: CommunityComment = {
    id: `local-comment-${Date.now()}`,
    post_id: postId,
    body,
    author_name: "Guest",
    moderation_status: "published",
    created_at: new Date().toISOString(),
  };
  if (!supabase) return { ok: false, message: "Community comments are not available yet.", comment };
  const { data, error } = await supabase.rpc("create_catapp_community_comment", {
    p_post_id: postId,
    p_body: body,
  });
  if (error) return { ok: false, message: error.message, comment };
  return { ok: true, message: "Comment posted.", comment: data as CommunityComment };
}

export async function followCommunityUser(userId: string): Promise<ActionResult> {
  if (!supabase) return { ok: false, message: "Sign in to follow people." };
  const { error } = await supabase.rpc("follow_catapp_user", { p_followed_id: userId });
  return error ? { ok: false, message: error.message } : { ok: true, message: "Following." };
}

export async function deleteCommunityPost(postId: string): Promise<ActionResult> {
  if (!supabase) return { ok: false, message: "Sign in to delete posts." };
  const { error } = await supabase.rpc("delete_own_community_post", { p_post_id: postId });
  return error ? { ok: false, message: error.message } : { ok: true, message: "Post deleted." };
}

export async function fetchMyCommunityPosts(): Promise<CommunityPost[] | null> {
  if (!supabase) return null;
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("author_id", userId)
    .neq("moderation_status", "removed")
    .order("created_at", { ascending: false });
  if (error) return null;
  return data ?? [];
}

export async function incrementCommunityReaction(postId: string, reaction: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("community_reactions").insert({ post_id: postId, reaction, count: 1 });
}

export async function reportCommunityPost(postId: string, note: string): Promise<ActionResult> {
  if (!supabase) return { ok: false, message: "Reports are not available yet." };
  const { error } = await supabase.from("community_reports").insert({ post_id: postId, reason: note });
  return error ? { ok: false, message: error.message } : { ok: true, message: "Post reported for review." };
}

export async function submitHymnCorrection(input: Record<string, any>): Promise<ActionResult> {
  if (!supabase) return { ok: false, message: "Hymn corrections are not available yet." };
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
  if (!supabase) return { ok: false, message: "Sign in is not configured." };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { ok: false, message: error.message } : { ok: true, message: "Signed in." };
}

export async function signInWithGoogle(): Promise<ActionResult> {
  if (!supabase) return { ok: false, message: "Sign in is not configured." };
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: oauthRedirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) return { ok: false, message: error.message };
  if (!data.url) return { ok: false, message: "Google sign-in URL was not returned." };
  const canOpen = await Linking.canOpenURL(data.url);
  if (!canOpen) return { ok: false, message: "This device could not open the Google sign-in page." };
  await Linking.openURL(data.url);
  return { ok: true, message: "Opening Google sign-in..." };
}

export async function handleSupabaseAuthCallback(url: string): Promise<ActionResult> {
  if (!supabase) return { ok: false, message: "Sign in is not configured." };
  if (!url.startsWith(oauthRedirectTo) && !url.includes("auth/callback")) {
    return { ok: false, message: "No sign-in callback to handle." };
  }
  const params = readAuthCallbackParams(url);
  const authError = params.get("error_description") || params.get("error");
  if (authError) return { ok: false, message: authError };
  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? { ok: false, message: error.message } : { ok: true, message: "Signed in with Google." };
  }
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return error ? { ok: false, message: error.message } : { ok: true, message: "Signed in with Google." };
  }
  return { ok: false, message: "Google sign-in returned without a usable auth code. Check the redirect URL allow-list for catapp://auth/callback." };
}

export async function signUpWithEmail(email: string, password: string, fullName: string): Promise<ActionResult> {
  if (!supabase) return { ok: false, message: "Sign up is not configured." };
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

async function currentAdminProfile() {
  if (!supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,display_name,email,is_admin,verification_status")
    .eq("id", userData.user.id)
    .maybeSingle();
  const role = userData.user.app_metadata?.role;
  if (!profile?.is_admin && role !== "superadmin") return null;
  return { user: userData.user, profile, role };
}

async function ensureAdmin() {
  const admin = await currentAdminProfile();
  if (!admin) throw new Error("Admin access is required.");
  return admin;
}

async function logAdminAction(action: string, entityType: string, entityId?: string, metadata: Record<string, any> = {}) {
  if (!supabase) return;
  const admin = await currentAdminProfile();
  if (!admin) return;
  await supabase.from("admin_audit_logs").insert({
    actor_id: admin.user.id,
    actor_name: admin.profile?.display_name || admin.user.email,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
}

export async function updateCurrentUserProfile(input: Record<string, any>): Promise<ActionResult> {
  if (!supabase) return { ok: false, message: "Profile sync is not available yet." };
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

export async function syncHomeParishFromProfile(input: Record<string, any>): Promise<ActionResult<{ parish?: ParishRecord }>> {
  const parishName = String(input.homeParish || input.parishName || "").trim();
  if (!parishName) return { ok: false, message: "Add a home parish before syncing it to the parish database." };
  return updateParishDetails({
    parishName,
    submittedByName: input.fullName || input.email || "CatApp profile",
    proposedAddress: input.homeParishAddress,
    proposedPhone: input.homeParishPhone,
    proposedMassTimes: input.homeParishMassTimes,
    proposedConfessionTimes: input.homeParishConfessionTimes,
    sourceContext: "profile_home_parish",
    note: `Home parish details updated from ${input.fullName || input.email || "a CatApp user"}'s profile.`,
  });
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
  if (!supabase) return { ok: false, message: "Parish saved locally until sync is available.", parish };

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

async function uploadVerificationDocument(input: Record<string, any>) {
  if (!supabase || !input.documentUri) return null;
  const userId = await currentUserId();
  const extension = String(input.documentFileName || input.documentUri).split(".").pop()?.split("?")[0] || "jpg";
  const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
  const path = `${userId || "anonymous"}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExtension}`;
  const response = await fetch(input.documentUri);
  const body = await response.arrayBuffer();
  const { data, error } = await supabase.storage
    .from("baptismal-cards")
    .upload(path, body, {
      contentType: input.documentMimeType || "image/jpeg",
      upsert: false,
    });
  if (error) throw error;
  const { data: publicUrl } = supabase.storage.from("baptismal-cards").getPublicUrl(data.path);
  return { path: data.path, publicUrl: publicUrl.publicUrl };
}

export async function submitIdentityVerification(input: Record<string, any>): Promise<ActionResult> {
  if (!supabase) return { ok: false, message: "Identity verification is not available yet." };
  try {
    const upload = await uploadVerificationDocument(input);
  const { error } = await supabase.from("identity_verification_requests").insert({
    full_name: input.fullName,
    email: input.email,
    parish_name: input.parishName,
    document_note: input.documentNote,
      document_url: upload?.publicUrl || input.documentUrl || null,
      document_path: upload?.path || null,
      document_file_name: input.documentFileName || null,
      document_mime_type: input.documentMimeType || null,
  });
  return error ? { ok: false, message: error.message } : { ok: true, message: "Verification request submitted." };
  } catch (error: any) {
    return { ok: false, message: error.message ?? "Verification request could not be submitted." };
  }
}

async function countRows(table: string, filters: Record<string, string> = {}) {
  if (!supabase) return 0;
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  const { count } = await query;
  return count ?? 0;
}

export async function fetchAdminOverview(): Promise<Record<string, number>> {
  if (!supabase) return {};
  try {
    await ensureAdmin();
    const [
      parishes,
      hymns,
      prayers,
      ads,
      pendingIdentity,
      pendingPosts,
      pendingReports,
      pendingParishEdits,
      hymnCorrections,
      readingApprovals,
      candidateParishes,
      users,
      auditLogs,
    ] = await Promise.all([
      countRows("parishes"),
      countRows("hymns"),
      countRows("prayers"),
      countRows("advertisements"),
      countRows("identity_verification_requests", { status: "pending" }),
      countRows("community_posts", { moderation_status: "pending" }),
      countRows("community_reports", { status: "pending" }),
      countRows("parish_edit_requests", { status: "pending" }),
      countRows("hymn_correction_requests", { status: "pending" }),
      countRows("reading_approval_requests", { status: "pending" }),
      countRows("parishes", { verification_status: "candidate" }),
      countRows("profiles"),
      countRows("admin_audit_logs"),
    ]);
    return {
      parishes,
      hymns,
      prayers,
      ads,
      pendingIdentity,
      pendingPosts,
      pendingReports,
      pendingParishEdits,
      hymnCorrections,
      readingApprovals,
      candidateParishes,
      users,
      auditLogs,
    };
  } catch {
    return {};
  }
}

export async function fetchAdminModuleData(moduleName: AdminModuleName): Promise<ActionResult<AdminModuleData>> {
  if (!supabase) return { ok: false, message: `${moduleName} is not available yet.`, rows: [] };
  try {
    await ensureAdmin();
    if (moduleName === "Parish Management") {
      const [edits, parishes] = await Promise.all([
        supabase.from("parish_edit_requests").select("*").order("created_at", { ascending: false }).limit(25),
        supabase.from("parishes").select("*").order("updated_at", { ascending: false }).limit(25),
      ]);
      if (edits.error) throw edits.error;
      return {
        ok: true,
        message: "Parish queues loaded.",
        rows: [
          ...((edits.data ?? []).map((row) => ({ ...row, __adminKind: "parish_edit" }))),
          ...((parishes.data ?? []).map((row) => ({ ...row, __adminKind: "parish_record" }))),
        ],
      };
    }
    if (moduleName === "Community Reports") {
      const [reports, posts] = await Promise.all([
        supabase.from("community_reports").select("*").order("created_at", { ascending: false }).limit(25),
        supabase.from("community_posts").select("*").neq("moderation_status", "published").order("created_at", { ascending: false }).limit(25),
      ]);
      if (reports.error) throw reports.error;
      return {
        ok: true,
        message: "Community moderation queues loaded.",
        rows: [
          ...((reports.data ?? []).map((row) => ({ ...row, __adminKind: "community_report" }))),
          ...((posts.data ?? []).map((row) => ({ ...row, __adminKind: "community_post" }))),
        ],
      };
    }
    if (moduleName === "Roles & Access") {
      const { data, error } = await supabase.from("profiles").select("*").order("updated_at", { ascending: false }).limit(50);
      if (error) throw error;
      return { ok: true, message: "Role list loaded.", rows: data ?? [] };
    }
    if (moduleName === "Identity Verification") {
      const { data, error } = await supabase.from("identity_verification_requests").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return { ok: true, message: "Identity verification queue loaded.", rows: data ?? [] };
    }
    if (moduleName === "Hymn Corrections") {
      const { data, error } = await supabase.from("hymn_correction_requests").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return { ok: true, message: "Hymn correction queue loaded.", rows: data ?? [] };
    }
    if (moduleName === "Daily Reading Approvals") {
      const { data, error } = await supabase.from("reading_approval_requests").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return { ok: true, message: "Reading approval queue loaded.", rows: data ?? [] };
    }
    if (moduleName === "Advertisement Management") {
      const { data, error } = await supabase.from("advertisements").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return { ok: true, message: "Advertisements loaded.", rows: data ?? [] };
    }
    if (moduleName === "Audit Logs") {
      const { data, error } = await supabase.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(75);
      if (error) throw error;
      return { ok: true, message: "Audit logs loaded.", rows: data ?? [] };
    }
    const [hymns, prayers, parishes] = await Promise.all([
      supabase.from("hymns").select("id,hymn_code,title,category,updated_at").order("updated_at", { ascending: false }).limit(12),
      supabase.from("prayers").select("id,title,category,updated_at").order("updated_at", { ascending: false }).limit(12),
      supabase.from("parishes").select("id,name,verification_status,updated_at").eq("verification_status", "candidate").order("updated_at", { ascending: false }).limit(12),
    ]);
    return {
      ok: true,
      message: "Content queues loaded.",
      rows: [
        ...((hymns.data ?? []).map((row) => ({ ...row, __adminKind: "hymn" }))),
        ...((prayers.data ?? []).map((row) => ({ ...row, __adminKind: "prayer" }))),
        ...((parishes.data ?? []).map((row) => ({ ...row, __adminKind: "candidate_parish" }))),
      ],
    };
  } catch (error: any) {
    return { ok: false, message: error.message ?? "Admin data could not be loaded.", rows: [] };
  }
}

export async function runAdminModuleAction(moduleName: AdminModuleName, action: string, record: Record<string, any>): Promise<ActionResult> {
  if (!supabase) return { ok: false, message: `${moduleName} is not available yet.` };
  try {
    await ensureAdmin();
    if (moduleName === "Parish Management") {
      if (action === "approve_edit") {
        const update = {
          name: record.parish_name,
          address: record.proposed_address || "Address pending",
          phone: record.proposed_phone || null,
          mass_times: record.proposed_mass_times || [],
          confession_times: record.proposed_confession_times || [],
          verification_status: "verified",
          last_confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (record.parish_id) await supabase.from("parishes").update(update).eq("id", record.parish_id);
        else await supabase.from("parishes").insert({ ...update, diocese: "Community verified" });
        await supabase.from("parish_edit_requests").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", record.id);
        await logAdminAction("approve_edit", "parish_edit_request", record.id, { parishName: record.parish_name });
        return { ok: true, message: "Parish edit approved." };
      }
      if (action === "reject_edit") {
        await supabase.from("parish_edit_requests").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", record.id);
        await logAdminAction("reject_edit", "parish_edit_request", record.id);
        return { ok: true, message: "Parish edit rejected." };
      }
      if (action === "verify_parish") {
        await supabase.from("parishes").update({ verification_status: "verified", verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", record.id);
        await logAdminAction("verify_parish", "parish", record.id);
        return { ok: true, message: "Parish marked verified." };
      }
      if (action === "withdraw_parish") {
        await supabase.from("parishes").update({ verification_status: "withdrawn", updated_at: new Date().toISOString() }).eq("id", record.id);
        await logAdminAction("withdraw_parish", "parish", record.id);
        return { ok: true, message: "Parish withdrawn from directory." };
      }
    }
    if (moduleName === "Community Reports") {
      if (action === "dismiss_report" || action === "action_report") {
        await supabase.from("community_reports").update({ status: action === "dismiss_report" ? "dismissed" : "actioned", reviewed_at: new Date().toISOString() }).eq("id", record.id);
        await logAdminAction(action, "community_report", record.id);
        return { ok: true, message: action === "dismiss_report" ? "Report dismissed." : "Report marked actioned." };
      }
      if (action === "publish_post" || action === "hold_post" || action === "remove_post") {
        const status = action === "publish_post" ? "published" : action === "hold_post" ? "held" : "removed";
        await supabase.from("community_posts").update({ moderation_status: status, updated_at: new Date().toISOString() }).eq("id", record.id);
        await logAdminAction(action, "community_post", record.id);
        return { ok: true, message: `Post marked ${status}.` };
      }
    }
    if (moduleName === "Identity Verification") {
      if (action === "approve_identity" || action === "reject_identity") {
        const status = action === "approve_identity" ? "approved" : "rejected";
        await supabase.from("identity_verification_requests").update({ status, reviewed_at: new Date().toISOString() }).eq("id", record.id);
        if (record.email) await supabase.from("profiles").update({ verification_status: status === "approved" ? "verified" : "rejected", updated_at: new Date().toISOString() }).eq("email", record.email);
        await logAdminAction(action, "identity_verification_request", record.id, { email: record.email });
        return { ok: true, message: `Identity request ${status}.` };
      }
    }
    if (moduleName === "Hymn Corrections") {
      const status = action === "approve_hymn" ? "approved" : action === "apply_hymn" ? "applied" : "rejected";
      await supabase.from("hymn_correction_requests").update({ status, reviewed_at: new Date().toISOString() }).eq("id", record.id);
      await logAdminAction(action, "hymn_correction_request", record.id, { hymnTitle: record.hymn_title });
      return { ok: true, message: `Hymn correction ${status}.` };
    }
    if (moduleName === "Daily Reading Approvals") {
      const status = action === "approve_reading" ? "approved" : action === "publish_reading" ? "published" : "rejected";
      await supabase.from("reading_approval_requests").update({ status, reviewed_at: new Date().toISOString() }).eq("id", record.id);
      await logAdminAction(action, "reading_approval_request", record.id, { title: record.title });
      return { ok: true, message: `Reading request ${status}.` };
    }
    if (moduleName === "Advertisement Management") {
      const status = action === "activate_ad" ? "active" : action === "pause_ad" ? "paused" : "ended";
      await supabase.from("advertisements").update({ status }).eq("id", record.id);
      await logAdminAction(action, "advertisement", record.id, { title: record.title });
      return { ok: true, message: `Advertisement ${status}.` };
    }
    if (moduleName === "Roles & Access") {
      if (record.id) {
        const next = action === "promote_admin";
        await supabase.from("profiles").update({ is_admin: next, updated_at: new Date().toISOString() }).eq("id", record.id);
        await logAdminAction(action, "profile", record.id, { displayName: record.display_name });
        return { ok: true, message: next ? "User promoted to admin." : "Admin access removed." };
      }
    }
    return { ok: false, message: "No action was available for this record." };
  } catch (error: any) {
    return { ok: false, message: error.message ?? "Admin action failed." };
  }
}
