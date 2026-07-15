import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useState } from "react";
import dailyReadingEntriesData from "./assets/data/daily-readings-docx-entries.json";
import nigeriaOrdo2026Data from "./assets/data/nigeria-ordo-2026.json";
import hymnsData from "./assets/data/hymns.json";
import novenasData from "./assets/data/novenas.json";
import prayersData from "./assets/data/prayers.json";
import {
  createCommunityComment,
  createCommunityPost,
  deleteCommunityPost,
  createAdvertisement,
  fetchActiveAdvertisements,
  fetchAdminOverview,
  fetchAdminModuleData,
  fetchCommunityComments,
  fetchCommunityPosts,
  fetchCommunityPostsByAuthor,
  fetchCommunityReactions,
  fetchMyCommunityPosts,
  fetchDailyReadings,
  fetchPublicProfile,
  fetchPublishedHymns,
  fetchPublishedPrayers,
  fetchVerifiedParishes,
  getCurrentUserProfile,
  followCommunityUser,
  isSupabaseConfigured,
  reportCommunityPost,
  incrementCommunityReaction,
  runAdminModuleAction,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
  handleSupabaseAuthCallback,
  syncUserCollectionItem,
  syncUserSettings,
  submitHymnCorrection,
  submitIdentityVerification,
  syncHomeParishFromProfile,
  updateCurrentUserProfile,
  updateParishDetails,
} from "./src/supabase";
import type { AdminModuleName, AdvertisementRecord, PublicProfile } from "./src/supabase";
import { addDays, describeCalendar } from "./src/liturgicalCalendar";
import {
  getAppSettings,
  getLocalCommunityComments,
  getLocalCommunityPosts,
  getLocalCommunityReactions,
  getLocalParishes,
  getPersistedOfflineCache,
  getRecentItems,
  getSavedItems,
  hydrateLocalCollections,
  recordRecentItem,
  saveLocalCommunityComment,
  saveLocalCommunityPost,
  saveLocalCommunityReactions,
  saveLocalParish,
  saveLocalItem,
  setAppSetting,
  setOfflineCache,
} from "./src/offlineCache";
import type { AppSettings } from "./src/offlineCache";
import { cancelPrayerReminders, requestCurrentLocation, scheduleDailyPrayerReminder } from "./src/nativeServices";
import {
  BackHandler,
  ImageBackground,
  Image,
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  StatusBar as NativeStatusBar,
  Share,
  View,
} from "react-native";

type TabKey = "today" | "library" | "community" | "parishes" | "profile";
type SubmitState = "idle" | "saving" | "success";

type Hymn = {
  number: string;
  title: string;
  firstLine: string;
  tag: string;
  verses: string[];
};

type Prayer = {
  title: string;
  category: string;
  body: string;
};

type Novena = {
  id: string;
  title: string;
  month: string;
  starts: string;
  feast: string;
  sourceUrl: string;
  sourceName: string;
  days?: Array<{ title?: string; intention?: string; prayer?: string; reflection?: string }>;
  prayer?: string;
};

type ReadingSection = {
  label: string;
  citation?: string;
  response?: string;
  text: string;
  source?: string;
  collect?: boolean;
  optional?: boolean;
};

const colors = {
  background: "#fff9ef",
  surface: "#ffffff",
  surfaceLow: "#f9f3ea",
  surfaceContainer: "#f3ede4",
  primary: "#30021c",
  primaryContainer: "#4a1731",
  secondary: "#7e4c83",
  secondaryContainer: "#fec0ff",
  tertiaryFixed: "#ffdea4",
  gold: "#b58a2c",
  green: "#2d5a27",
  text: "#1d1b16",
  muted: "#514348",
  outline: "#d5c2c7",
  danger: "#ba1a1a",
  success: "#2d5a27",
};

const tabs: Array<{ key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "today", label: "Today", icon: "calendar-outline" },
  { key: "library", label: "Library", icon: "book-outline" },
  { key: "community", label: "Community", icon: "people-outline" },
  { key: "parishes", label: "Parishes", icon: "business-outline" },
  { key: "profile", label: "Profile", icon: "person-outline" },
];

const fallbackReadings: ReadingSection[] = [
  {
    label: "Opening Prayer (Collect)",
    citation: "Roman Missal",
    text:
      "O God, source of unity and peace, guide your Church in Nigeria with wisdom, courage and charity as we gather in prayer.",
    collect: true,
  },
  {
    label: "First Reading",
    citation: "Isaiah 7:1-9",
    text:
      "In the days of Ahaz, king of Judah, the heart of the king and the heart of his people trembled, as the trees of the forest tremble in the wind.",
  },
  {
    label: "Responsorial Psalm",
    citation: "Psalm 48",
    response: "R. God upholds his city for ever.",
    text: "Great is the Lord and wholly to be praised in the city of our God.\nHis holy mountain, fairest of heights, is the joy of all the earth.",
  },
  {
    label: "Second Reading",
    citation: "Ephesians 1:3-10",
    optional: true,
    text:
      "Blessed be the God and Father of our Lord Jesus Christ, who has blessed us in Christ with every spiritual blessing in the heavens.",
  },
  {
    label: "Gospel Acclamation",
    citation: "Alleluia",
    text: "Alleluia, alleluia. Speak, Lord, your servant is listening; you have the words of everlasting life. Alleluia.",
  },
  {
    label: "Gospel",
    citation: "Matthew 11:25-30",
    text:
      "Jesus exclaimed: I give praise to you, Father, Lord of heaven and earth, for although you have hidden these things from the wise and learned, you have revealed them to little ones.",
  },
];

const morningPrayerSections: ReadingSection[] = [
  {
    label: "Opening",
    text: "Lord, open my lips.\nAnd my mouth will proclaim your praise.\nGlory be to the Father, and to the Son, and to the Holy Spirit.",
  },
  {
    label: "Morning Offering",
    text: "O Jesus, through the Immaculate Heart of Mary, I offer you my prayers, works, joys and sufferings of this day for all the intentions of your Sacred Heart.",
  },
  {
    label: "Canticle of Zechariah",
    text: "Blessed be the Lord, the God of Israel; he has come to his people and set them free. He has raised up for us a mighty saviour, born of the house of his servant David.",
  },
  {
    label: "Intercessions",
    text: "Lord Jesus, light of the world, guide our thoughts, words and actions today. Keep our families, parishes and nation in your peace.",
  },
  {
    label: "Concluding Prayer",
    text: "Lord God, strengthen us to walk in faith, hope and charity. May all we do today begin with your inspiration and continue with your help. Amen.",
  },
];

const rosaryPrayerSections: ReadingSection[] = [
  { label: "Sign of the Cross", text: "In the name of the Father, and of the Son, and of the Holy Spirit. Amen." },
  { label: "Apostles' Creed", text: "I believe in God, the Father almighty, Creator of heaven and earth, and in Jesus Christ, his only Son, our Lord." },
  { label: "Our Father", text: "Our Father, who art in heaven, hallowed be thy name; thy kingdom come; thy will be done on earth as it is in heaven." },
  { label: "Hail Mary", text: "Hail Mary, full of grace, the Lord is with thee. Blessed art thou among women, and blessed is the fruit of thy womb, Jesus." },
  { label: "Glory Be", text: "Glory be to the Father, and to the Son, and to the Holy Spirit; as it was in the beginning, is now, and ever shall be, world without end. Amen." },
  { label: "Fatima Prayer", text: "O my Jesus, forgive us our sins, save us from the fires of hell, and lead all souls to heaven, especially those most in need of thy mercy." },
  { label: "Hail Holy Queen", text: "Hail, holy Queen, Mother of mercy, our life, our sweetness and our hope. To thee do we cry, poor banished children of Eve." },
  { label: "Concluding Prayer", text: "O God, whose only-begotten Son, by his life, death and resurrection, has purchased for us the rewards of eternal life, grant that meditating on these mysteries we may imitate what they contain and obtain what they promise. Amen." },
];

const rosaryMysteries = {
  joyful: {
    title: "Joyful Mysteries",
    days: "Monday and Saturday",
    mysteries: [
      "The Annunciation",
      "The Visitation",
      "The Nativity",
      "The Presentation in the Temple",
      "The Finding of Jesus in the Temple",
    ],
  },
  sorrowful: {
    title: "Sorrowful Mysteries",
    days: "Tuesday and Friday",
    mysteries: [
      "The Agony in the Garden",
      "The Scourging at the Pillar",
      "The Crowning with Thorns",
      "The Carrying of the Cross",
      "The Crucifixion",
    ],
  },
  glorious: {
    title: "Glorious Mysteries",
    days: "Wednesday and Sunday",
    mysteries: [
      "The Resurrection",
      "The Ascension",
      "The Descent of the Holy Spirit",
      "The Assumption of Mary",
      "The Coronation of Mary",
    ],
  },
  luminous: {
    title: "Luminous Mysteries",
    days: "Thursday",
    mysteries: [
      "The Baptism of Jesus",
      "The Wedding at Cana",
      "The Proclamation of the Kingdom",
      "The Transfiguration",
      "The Institution of the Eucharist",
    ],
  },
};

function rosaryMysteryForDate(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (day === 1 || day === 6) return rosaryMysteries.joyful;
  if (day === 2 || day === 5) return rosaryMysteries.sorrowful;
  if (day === 4) return rosaryMysteries.luminous;
  return rosaryMysteries.glorious;
}

const hymns = hymnsData as Hymn[];
const dailyReadingEntries = dailyReadingEntriesData as Array<{
  canonicalKey: string;
  title: string;
  sections: Array<{ kind: string; title: string; text: string; citation?: string; response?: string; source?: string; optional?: boolean }>;
}>;
const nigeriaOrdo2026 = nigeriaOrdo2026Data as Array<{
  date: string;
  rank: string;
  celebration: string;
  primaryCelebration: string;
  canonicalKey: string | null;
  readingTitle: string | null;
  mappingConfidence: string;
}>;
const novenas = novenasData as Novena[];
const prayers = prayersData as Prayer[];

const communityPosts: Array<{ author: string; badge?: string; title: string; body: string; comments: number; featured: boolean }> = [];
const placeholderPostTitles = new Set([
  "Reflections on the Sunday Gospel: The Bread of Life",
  "Asking for prayers for my grandmother",
  "Upcoming Parish Youth Retreat",
]);

function matchesSearchText(text: string, query: string) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = text.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function novenaSearchText(novena: Novena) {
  const fullText = novenaFullPrayer(novena);
  return [
    novena.title,
    novena.month,
    novena.starts,
    novena.feast,
    novena.sourceName,
    novena.prayer,
    fullText,
    ...(novena.days ?? []).flatMap((day) => [day.title, day.intention, day.prayer, day.reflection]),
  ].filter(Boolean).join(" ");
}

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/\bst\.?\b/g, "saint").replace(/[^a-z0-9]+/g, " ").replace(/\b(novena|to|the|of|and)\b/g, " ").replace(/\s+/g, " ").trim();
}

function novenaFullPrayer(novena: Novena) {
  if (novena.prayer?.trim()) return novena.prayer.trim();
  const target = normalizeTitle(novena.title);
  const match = prayers.find((prayer) => {
    if (!prayer.title.toLowerCase().includes("novena")) return false;
    const source = normalizeTitle(prayer.title);
    return source === target || source.includes(target) || target.includes(source);
  });
  return match?.body?.trim() ?? "";
}

function novenaDayEntries(novena: Novena) {
  if (novena.days?.length) return novena.days.slice(0, 9);
  return [];
}

async function syncSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  await setAppSetting(key, value);
  syncUserSettings({ [key]: value }).catch(() => undefined);
}

function saveAndSyncCollectionItem(type: string, id: string, title: string, collection: "saved" | "recent") {
  const items = collection === "saved" ? saveLocalItem(type, id, title) : recordRecentItem(type, id, title);
  syncUserCollectionItem({ type, itemId: id, title, collection }).catch(() => undefined);
  return items;
}

const adminModules: AdminModuleName[] = [
  "Content Management",
  "Daily Reading Approvals",
  "Hymn Corrections",
  "Parish Management",
  "Community Reports",
  "Identity Verification",
  "Advertisement Management",
  "Roles & Access",
  "Audit Logs",
];

function adminRecordTitle(moduleName: AdminModuleName, record: Record<string, any>) {
  return safeAdminText(record.title || record.parish_name || record.name || record.hymn_title || record.celebration_title || record.full_name || record.display_name || record.actor_name || moduleName);
}

function adminRecordSubtitle(record: Record<string, any>) {
  return safeAdminText([
    record.__adminKind,
    record.status || record.moderation_status || record.verification_status,
    record.email || record.submitted_by_name || record.author_name || record.sponsor,
  ].filter(Boolean).map(safeAdminText).join(" - "));
}

function adminRecordBody(record: Record<string, any>) {
  return safeAdminText(record.body || record.reason || record.note || record.document_note || record.proposed_text || record.proposed_address || record.action || record.category || record.placement || "No extra details.");
}

function safeAdminText(value: any) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "Unsupported record data";
  }
}

function safeAdminDate(value: any) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

function safeAdminJson(value: any) {
  if (!value) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function safeDisplayText(value: any) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "Unsupported value";
  }
}

function cleanUsername(value: any) {
  return String(value || "").trim().replace(/^@+/, "");
}

function communityAuthorIdentity(item: any) {
  const username = cleanUsername(item.author_username || item.username);
  const rawName = String(item.author_name || item.display_name || "").trim();
  const name = rawName && cleanUsername(rawName).toLowerCase() !== username.toLowerCase()
    ? rawName
    : item.author_id
      ? "CatApp Member"
      : "Guest";
  return { name, username };
}

function communityPostLink(post: any) {
  const id = encodeURIComponent(String(post.id || post.title || "community"));
  return `catapp://community/post/${id}`;
}

function adminActionsForRecord(moduleName: AdminModuleName, record: Record<string, any>): Array<{ action: string; label: string; icon: keyof typeof Ionicons.glyphMap; danger?: boolean }> {
  if (moduleName === "Parish Management") {
    if (record.__adminKind === "parish_edit" && record.status === "pending") {
      return [
        { action: "approve_edit", label: "Approve", icon: "checkmark-circle-outline" },
        { action: "reject_edit", label: "Reject", icon: "close-circle-outline", danger: true },
      ];
    }
    if (record.__adminKind === "parish_record") {
      return [
        { action: "verify_parish", label: "Verify", icon: "shield-checkmark-outline" },
        { action: "withdraw_parish", label: "Withdraw", icon: "remove-circle-outline", danger: true },
      ];
    }
  }
  if (moduleName === "Community Reports") {
    if (record.__adminKind === "community_report") {
      return [
        { action: "action_report", label: "Actioned", icon: "checkmark-done-outline" },
        { action: "dismiss_report", label: "Dismiss", icon: "close-circle-outline" },
      ];
    }
    return [
      { action: "publish_post", label: "Publish", icon: "checkmark-circle-outline" },
      { action: "hold_post", label: "Hold", icon: "pause-circle-outline" },
      { action: "remove_post", label: "Remove", icon: "trash-outline", danger: true },
    ];
  }
  if (moduleName === "Identity Verification") {
    return [
      { action: "approve_identity", label: "Approve", icon: "shield-checkmark-outline" },
      { action: "reject_identity", label: "Reject", icon: "close-circle-outline", danger: true },
    ];
  }
  if (moduleName === "Hymn Corrections") {
    return [
      { action: "approve_hymn", label: "Approve", icon: "checkmark-circle-outline" },
      { action: "apply_hymn", label: "Applied", icon: "construct-outline" },
      { action: "reject_hymn", label: "Reject", icon: "close-circle-outline", danger: true },
    ];
  }
  if (moduleName === "Daily Reading Approvals") {
    return [
      { action: "approve_reading", label: "Approve", icon: "checkmark-circle-outline" },
      { action: "publish_reading", label: "Publish", icon: "cloud-upload-outline" },
      { action: "reject_reading", label: "Reject", icon: "close-circle-outline", danger: true },
    ];
  }
  if (moduleName === "Advertisement Management") {
    return [
      { action: "activate_ad", label: "Activate", icon: "play-circle-outline" },
      { action: "pause_ad", label: "Pause", icon: "pause-circle-outline" },
      { action: "end_ad", label: "End", icon: "stop-circle-outline", danger: true },
    ];
  }
  if (moduleName === "Roles & Access") {
    return record.is_admin
      ? [{ action: "demote_admin", label: "Remove Admin", icon: "person-remove-outline", danger: true }]
      : [{ action: "promote_admin", label: "Make Admin", icon: "person-add-outline" }];
  }
  return [];
}

function isPlaceholderCommunityPost(post: any) {
  return placeholderPostTitles.has(post.title) || ["Fr. Jude Okonkwo", "Chioma Adeyemi", "Sr. Mary Immaculata"].includes(post.author_name);
}

function mergeUniqueById<T extends { id?: string; name?: string; title?: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = (item.name ?? item.title ?? item.id)?.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function localParishFromProfile(profile: {
  fullName?: string;
  homeParish: string;
  homeParishAddress?: string;
  homeParishPhone?: string;
  homeParishMassTimes?: string;
  homeParishConfessionTimes?: string;
}) {
  const id = `local-profile-${profile.homeParish.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return {
    id,
    name: profile.homeParish.trim(),
    diocese: "Saved Parish",
    address: profile.homeParishAddress?.trim() || "Address pending",
    phone: profile.homeParishPhone?.trim() || "",
    mass_times: profile.homeParishMassTimes?.trim() ? [{ times: [profile.homeParishMassTimes.trim()] }] : [],
    confession_times: profile.homeParishConfessionTimes?.trim() ? [{ times: [profile.homeParishConfessionTimes.trim()] }] : [],
    data_quality_notes: `Saved locally from ${profile.fullName || "your"} profile.`,
    last_confirmed_at: new Date().toISOString(),
    latitude: null,
    longitude: null,
    isProfileParish: true,
  };
}

function nigeriaOrdoCelebrationForDate(date: string) {
  const mapping = nigeriaOrdo2026.find((entry) => entry.date === date);
  return mapping?.primaryCelebration || mapping?.celebration || "";
}

function approvedLocalReadingForDate(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  const calendar = describeCalendar(date);
  const ordoMapping = nigeriaOrdo2026.find((mapping) => mapping.date === date && mapping.canonicalKey);
  const ordoEntry = ordoMapping
    ? dailyReadingEntries.find((entry) => entry.canonicalKey === ordoMapping.canonicalKey)
    : undefined;
  if (ordoMapping && ordoEntry) {
    return {
      date,
      celebration: {
        title: ordoMapping.primaryCelebration || ordoEntry.title,
        rank: ordoMapping.rank || "",
        color: "green",
        lectionary: "",
      },
      sourceSummary:
        ordoMapping.mappingConfidence === "approved-content-fallback"
          ? "Nigeria Ordo 2026 calendar mapping with approved fallback reading content pending exact replacement."
          : "Nigeria Ordo 2026 calendar mapping backed by approved reading content.",
      sections: ordoEntry.sections.map((section) => ({
        title: section.title,
        citation: section.citation,
        response: section.response,
        text: section.text,
        source: section.source,
        kind: section.kind,
        optional: section.optional,
      })),
    };
  }

  const dayNumber = Number.isNaN(parsed.getTime())
    ? 0
    : Math.floor((parsed.getTime() - Date.UTC(parsed.getUTCFullYear(), 0, 0)) / 86400000);
  const month = parsed.getUTCMonth() + 1;
  const day = parsed.getUTCDate();
  const fixedDateEntry = dailyReadingEntries.find((entry: any) => entry.fixedMonth === month && entry.fixedDay === day);
  const dayName = calendar.dayName;
  const matchingEntries = dailyReadingEntries.filter((entry) => {
    if (fixedDateEntry) return false;
    if (dayName === "Sunday") {
      return entry.title.includes("Sunday") && entry.title.includes(`Year ${calendar.sundayCycle}`);
    }
    return !entry.title.includes("Sunday") && entry.title.toLowerCase().includes(dayName.toLowerCase());
  });
  const pool = fixedDateEntry ? [fixedDateEntry] : matchingEntries.length ? matchingEntries : dailyReadingEntries;
  const entry = pool[Math.abs(dayNumber) % pool.length];

  return {
    date,
    sourceSummary: fixedDateEntry
      ? "Approved Word document fixed-date reading"
      : matchingEntries.length
        ? "Approved Word document reading matched by liturgical day"
        : "Approved Word document reading cycle - local offline fallback",
    sections: entry.sections.map((section) => ({
      title: section.title,
      citation: section.citation,
      response: section.response,
      text: section.text,
      source: section.source,
      kind: section.kind,
      optional: section.optional,
    })),
  };
}

function parseDateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function formatDateParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function nigeriaDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Africa/Lagos",
    year: "numeric",
  }).formatToParts(date);
  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

function nigeriaTimeString(date = new Date()) {
  return new Intl.DateTimeFormat("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Africa/Lagos",
    timeZoneName: "short",
  }).format(date);
}

function shiftMonth(monthDate: string, offset: number) {
  const { year, month } = parseDateParts(monthDate);
  const next = new Date(Date.UTC(year, month - 1 + offset, 1));
  return formatDateParts(next.getUTCFullYear(), next.getUTCMonth() + 1, 1);
}

function buildMonthCalendar(monthDate: string) {
  const { year, month } = parseDateParts(monthDate);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingBlanks = firstDay.getUTCDay();
  const cells: Array<string | null> = Array.from({ length: leadingBlanks }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(formatDateParts(year, month, day));
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function monthLabel(monthDate: string) {
  const { year, month } = parseDateParts(monthDate);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function readingConclusion(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("gospel") && !normalized.includes("acclamation")) return "The Gospel of the Lord.";
  if (normalized.includes("first reading") || normalized.includes("second reading")) return "The word of the Lord.";
  return null;
}

const parishes = [
  {
    name: "Holy Cross Cathedral",
    diocese: "Lagos Archdiocese",
    mass: "6:30 AM",
    distance: "0.8 km",
    address: "Catholic Mission Street, Lagos Island",
    confession: "Saturday 4:30 PM",
    verified: "Verified 12 July 2026",
  },
  {
    name: "St. Dominic's Catholic Church",
    diocese: "Lagos Archdiocese",
    mass: "12:00 PM",
    distance: "4.2 km",
    address: "Yaba, Lagos",
    confession: "Friday 5:00 PM",
    verified: "Verified 8 July 2026",
  },
  {
    name: "Church of the Assumption",
    diocese: "Lagos Archdiocese",
    mass: "6:00 PM",
    distance: "5.5 km",
    address: "Falomo, Ikoyi",
    confession: "By appointment",
    verified: "Candidate review pending",
  },
  {
    name: "St. Leo's Catholic Church",
    diocese: "Lagos Archdiocese",
    mass: "Tomorrow 7:00 AM",
    distance: "12.0 km",
    address: "Ikeja, Lagos",
    confession: "Saturday 6:00 PM",
    verified: "Verified 1 July 2026",
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const [tabHistory, setTabHistory] = useState<TabKey[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [todayRefreshToken, setTodayRefreshToken] = useState(0);
  const [communityRefreshToken, setCommunityRefreshToken] = useState(0);
  const [communityRefreshing, setCommunityRefreshing] = useState(false);
  const title = useMemo(() => tabs.find((tab) => tab.key === activeTab)?.label ?? "CatApp", [activeTab]);

  useEffect(() => {
    getAppSettings().then((settings) => setDarkMode(settings.darkMode));
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (tabHistory.length) {
        const previous = tabHistory[tabHistory.length - 1];
        setTabHistory((history) => history.slice(0, -1));
        setActiveTab(previous);
        return true;
      }
      if (activeTab !== "today") {
        setTodayRefreshToken((token) => token + 1);
        setActiveTab("today");
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [activeTab, tabHistory]);

  const changeTab = (tab: TabKey) => {
    if (tab === activeTab) return;
    setTabHistory((history) => [...history, activeTab].slice(-8));
    if (tab === "today") setTodayRefreshToken((token) => token + 1);
    setActiveTab(tab);
  };

  return (
    <SafeAreaView style={[styles.safeArea, darkMode && styles.safeAreaDark]}>
      <StatusBar style={darkMode ? "light" : "dark"} backgroundColor={darkMode ? colors.primary : colors.background} />
      <View style={[styles.app, darkMode && styles.appDark]}>
        <Header title={activeTab === "today" ? "CatApp" : title} darkMode={darkMode} />
        <ScrollView
          contentContainerStyle={styles.screen}
          refreshControl={activeTab === "community" ? (
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={() => {
                setCommunityRefreshing(true);
                setCommunityRefreshToken((token) => token + 1);
              }}
              refreshing={communityRefreshing}
              tintColor={colors.primary}
            />
          ) : undefined}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === "today" && <TodayScreen refreshToken={todayRefreshToken} />}
          {activeTab === "library" && <LibraryScreen />}
          {activeTab === "community" && <CommunityScreen refreshToken={communityRefreshToken} setRefreshing={setCommunityRefreshing} />}
          {activeTab === "parishes" && <ParishesScreen />}
          {activeTab === "profile" && <ProfileScreen darkMode={darkMode} setDarkMode={setDarkMode} />}
        </ScrollView>
        <View style={styles.bottomAdContainer}>
          <AdBanner placement="bottom_banner" refreshToken={todayRefreshToken + communityRefreshToken} />
        </View>
        <BottomTabs activeTab={activeTab} onChange={changeTab} />
      </View>
    </SafeAreaView>
  );
}

function Header({ title, darkMode }: { title: string; darkMode: boolean }) {
  return (
    <View style={[styles.header, darkMode && styles.headerDark]}>
      <View style={styles.headerIdentity}>
        <Image source={require("./assets/catapp-logo.png")} style={styles.brandLogo} accessibilityLabel="CatApp logo" />
        <Text style={[styles.logo, darkMode && styles.logoDark]}>{title}</Text>
      </View>
      <Pressable style={styles.iconButton} accessibilityLabel="Open settings">
        <Ionicons color={darkMode ? "#ffffff" : colors.primary} name="settings-outline" size={24} />
      </Pressable>
    </View>
  );
}

function AdBanner({ placement, refreshToken = 0 }: { placement: string; refreshToken?: number }) {
  const [activeAd, setActiveAd] = useState<AdvertisementRecord | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchActiveAdvertisements(placement).then((records) => {
      if (mounted && records?.[0]) setActiveAd(records[0]);
    });
    return () => {
      mounted = false;
    };
  }, [placement, refreshToken]);

  if (!activeAd) return null;
  return (
    <Pressable
      disabled={!activeAd.target_url}
      onPress={() => activeAd.target_url ? Linking.openURL(activeAd.target_url) : undefined}
      style={styles.adBar}
    >
      <Text style={styles.adText}>{activeAd.title}{activeAd.sponsor ? ` - ${activeAd.sponsor}` : ""}</Text>
      {activeAd.body ? <Text style={styles.adSubText}>{activeAd.body}</Text> : null}
    </Pressable>
  );
}

function TodayScreen({ refreshToken }: { refreshToken: number }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const initialNigeriaDate = useMemo(() => nigeriaDateString(), []);
  const [selectedDate, setSelectedDate] = useState(initialNigeriaDate);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(`${initialNigeriaDate.slice(0, 7)}-01`);
  const [nigeriaTime, setNigeriaTime] = useState(nigeriaTimeString());
  const [selectedDevotion, setSelectedDevotion] = useState<"morning" | "rosary" | null>(null);
  const [readings, setReadings] = useState<ReadingSection[] | null>(null);
  const [readingSource, setReadingSource] = useState("Loading readings...");
  const [readingSourceUrl, setReadingSourceUrl] = useState<string | null>(null);
  const [saintOfTheDay, setSaintOfTheDay] = useState("Today in the Church");
  const calendarInfo = describeCalendar(selectedDate);
  const calendarCells = useMemo(() => buildMonthCalendar(calendarMonth), [calendarMonth]);
  const displayedReadings = readings ? (showFull ? readings : readings.slice(0, 1)) : [];
  const todaysRosary = rosaryMysteryForDate(selectedDate);

  useEffect(() => {
    const timer = setInterval(() => setNigeriaTime(nigeriaTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;

    setReadings(null);
    setShowFull(false);
    setReadingSource("Loading readings...");
    setReadingSourceUrl(null);
    setSaintOfTheDay(nigeriaOrdoCelebrationForDate(selectedDate) || "Today in the Church");

    fetchDailyReadings(selectedDate).then(async (response) => {
      if (!isMounted) return;
      const offlineResponse = response ?? await getPersistedOfflineCache<any>(`readings:${selectedDate}`) ?? approvedLocalReadingForDate(selectedDate);

      setReadings(
        offlineResponse.sections.map((section: any) => ({
          label: section.title,
          citation: section.citation,
          response: section.response,
          text: section.text,
          source: section.source,
          collect: section.kind === "collect",
          optional: section.optional,
        }))
      );
      setReadingSource(response ? "Daily readings loaded." : "Offline readings loaded.");
      setSaintOfTheDay(
        nigeriaOrdoCelebrationForDate(selectedDate)
          || offlineResponse.celebration?.title
          || offlineResponse.celebrationTitle
          || offlineResponse.celebration_title
          || offlineResponse.title
          || "Today in the Church",
      );
      setReadingSourceUrl(offlineResponse.sections.find((section: any) => section.source?.startsWith("http"))?.source ?? null);
      if (response) setOfflineCache(`readings:${selectedDate}`, response);
    }).finally(() => {
      if (isMounted && isSupabaseConfigured) {
        setReadingSource((source) => source === "Loading readings..." ? "Readings ready." : source);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  if (selectedDevotion) {
    const isRosary = selectedDevotion === "rosary";
    const sections = isRosary ? rosaryPrayerSections : morningPrayerSections;
    if (isRosary) {
      return (
        <View style={styles.stackLarge}>
          <Pressable style={styles.backButton} onPress={() => setSelectedDevotion(null)}>
            <Ionicons color={colors.primary} name="arrow-back" size={20} />
            <Text style={styles.backButtonText}>Today</Text>
          </Pressable>
          <View>
            <Text style={styles.overline}>Guided Rosary</Text>
            <Text style={styles.pageTitle}>{todaysRosary.title}</Text>
            <Text style={styles.secondaryText}>For {todaysRosary.days}. Follow each step slowly; one decade is one mystery.</Text>
          </View>
          <SectionCard>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>How to Pray Today</Text>
              <Text style={styles.smallBadge}>Beginner</Text>
            </View>
            <View style={styles.cardBody}>
              <InfoRow icon="finger-print-outline" label="Start" value="Make the Sign of the Cross, then pray the Apostles' Creed." />
              <InfoRow icon="radio-button-on-outline" label="Opening beads" value="Pray 1 Our Father, 3 Hail Marys, then 1 Glory Be." />
              <InfoRow icon="repeat-outline" label="Each decade" value="Announce the mystery, pray 1 Our Father, 10 Hail Marys, 1 Glory Be, then the Fatima Prayer." />
              <InfoRow icon="checkmark-circle-outline" label="Finish" value="Pray Hail Holy Queen and the concluding prayer." />
            </View>
          </SectionCard>
          <SectionCard>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{todaysRosary.title}</Text>
              <Text style={styles.smallBadge}>{todaysRosary.mysteries.length} decades</Text>
            </View>
            <View style={styles.cardBody}>
              {todaysRosary.mysteries.map((mystery, index) => (
                <View key={mystery} style={styles.rosaryMysteryCard}>
                  <Text style={styles.overlinePurple}>Decade {index + 1}</Text>
                  <Text style={styles.hymnTitle}>{mystery}</Text>
                  <Text style={styles.mutedText}>Announce this mystery, pause briefly, then pray: Our Father, 10 Hail Marys, Glory Be, Fatima Prayer.</Text>
                </View>
              ))}
            </View>
          </SectionCard>
          <SectionCard>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Prayer Texts</Text>
              <Text style={styles.smallBadge}>Full</Text>
            </View>
            <View style={styles.cardBody}>
              {sections.map((section) => (
                <View key={section.label} style={styles.readingBlock}>
                  <Text style={styles.overlinePurple}>{section.label}</Text>
                  <Text style={[styles.readingText, largeText && styles.readingTextLarge]}>{section.text}</Text>
                </View>
              ))}
            </View>
          </SectionCard>
        </View>
      );
    }
    return (
      <View style={styles.stackLarge}>
        <Pressable style={styles.backButton} onPress={() => setSelectedDevotion(null)}>
          <Ionicons color={colors.primary} name="arrow-back" size={20} />
          <Text style={styles.backButtonText}>Today</Text>
        </Pressable>
        <View>
          <Text style={styles.overline}>{isRosary ? "Devotion" : "Daily Prayer"}</Text>
          <Text style={styles.pageTitle}>{isRosary ? "The Rosary" : "Morning Prayer"}</Text>
          <Text style={styles.secondaryText}>{isRosary ? "Core prayers and concluding prayer." : "A complete morning prayer for the start of the day."}</Text>
        </View>
        {!isRosary ? (
          <SectionCard>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Coming Soon</Text>
              <Text style={styles.mutedText}>The full morning prayer page is being prepared.</Text>
            </View>
          </SectionCard>
        ) : null}
        {isRosary ? <SectionCard>
          <View style={styles.cardBody}>
            {sections.map((section) => (
              <View key={section.label} style={styles.readingBlock}>
                <Text style={styles.overlinePurple}>{section.label}</Text>
                <Text style={[styles.readingText, largeText && styles.readingTextLarge]}>{section.text}</Text>
              </View>
            ))}
          </View>
        </SectionCard> : null}
      </View>
    );
  }

  return (
    <View style={styles.stackLarge}>
      <AdBanner placement="today_top" refreshToken={refreshToken} />
      <View>
        <View style={styles.metaRow}>
          <View style={styles.greenDot} />
        <Text style={styles.overline}>{calendarInfo.territory} - {calendarInfo.dayName}</Text>
        </View>
        <Text style={styles.pageTitle}>{selectedDate}</Text>
        <Text style={styles.secondaryText}>Saint of the Day: {saintOfTheDay}</Text>
        <Text style={styles.secondaryText}>Nigeria time: {nigeriaTime} - Year {calendarInfo.sundayCycle} Sundays - Weekday Cycle {calendarInfo.weekdayCycle}</Text>
      </View>
      <View style={styles.controlRow}>
        <Pressable style={styles.dateButton} accessibilityLabel="Show previous day readings" onPress={() => {
          const nextDate = addDays(selectedDate, -1);
          setSelectedDate(nextDate);
          setCalendarMonth(`${nextDate.slice(0, 7)}-01`);
        }}>
          <Ionicons color={colors.primary} name="chevron-back" size={18} />
          <Text style={styles.dateButtonText}>Previous</Text>
        </Pressable>
        <Pressable style={[styles.dateButton, bookmarked && styles.dateButtonActive]} accessibilityLabel="Save today's readings" onPress={() => {
          setBookmarked((value) => !value);
          saveAndSyncCollectionItem("reading", selectedDate, `Readings for ${selectedDate}`, "saved");
        }}>
          <Ionicons color={colors.primary} name={bookmarked ? "bookmark" : "bookmark-outline"} size={18} />
          <Text style={styles.dateButtonText}>{bookmarked ? "Saved" : "Save"}</Text>
        </Pressable>
        <Pressable style={styles.dateButton} onPress={() => setLargeText((value) => !value)}>
          <Ionicons color={colors.primary} name="text" size={18} />
          <Text style={styles.dateButtonText}>{largeText ? "A-" : "A+"}</Text>
        </Pressable>
        <Pressable style={styles.dateButton} accessibilityLabel="Show next day readings" onPress={() => {
          const nextDate = addDays(selectedDate, 1);
          setSelectedDate(nextDate);
          setCalendarMonth(`${nextDate.slice(0, 7)}-01`);
        }}>
          <Text style={styles.dateButtonText}>Next</Text>
          <Ionicons color={colors.primary} name="chevron-forward" size={18} />
        </Pressable>
        <Pressable style={styles.dateButton} accessibilityLabel="Open calendar picker" onPress={() => {
          setCalendarMonth(`${selectedDate.slice(0, 7)}-01`);
          setShowCalendar((value) => !value);
        }}>
          <Ionicons color={colors.primary} name="calendar-outline" size={18} />
          <Text style={styles.dateButtonText}>Date</Text>
        </Pressable>
      </View>
      {showCalendar ? (
        <View style={styles.calendarPanel}>
          <View style={styles.calendarHeader}>
            <Pressable style={styles.calendarNavButton} accessibilityLabel="Previous month" onPress={() => setCalendarMonth((date) => shiftMonth(date, -1))}>
              <Ionicons color={colors.primary} name="chevron-back" size={19} />
            </Pressable>
            <View style={styles.calendarHeaderTitle}>
              <Text style={styles.calendarMonthTitle}>{monthLabel(calendarMonth)}</Text>
              <Text style={styles.mutedText}>Choose a day for Mass readings</Text>
            </View>
            <Pressable style={styles.calendarNavButton} accessibilityLabel="Next month" onPress={() => setCalendarMonth((date) => shiftMonth(date, 1))}>
              <Ionicons color={colors.primary} name="chevron-forward" size={19} />
            </Pressable>
          </View>
          <View style={styles.weekdayRow}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <Text key={day} style={styles.weekdayText}>{day}</Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {calendarCells.map((date, index) => {
              const isSelected = date === selectedDate;
              const isToday = date === new Date().toISOString().slice(0, 10);
              return (
                <Pressable
                  key={date ?? `blank-${index}`}
                  disabled={!date}
                  accessibilityLabel={date ? `Select readings for ${date}` : "Empty calendar day"}
                  onPress={() => {
                    if (!date) return;
                    setSelectedDate(date);
                    setShowCalendar(false);
                  }}
                  style={[styles.calendarDay, !date && styles.calendarDayEmpty, isSelected && styles.calendarDayActive, isToday && !isSelected && styles.calendarDayToday]}
                >
                  <Text style={[styles.calendarDayText, isSelected && styles.calendarDayTextActive, !date && styles.calendarDayTextEmpty]}>{date ? String(parseDateParts(date).day) : ""}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      <View style={styles.quickGrid}>
        <QuickCard icon="weather-sunny" title="Morning Prayer" subtitle="Complete prayer" color={colors.secondaryContainer} onPress={() => setSelectedDevotion("morning")} />
        <QuickCard icon="cross" title={todaysRosary.title} subtitle={`Today - ${todaysRosary.mysteries[0]}`} color={colors.tertiaryFixed} onPress={() => setSelectedDevotion("rosary")} />
      </View>
      <SectionCard>
        <View style={styles.cardHeader}>
          <View style={styles.row}>
            <Ionicons color={colors.primary} name="book-outline" size={20} />
            <Text style={styles.cardTitle}>Daily Mass Readings</Text>
          </View>
          <Text style={styles.linkText}>Full Missal</Text>
        </View>
        <View style={styles.cardBody}>
          {!readings ? (
            <View style={styles.noticeBox}>
              <Text style={styles.mutedText}>Loading today's approved readings...</Text>
            </View>
          ) : null}
          {displayedReadings.map((reading) => (
            <View key={reading.label} style={reading.collect ? styles.collectBox : styles.readingBlock} accessibilityLabel={`${reading.label} ${reading.citation || ""}`}>
              <Text style={styles.overlinePurple}>
                {reading.label}{reading.citation ? ` - ${reading.citation}` : ""}{reading.optional ? " - when appointed" : ""}
              </Text>
              {"response" in reading && reading.response ? <Text style={styles.psalmResponse}>{reading.response}</Text> : null}
              <Text style={[reading.collect ? styles.collectText : styles.readingText, largeText && styles.readingTextLarge]}>
                {reading.text}
              </Text>
              {readingConclusion(reading.label) ? (
                <Text style={[styles.readingConclusion, largeText && styles.readingTextLarge]}>
                  {readingConclusion(reading.label)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
        <Pressable style={styles.primaryButton} onPress={() => setShowFull((value) => !value)}>
          <Text style={styles.primaryButtonText}>{showFull ? "Collapse Readings" : "Show Complete Mass Readings"}</Text>
        </Pressable>
        {readingSourceUrl ? (
          <Pressable style={styles.secondaryButton} onPress={() => Linking.openURL(readingSourceUrl)}>
            <Ionicons color={colors.primary} name="open-outline" size={18} />
            <Text style={styles.secondaryButtonText}>Open Official Source</Text>
          </Pressable>
        ) : null}
      </SectionCard>
      <SectionCard>
        <View style={styles.cardHeader}>
          <View style={styles.row}>
            <Ionicons color={colors.primary} name="cloud-download-outline" size={20} />
            <Text style={styles.cardTitle}>Readings API</Text>
          </View>
          <Text style={styles.smallBadge}>Ready</Text>
        </View>
        <View style={styles.cardBody}>
          <InfoRow icon="server-outline" label="Status" value={readingSource} />
          <InfoRow icon="map-outline" label="Calendar" value="Nigeria territory with diocesan overrides" />
          <InfoRow icon="file-tray-full-outline" label="Content" value="Collect, readings, psalm, acclamation and Gospel" />
        </View>
      </SectionCard>
    </View>
  );
}

function LibraryScreen() {
  const [query, setQuery] = useState("");
  const [selectedHymn, setSelectedHymn] = useState<Hymn | null>(null);
  const [selectedNovena, setSelectedNovena] = useState<Novena | null>(null);
  const [selectedPrayer, setSelectedPrayer] = useState<Prayer | null>(null);
  const [libraryMode, setLibraryMode] = useState<"hymns" | "prayers" | "novenas" | "reference" | "saved">("hymns");
  const [visibleLimit, setVisibleLimit] = useState(5);
  const [libraryHymns, setLibraryHymns] = useState<Hymn[]>(hymns);
  const [libraryPrayers, setLibraryPrayers] = useState<Prayer[]>(prayers);
  const [librarySource, setLibrarySource] = useState("Checking library content...");
  const [savedItems, setSavedItems] = useState(getSavedItems());
  const [recentItems, setRecentItems] = useState(getRecentItems());
  const [hymnCorrection, setHymnCorrection] = useState("");
  const [hymnCorrectionSubmit, setHymnCorrectionSubmit] = useState<SubmitState>("idle");
  const visibleHymns = libraryHymns.filter((hymn) =>
    matchesSearchText(`${hymn.number} ${hymn.title} ${hymn.firstLine} ${hymn.tag} ${hymn.verses.join(" ")}`, query)
  );
  const visiblePrayers = libraryPrayers.filter((prayer) =>
    matchesSearchText(`${prayer.title} ${prayer.category} ${prayer.body}`, query)
  );
  const visibleNovenas = novenas.filter((novena) =>
    matchesSearchText(novenaSearchText(novena), query)
  );
  const shownHymns = visibleHymns.slice(0, visibleLimit);
  const shownNovenas = visibleNovenas.slice(0, visibleLimit);
  const shownPrayers = visiblePrayers.slice(0, visibleLimit);
  const shownSavedItems = savedItems.slice(0, visibleLimit);
  const shownRecentItems = recentItems.slice(0, visibleLimit);

  useEffect(() => {
    let isMounted = true;

    hydrateLocalCollections().then((collections) => {
      if (!isMounted) return;
      setSavedItems(collections.saved);
      setRecentItems(collections.recent);
    });

    fetchPublishedHymns().then((records) => {
      if (!isMounted || !records?.length) return;

      setLibraryHymns(
        records.map((record) => ({
          number: record.hymn_code ?? String(record.hymn_number).padStart(3, "0"),
          title: record.title,
          firstLine: record.first_line ?? "",
          tag: record.category,
          verses: record.verses,
        }))
      );
      setOfflineCache("library:hymns", records);
      setLibrarySource("Library content loaded.");
    }).finally(() => {
      if (isMounted && isSupabaseConfigured) {
        setLibrarySource((source) => source === "Checking library content..." ? "Library content loaded." : source);
      }
    });

    fetchPublishedPrayers().then((records) => {
      if (!isMounted || !records?.length) return;

      setLibraryPrayers(
        records.map((record) => ({
          title: record.title,
          category: record.category,
          body: record.body,
        }))
      );
      setOfflineCache("library:prayers", records);
      setLibrarySource("Library content loaded.");
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setVisibleLimit(5);
  }, [libraryMode, query]);

  if (selectedHymn) {
    return (
      <View style={styles.stackLarge}>
        <Pressable style={styles.backButton} onPress={() => setSelectedHymn(null)}>
          <Ionicons color={colors.primary} name="arrow-back" size={20} />
          <Text style={styles.backButtonText}>Hymn Library</Text>
        </Pressable>
        <SectionCard>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.overlinePurple}>Hymn {selectedHymn.number} - {selectedHymn.tag}</Text>
              <Text style={styles.cardTitle}>{selectedHymn.title}</Text>
            </View>
            <Ionicons color={colors.secondary} name="heart-outline" size={24} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.firstLine}>{selectedHymn.firstLine}</Text>
            {selectedHymn.verses.map((line, index) => (
              <HymnTextLine key={`${selectedHymn.number}-${index}-${line}`} line={line} />
            ))}
            <Pressable style={styles.secondaryButton} accessibilityLabel="Save hymn to favourites" onPress={() => setSavedItems(saveAndSyncCollectionItem("hymn", selectedHymn.number, selectedHymn.title, "saved"))}>
              <Ionicons color={colors.primary} name="heart-outline" size={18} />
              <Text style={styles.secondaryButtonText}>Save Hymn</Text>
            </Pressable>
            <TextInput
              multiline
              onChangeText={setHymnCorrection}
              placeholder="Suggest a hymn text correction..."
              placeholderTextColor="#77717d"
              style={styles.composerInput}
              value={hymnCorrection}
            />
            <SubmitButton
              icon="create-outline"
              label="Submit Correction"
              state={hymnCorrectionSubmit}
              variant="secondary"
              onPress={async () => {
                if (!hymnCorrection.trim()) return;
                setHymnCorrectionSubmit("saving");
                const result = await submitHymnCorrection({
                  hymnCode: selectedHymn.number,
                  hymnTitle: selectedHymn.title,
                  proposedText: hymnCorrection,
                });
                if (result.ok) {
                  setHymnCorrection("");
                  setHymnCorrectionSubmit("success");
                  setTimeout(() => setHymnCorrectionSubmit("idle"), 1800);
                } else {
                  setLibrarySource(result.message);
                  setHymnCorrectionSubmit("idle");
                }
              }}
            />
            <View style={styles.noticeBox}>
              <Text style={styles.mutedText}>
                Hymn corrections can be reviewed by admins.
              </Text>
            </View>
          </View>
        </SectionCard>
      </View>
    );
  }

  if (selectedPrayer) {
    return (
      <View style={styles.stackLarge}>
        <Pressable style={styles.backButton} onPress={() => setSelectedPrayer(null)}>
          <Ionicons color={colors.primary} name="arrow-back" size={20} />
          <Text style={styles.backButtonText}>Prayer Library</Text>
        </Pressable>
        <SectionCard>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.overlinePurple}>{selectedPrayer.category}</Text>
              <Text style={styles.cardTitle}>{selectedPrayer.title}</Text>
            </View>
            <Ionicons color={colors.secondary} name="heart-outline" size={24} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.readingText}>{selectedPrayer.body}</Text>
            <Pressable style={styles.secondaryButton} accessibilityLabel="Save prayer to favourites" onPress={() => setSavedItems(saveAndSyncCollectionItem("prayer", selectedPrayer.title, selectedPrayer.title, "saved"))}>
              <Ionicons color={colors.primary} name="heart-outline" size={18} />
              <Text style={styles.secondaryButtonText}>Save Prayer</Text>
            </Pressable>
            <View style={styles.noticeBox}>
              <Text style={styles.mutedText}>Prayer text is available for offline use.</Text>
            </View>
          </View>
        </SectionCard>
      </View>
    );
  }

  if (selectedNovena) {
    const days = novenaDayEntries(selectedNovena);
    const fullPrayer = novenaFullPrayer(selectedNovena);
    return (
      <View style={styles.stackLarge}>
        <Pressable style={styles.backButton} onPress={() => setSelectedNovena(null)}>
          <Ionicons color={colors.primary} name="arrow-back" size={20} />
          <Text style={styles.backButtonText}>Novena Library</Text>
        </Pressable>
        <SectionCard>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.overlinePurple}>{selectedNovena.month}</Text>
              <Text style={styles.cardTitle}>{selectedNovena.title}</Text>
            </View>
            <Ionicons color={colors.secondary} name="sparkles-outline" size={24} />
          </View>
          <View style={styles.cardBody}>
            <InfoRow icon="calendar-outline" label="Starts" value={selectedNovena.starts} />
            <InfoRow icon="flag-outline" label="Feast" value={selectedNovena.feast} />
            {fullPrayer ? (
              <Text style={styles.readingText}>{fullPrayer}</Text>
            ) : (
              <View style={styles.noticeBox}>
                <Text style={styles.cardTitle}>Coming Soon</Text>
                <Text style={styles.postBody}>The full prayer text for this novena is being prepared.</Text>
              </View>
            )}
            {days.length ? days.map((day, index) => (
              <View key={`${selectedNovena.id}-day-${index + 1}`} style={styles.rosaryMysteryCard}>
                <Text style={styles.overlinePurple}>Day {index + 1}</Text>
                <Text style={styles.hymnTitle}>{day.title ?? selectedNovena.title}</Text>
                <Text style={styles.postBody}>{day.intention}</Text>
                <Text style={styles.readingText}>{day.prayer}</Text>
                {day.reflection ? <Text style={styles.mutedText}>{day.reflection}</Text> : null}
              </View>
            )) : null}
          </View>
        </SectionCard>
      </View>
    );
  }

  return (
    <View style={styles.stackLarge}>
      <SearchBox placeholder="Search resources..." value={query} onChangeText={setQuery} />
      <ImageBackground
        source={require("./assets/sacred-grace-banner.png")}
        imageStyle={styles.heroImage}
        style={styles.hero}
      >
        <View style={styles.heroScrim} />
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>Hymns</Text>
          <Text style={styles.heroKicker}>Sing to the Lord</Text>
        </View>
      </ImageBackground>
      <View style={styles.resourceGrid}>
        <ResourceTile title="Prayers" subtitle="Approved texts" onPress={() => setLibraryMode("prayers")} />
        <ResourceTile title="Novenas" subtitle="Nine-day prayers" onPress={() => setLibraryMode("novenas")} />
        <ResourceTile title="Catechism" subtitle="Reference" onPress={() => setLibraryMode("reference")} />
      </View>
      <View style={styles.segmented}>
        <Pressable onPress={() => setLibraryMode("hymns")}>
          <Text style={libraryMode === "hymns" ? styles.segmentActive : styles.segment}>Hymns</Text>
        </Pressable>
        <Pressable onPress={() => setLibraryMode("prayers")}>
          <Text style={libraryMode === "prayers" ? styles.segmentActive : styles.segment}>Prayers</Text>
        </Pressable>
        <Pressable onPress={() => setLibraryMode("novenas")}>
          <Text style={libraryMode === "novenas" ? styles.segmentActive : styles.segment}>Novenas</Text>
        </Pressable>
        <Pressable onPress={() => setLibraryMode("saved")}>
          <Text style={libraryMode === "saved" ? styles.segmentActive : styles.segment}>Saved</Text>
        </Pressable>
      </View>
      <SectionCard>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{libraryMode === "hymns" ? "Hymn Library" : libraryMode === "prayers" ? "Prayer Library" : libraryMode === "novenas" ? "Novena Library" : libraryMode === "saved" ? "Saved & Recent" : "Reference Library"}</Text>
          <Text style={styles.smallBadge}>{libraryMode === "hymns" ? `${libraryHymns.length} hymns` : libraryMode === "prayers" ? `${libraryPrayers.length} prayers` : libraryMode === "novenas" ? `${novenas.length} novenas` : "Offline ready"}</Text>
        </View>
        {libraryMode === "hymns" || libraryMode === "prayers" ? <View style={styles.filterRow}>
          {(libraryMode === "hymns" ? ["Entrance", "Communion", "Marian", "Christmas", "Lent", "Easter"] : ["Traditional", "Marian", "Holy Spirit", "Daily Life", "Healing", "Clergy"]).map((filter) => (
            <Text key={filter} style={styles.filterChip}>{filter}</Text>
          ))}
        </View> : null}
        {libraryMode === "hymns" ? shownHymns.map((hymn) => (
            <Pressable key={hymn.number} style={styles.hymnRow} accessibilityLabel={`Open hymn ${hymn.number} ${hymn.title}`} onPress={() => {
              setRecentItems(saveAndSyncCollectionItem("hymn", hymn.number, hymn.title, "recent"));
              setSelectedHymn(hymn);
            }}>
              <Text style={styles.hymnNumber}>{hymn.number}</Text>
              <View style={styles.flex}>
                <Text style={styles.hymnTitle}>{hymn.title}</Text>
                <Text style={styles.mutedText}>{hymn.tag} - {hymn.firstLine}</Text>
              </View>
              <Ionicons color={colors.secondary} name="chevron-forward" size={22} />
            </Pressable>
          )) : libraryMode === "prayers" ? shownPrayers.map((prayer) => (
            <Pressable key={prayer.title} style={styles.hymnRow} accessibilityLabel={`Open prayer ${prayer.title}`} onPress={() => {
              setRecentItems(saveAndSyncCollectionItem("prayer", prayer.title, prayer.title, "recent"));
              setSelectedPrayer(prayer);
            }}>
              <Ionicons color={colors.secondary} name="sparkles-outline" size={22} />
              <View style={styles.flex}>
                <Text style={styles.hymnTitle}>{prayer.title}</Text>
                <Text style={styles.mutedText}>{prayer.category} - {prayer.body.slice(0, 80)}</Text>
              </View>
              <Ionicons color={colors.secondary} name="chevron-forward" size={22} />
            </Pressable>
          )) : libraryMode === "novenas" ? shownNovenas.map((novena) => (
            <Pressable key={novena.id} style={styles.hymnRow} accessibilityLabel={`Open novena ${novena.title}`} onPress={() => {
              setRecentItems(saveAndSyncCollectionItem("novena", novena.id, novena.title, "recent"));
              setSelectedNovena(novena);
            }}>
              <Ionicons color={colors.secondary} name="sparkles-outline" size={22} />
              <View style={styles.flex}>
                <Text style={styles.hymnTitle}>{novena.title}</Text>
                <Text style={styles.mutedText}>{novena.month} - Starts: {novena.starts} - Feast: {novena.feast}</Text>
              </View>
              <Ionicons color={colors.secondary} name="chevron-forward" size={22} />
            </Pressable>
          )) : libraryMode === "saved" ? (
            <>
              <Text style={styles.overlinePurple}>Favourites</Text>
              {savedItems.length ? shownSavedItems.map((item) => <InfoRow key={`${item.type}-${item.id}`} icon="heart-outline" label={item.type} value={item.title} />) : <Text style={styles.mutedText}>No favourites saved in this session yet.</Text>}
              <Text style={styles.overlinePurple}>Recently Viewed</Text>
              {recentItems.length ? shownRecentItems.map((item) => <InfoRow key={`${item.type}-${item.id}`} icon="time-outline" label={item.type} value={item.title} />) : <Text style={styles.mutedText}>Open hymns or prayers to build your recent list.</Text>}
            </>
          ) : (
            <>
              {[
                ["Catechism", "Coming soon"],
                ["Order of Mass", "Approved Mass responses and gestures"],
                ["Catholic Calendar", "Nigeria calendar, diocesan overrides and cycles"],
              ].map(([title, subtitle]) => (
                <View key={title} style={styles.hymnRow}>
                  <Ionicons color={colors.secondary} name="book-outline" size={22} />
                  <View style={styles.flex}>
                    <Text style={styles.hymnTitle}>{title}</Text>
                    <Text style={styles.mutedText}>{subtitle}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        {(libraryMode === "hymns" ? visibleHymns.length > shownHymns.length : libraryMode === "prayers" ? visiblePrayers.length > shownPrayers.length : libraryMode === "novenas" ? visibleNovenas.length > shownNovenas.length : libraryMode === "saved" ? savedItems.length > shownSavedItems.length || recentItems.length > shownRecentItems.length : false) ? (
          <View style={styles.moreResults}>
            <Text style={styles.mutedText}>Showing first {libraryMode === "hymns" ? shownHymns.length : libraryMode === "prayers" ? shownPrayers.length : libraryMode === "novenas" ? shownNovenas.length : Math.max(shownSavedItems.length, shownRecentItems.length)} items. Search by title, category or text to narrow the list.</Text>
            <Pressable style={styles.secondaryButton} onPress={() => setVisibleLimit((limit) => limit + 20)}>
              <Text style={styles.secondaryButtonText}>Load More</Text>
            </Pressable>
          </View>
        ) : null}
      </SectionCard>
      <View style={styles.missionCard}>
        <Text style={styles.missionTitle}>Parish Resources</Text>
        <Text style={styles.missionText}>Find bulletins and approved prayers from your Nigerian parish. {librarySource}</Text>
      </View>
    </View>
  );
}

function CommunityScreen({
  refreshToken,
  setRefreshing,
}: {
  refreshToken: number;
  setRefreshing: (value: boolean) => void;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [selectedAuthorProfile, setSelectedAuthorProfile] = useState<PublicProfile | null>(null);
  const [selectedAuthorPosts, setSelectedAuthorPosts] = useState<any[]>([]);
  const [draft, setDraft] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [communityFeed, setCommunityFeed] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [communityStatus, setCommunityStatus] = useState("Loading community...");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [postReactions, setPostReactions] = useState<Record<string, Record<string, number>>>({});
  const [reportSubmit, setReportSubmit] = useState<SubmitState>("idle");
  const [commentSubmit, setCommentSubmit] = useState<SubmitState>("idle");
  const [postSubmit, setPostSubmit] = useState<SubmitState>("idle");
  const reactionLabels = ["Amen", "Praying", "Thanks", "Insightful"];
  const reactToPost = (postId: string, label: string) => {
    setPostReactions((current) => {
      const next = {
        ...current,
        [postId]: {
          ...(current[postId] || {}),
          [label]: (current[postId]?.[label] || 0) + 1,
        },
      };
      saveLocalCommunityReactions(next).catch(() => undefined);
      return next;
    });
    incrementCommunityReaction(postId, label).catch(() => undefined);
  };
  const renderReactions = (post: any) => (
    <View style={styles.reactionRow}>
      {reactionLabels.map((label) => (
        <Pressable key={label} style={styles.reactionChip} onPress={() => reactToPost(post.id ?? post.title, label)}>
          <Text style={styles.reactionText}>{label} {postReactions[post.id ?? post.title]?.[label] || 0}</Text>
        </Pressable>
      ))}
    </View>
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (selectedAuthorProfile) {
        setSelectedAuthorProfile(null);
        setSelectedAuthorPosts([]);
        return true;
      }
      if (selectedPost) {
        setSelectedPost(null);
        return true;
      }
      if (composerOpen) {
        setComposerOpen(false);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [composerOpen, selectedAuthorProfile, selectedPost]);

  useEffect(() => {
    let isMounted = true;

    const loadCommunity = async () => {
      setCommunityStatus("Loading community...");
      const [records, localPosts, reactions, profile] = await Promise.all([fetchCommunityPosts(), getLocalCommunityPosts(), getLocalCommunityReactions(), getCurrentUserProfile()]);
      if (!isMounted) return;
      setCurrentUserId(profile?.user?.id ?? null);
      const remotePosts = (records ?? []).filter((post) => !isPlaceholderCommunityPost(post));
      const devicePosts = localPosts.filter((post) => !isPlaceholderCommunityPost(post));
      const mergedPosts = [
        ...devicePosts,
        ...remotePosts.filter((remote) => !devicePosts.some((local) => local.id === remote.id)),
      ];
      setCommunityFeed(mergedPosts);
      const remoteReactions = await fetchCommunityReactions(mergedPosts.map((post) => post.id));
      const mergedReactions = { ...reactions };
      for (const item of remoteReactions ?? []) {
        mergedReactions[item.post_id] = {
          ...(mergedReactions[item.post_id] || {}),
          [item.reaction]: Math.max(mergedReactions[item.post_id]?.[item.reaction] || 0, item.count),
        };
      }
      setPostReactions(mergedReactions);
      setCommunityStatus(mergedPosts.length ? "Community posts loaded." : "No community posts yet.");
    };

    loadCommunity().finally(() => {
      if (isMounted) {
        setRefreshing(false);
        setCommunityStatus((status) => status === "Loading community..." ? "Community is ready." : status);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [refreshToken, setRefreshing]);

  const followAuthor = async (post: any) => {
    if (!post.author_id) {
      setCommunityStatus("This author cannot be followed yet.");
      return;
    }
    const result = await followCommunityUser(post.author_id);
    setCommunityStatus(result.message);
  };

  const openAuthorProfile = async (post: any) => {
    if (!post.author_id) {
      setCommunityStatus("This author profile is not available yet.");
      return;
    }
    setCommunityStatus("Loading author profile...");
    const [profile, posts] = await Promise.all([
      fetchPublicProfile(post.author_id),
      fetchCommunityPostsByAuthor(post.author_id),
    ]);
    if (!profile) {
      setCommunityStatus("This author profile is not available yet.");
      return;
    }
    setSelectedAuthorProfile({
      ...profile,
      username: profile.username || cleanUsername(post.author_username),
      display_name: profile.display_name || post.author_name,
    });
    setSelectedAuthorPosts((posts ?? []).filter((item) => !isPlaceholderCommunityPost(item)));
    setCommunityStatus("Community profile loaded.");
  };

  const sharePost = async (post: any) => {
    await Share.share({ message: communityPostLink(post), url: communityPostLink(post) });
  };

  const renderAuthorHeader = (post: any) => {
    const identity = communityAuthorIdentity(post);
    return (
      <View>
        <Text style={styles.postAuthor}>{identity.name}</Text>
        {identity.username ? (
          <Pressable disabled={!post.author_id} onPress={() => openAuthorProfile(post)}>
            <Text style={[styles.usernameLink, !post.author_id && styles.usernameLinkDisabled]}>@{identity.username}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const removePost = async (post: any) => {
    const result = await deleteCommunityPost(post.id);
    setCommunityStatus(result.message);
    if (result.ok) {
      setCommunityFeed((items) => items.filter((item) => item.id !== post.id));
      setSelectedPost(null);
    }
  };

  useEffect(() => {
    if (!selectedPost?.id) return;
    Promise.all([fetchCommunityComments(selectedPost.id), getLocalCommunityComments(selectedPost.id)]).then(([records, localComments]) => {
      const remoteComments = records ?? [];
      setComments([
        ...remoteComments,
        ...localComments.filter((local) => !remoteComments.some((remote) => remote.id === local.id)),
      ]);
    });
  }, [selectedPost?.id]);

  if (selectedAuthorProfile) {
    const identity = communityAuthorIdentity({
      author_id: selectedAuthorProfile.id,
      author_name: selectedAuthorProfile.display_name,
      author_username: selectedAuthorProfile.username,
    });
    return (
      <View style={styles.stackLarge}>
        <Pressable style={styles.backButton} onPress={() => {
          setSelectedAuthorProfile(null);
          setSelectedAuthorPosts([]);
        }}>
          <Ionicons color={colors.primary} name="arrow-back" size={20} />
          <Text style={styles.backButtonText}>{selectedPost ? "Post" : "Community"}</Text>
        </Pressable>
        <SectionCard>
          <View style={styles.cardBody}>
            <View style={styles.profileInfo}>
              <View style={styles.avatar}>
                <Ionicons color="#ffffff" name="person-outline" size={24} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{identity.name}</Text>
                {identity.username ? <Text style={styles.usernameLink}>@{identity.username}</Text> : null}
                <Text style={styles.mutedText}>{selectedAuthorProfile.verification_status || selectedAuthorProfile.catholic_status || "Community member"}</Text>
              </View>
            </View>
            <InfoRow icon="business-outline" label="Home parish" value={selectedAuthorProfile.home_parish || "Not shared"} />
            <InfoRow icon="chatbubbles-outline" label="Published posts" value={`${selectedAuthorPosts.length}`} />
          </View>
        </SectionCard>
        {selectedAuthorPosts.length ? selectedAuthorPosts.map((post) => (
          <Pressable key={post.id ?? post.title} style={styles.postCard} onPress={() => {
            setSelectedAuthorProfile(null);
            setSelectedAuthorPosts([]);
            setSelectedPost(post);
          }}>
            <Text style={styles.postTitle}>{post.title}</Text>
            <Text style={styles.postBody}>{post.body}</Text>
            <Text style={styles.mutedText}>{post.comment_count ?? 0} Comments</Text>
          </Pressable>
        )) : (
          <View style={styles.noticeBox}>
            <Text style={styles.mutedText}>No published posts from this user yet.</Text>
          </View>
        )}
      </View>
    );
  }

  if (selectedPost) {
    return (
      <View style={styles.stackLarge}>
        <Pressable style={styles.backButton} onPress={() => setSelectedPost(null)}>
          <Ionicons color={colors.primary} name="arrow-back" size={20} />
          <Text style={styles.backButtonText}>Community</Text>
        </Pressable>
        <View style={[styles.postCard, selectedPost.featured && styles.featuredPost]}>
          <View style={styles.postMeta}>
            {renderAuthorHeader(selectedPost)}
            {selectedPost.author_badge ? <Text style={styles.verifiedBadge}>{selectedPost.author_badge}</Text> : null}
            {selectedPost.clergy_attribution ? <Text style={styles.verifiedBadge}>{selectedPost.clergy_attribution}</Text> : null}
          </View>
          <Text style={styles.postTitle}>{selectedPost.title}</Text>
          <Text style={styles.postBody}>{selectedPost.body}</Text>
          {renderReactions(selectedPost)}
          <Text style={styles.mutedText}>{communityStatus}</Text>
          <View style={styles.adminActionRow}>
            {selectedPost.author_id && selectedPost.author_id !== currentUserId ? (
              <Pressable style={styles.adminActionButton} onPress={() => followAuthor(selectedPost)}>
                <Ionicons color={colors.primary} name="person-add-outline" size={16} />
                <Text style={styles.adminActionText}>Follow</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.adminActionButton} onPress={() => sharePost(selectedPost)}>
              <Ionicons color={colors.primary} name="logo-whatsapp" size={16} />
              <Text style={styles.adminActionText}>Share</Text>
            </Pressable>
            {selectedPost.author_id && selectedPost.author_id === currentUserId ? (
              <Pressable style={[styles.adminActionButton, styles.adminActionDanger]} onPress={() => removePost(selectedPost)}>
                <Ionicons color={colors.danger} name="trash-outline" size={16} />
                <Text style={[styles.adminActionText, styles.adminActionDangerText]}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
          <SubmitButton
            icon="flag-outline"
            label="Report Post"
            successLabel="Reported"
            state={reportSubmit}
            variant="secondary"
            onPress={async () => {
              setReportSubmit("saving");
              const result = await reportCommunityPost(selectedPost.id, "User reported this post for moderator review.");
              setCommunityStatus(result.message);
              setReportSubmit(result.ok ? "success" : "idle");
              if (result.ok) setTimeout(() => setReportSubmit("idle"), 1800);
            }}
          />
        </View>
        <SectionCard>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Comments</Text>
            <Text style={styles.smallBadge}>{comments.length}</Text>
          </View>
          <View style={styles.cardBody}>
            {comments.length ? comments.map((comment) => (
              <View key={comment.id} style={styles.noticeBox}>
                <Text style={styles.postAuthor}>{comment.author_name || "Guest"}{comment.author_username ? ` @${comment.author_username}` : ""}</Text>
                <Text style={styles.postBody}>{comment.body}</Text>
              </View>
            )) : <Text style={styles.mutedText}>No comments yet.</Text>}
            <AdBanner placement="community_comment" refreshToken={comments.length} />
            <TextInput
              multiline
              onChangeText={setCommentDraft}
              placeholder="Write a charitable comment..."
              placeholderTextColor="#77717d"
              style={styles.composerInput}
              value={commentDraft}
            />
            <SubmitButton
              label="Post Comment"
              successLabel="Posted"
              state={commentSubmit}
              onPress={async () => {
                if (!commentDraft.trim()) return;
                setCommentSubmit("saving");
                const result = await createCommunityComment(selectedPost.id, commentDraft);
                setCommunityStatus(result.message);
                if (result.ok && result.comment) {
                  setComments((items) => [...items, result.comment]);
                  saveLocalCommunityComment(result.comment).catch(() => undefined);
                  setCommunityFeed((items) => items.map((post) => post.id === selectedPost.id ? { ...post, comment_count: (post.comment_count ?? 0) + 1 } : post));
                  setSelectedPost((post: any) => post ? { ...post, comment_count: (post.comment_count ?? 0) + 1 } : post);
                } else {
                  const localComment = {
                    id: `local-comment-${Date.now()}`,
                    post_id: selectedPost.id,
                    body: commentDraft,
                    author_name: "Guest",
                    moderation_status: "published",
                    created_at: new Date().toISOString(),
                  };
                  setComments((items) => [...items, localComment]);
                  saveLocalCommunityComment(localComment).catch(() => undefined);
                  setCommunityStatus(`${result.message} Saved locally on this device.`);
                }
                setCommentDraft("");
                setCommentSubmit("success");
                setTimeout(() => setCommentSubmit("idle"), 1800);
              }}
            />
          </View>
        </SectionCard>
      </View>
    );
  }

  return (
    <View style={styles.stackLarge}>
      <View style={styles.segmented}>
        <Text style={styles.segmentActive}>Latest</Text>
        <Text style={styles.segment}>Popular</Text>
      </View>
      <Text style={styles.mutedText}>{communityStatus}</Text>
      <AdBanner placement="community_top" refreshToken={refreshToken} />
      {communityFeed.map((post, index) => (
        <React.Fragment key={post.id ?? post.title}>
        <Pressable key={post.id ?? post.title} style={[styles.postCard, post.featured && styles.featuredPost]} onPress={() => setSelectedPost(post)}>
          <View style={styles.postMeta}>
            {renderAuthorHeader(post)}
            {post.author_badge ? <Text style={styles.verifiedBadge}>{post.author_badge}</Text> : null}
            {post.clergy_attribution ? <Text style={styles.verifiedBadge}>{post.clergy_attribution}</Text> : null}
          </View>
          <Text style={styles.postTitle}>{post.title}</Text>
          <Text style={styles.postBody}>{post.body}</Text>
          {renderReactions(post)}
          <View style={styles.postFooter}>
            <Text style={styles.mutedText}>{post.comment_count ?? 0} Comments</Text>
            {post.author_id && post.author_id !== currentUserId ? <Text style={styles.mutedText}>Follow available</Text> : <Text style={styles.mutedText}>Community</Text>}
          </View>
        </Pressable>
        {(index + 1) % 3 === 0 ? <AdBanner placement="community_inline" refreshToken={refreshToken + index} /> : null}
        </React.Fragment>
      ))}
      {!communityFeed.length ? (
        <SectionCard>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>No community posts yet</Text>
            <Text style={styles.mutedText}>Create the first parish notice, prayer request, or reflection for CatApp.</Text>
          </View>
        </SectionCard>
      ) : null}
      {composerOpen ? (
        <SectionCard>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Create Post</Text>
            <Text style={styles.smallBadge}>Text only</Text>
          </View>
          <View style={styles.cardBody}>
            <TextInput
              onChangeText={setDraftTitle}
              placeholder="Post title"
              placeholderTextColor="#77717d"
              style={styles.searchInputBox}
              value={draftTitle}
            />
            <TextInput
              multiline
              onChangeText={setDraft}
              placeholder="Share a reflection, parish notice, or prayer request..."
              placeholderTextColor="#77717d"
              style={styles.composerInput}
              value={draft}
            />
            <SubmitButton
              label="Publish Post"
              successLabel="Published"
              state={postSubmit}
              onPress={async () => {
                if (!draftTitle.trim() || !draft.trim()) return;
                setPostSubmit("saving");
                const result = await createCommunityPost({ title: draftTitle, body: draft, category: "General" });
                setCommunityStatus(result.message);
                if (result.ok && result.post) {
                  setCommunityFeed((items) => [result.post, ...items]);
                  saveLocalCommunityPost(result.post).catch(() => undefined);
                }
                if (!result.ok) {
                  const localPost = {
                    id: `local-post-${Date.now()}`,
                    author_name: "Guest",
                    title: draftTitle,
                    body: draft,
                    comment_count: 0,
                    featured: false,
                    moderation_status: "published",
                    created_at: new Date().toISOString(),
                  };
                  setCommunityFeed((items) => [localPost, ...items]);
                  saveLocalCommunityPost(localPost).catch(() => undefined);
                  setCommunityStatus(`${result.message} Post saved locally on this device.`);
                }
                setDraft("");
                setDraftTitle("");
                setPostSubmit("success");
                setTimeout(() => {
                  setComposerOpen(false);
                  setPostSubmit("idle");
                }, 1100);
              }}
            />
          </View>
        </SectionCard>
      ) : null}
      <Pressable style={styles.floatingAction} onPress={() => setComposerOpen((value) => !value)}>
        <Ionicons color="#ffffff" name="add" size={28} />
      </Pressable>
    </View>
  );
}

function distanceFromLagos(latitude: number, longitude: number) {
  const lagos = { latitude: 6.455, longitude: 3.394 };
  return distanceBetween(lagos.latitude, lagos.longitude, latitude, longitude);
}

function distanceBetween(fromLatitude: number, fromLongitude: number, latitude: number, longitude: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(latitude - fromLatitude);
  const dLon = toRad(longitude - fromLongitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(fromLatitude)) * Math.cos(toRad(latitude)) * Math.sin(dLon / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatParishRecord(record: any, index = 0, userCoords?: { latitude: number; longitude: number }) {
  const hasLatitude = record.latitude !== null && record.latitude !== undefined && String(record.latitude).trim() !== "";
  const hasLongitude = record.longitude !== null && record.longitude !== undefined && String(record.longitude).trim() !== "";
  const latitude = hasLatitude ? Number(record.latitude) : Number.NaN;
  const longitude = hasLongitude ? Number(record.longitude) : Number.NaN;
  const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);
  const distanceKm = hasCoords
    ? userCoords
      ? distanceBetween(userCoords.latitude, userCoords.longitude, latitude, longitude)
      : null
    : null;

  return {
    id: record.id,
    name: record.name,
    diocese: record.diocese,
    mass: record.mass_times?.[0]?.times?.[0] ?? record.massTimes?.[0]?.times?.[0] ?? record.mass ?? "Schedule pending",
    distance: distanceKm === null ? "Use location" : `${distanceKm.toFixed(1)} km`,
    distanceKm,
    address: record.address ?? record.location ?? "Address pending",
    confession: record.confession_times?.[0]?.times?.[0] ?? record.confessionTimes?.[0]?.times?.[0] ?? record.confession ?? "By appointment",
    verified: record.verified ?? (record.last_confirmed_at ? `Verified ${new Date(record.last_confirmed_at).toLocaleDateString()}` : "Verified parish"),
    phone: record.phone,
    dataQualityNotes: record.data_quality_notes,
    latitude: record.latitude,
    longitude: record.longitude,
    isProfileParish: Boolean(record.isProfileParish || record.id?.startsWith?.("local-profile-") || record.diocese === "Saved Parish"),
    isLocalParish: Boolean(record.isLocalParish || record.id?.startsWith?.("local-") || record.id?.startsWith?.("local-profile-")),
  };
}

function ParishesScreen() {
  const [selectedParish, setSelectedParish] = useState<any | null>(null);
  const [query, setQuery] = useState("");
  const [mapMode, setMapMode] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorNote, setEditorNote] = useState("");
  const [editorAddress, setEditorAddress] = useState("");
  const [editorPhone, setEditorPhone] = useState("");
  const [editorMassTimes, setEditorMassTimes] = useState("");
  const [editorConfessionTimes, setEditorConfessionTimes] = useState("");
  const [parishStatus, setParishStatus] = useState("Location optional. Use location for accurate parish distance.");
  const [directoryParishes, setDirectoryParishes] = useState<any[]>(parishes);
  const [allDirectoryParishes, setAllDirectoryParishes] = useState<any[]>(parishes);
  const [rawParishRecords, setRawParishRecords] = useState<any[]>([]);
  const [parishSubmit, setParishSubmit] = useState<SubmitState>("idle");
  const searchSource = query.trim() ? allDirectoryParishes : directoryParishes;
  const visibleParishes = searchSource.filter((parish) => `${parish.name ?? ""} ${parish.diocese ?? ""} ${parish.address ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (editorOpen) {
        setEditorOpen(false);
        return true;
      }
      if (selectedParish) {
        setSelectedParish(null);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [editorOpen, selectedParish]);

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchVerifiedParishes(), getLocalParishes(), getAppSettings()]).then(([records, localRecords, settings]) => {
      if (!isMounted) return;

      const profileParish = settings.profile?.homeParish?.trim()
        ? localParishFromProfile({
            fullName: settings.profile.fullName,
            homeParish: settings.profile.homeParish,
            homeParishAddress: settings.profile.homeParishAddress,
            homeParishPhone: settings.profile.homeParishPhone,
            homeParishMassTimes: settings.profile.homeParishMassTimes,
            homeParishConfessionTimes: settings.profile.homeParishConfessionTimes,
          })
        : null;
      const remoteRecords = records?.length ? records : [];
      const mergedRecords = mergeUniqueById([...(profileParish ? [profileParish] : []), ...(localRecords ?? []), ...remoteRecords, ...parishes]);
      setRawParishRecords(mergedRecords);
      const mapped = mergedRecords.map((record, index) => formatParishRecord(record, index));
      setAllDirectoryParishes(mapped);
      setDirectoryParishes(mapped);
      const savedCount = (localRecords?.length ?? 0) + (profileParish ? 1 : 0);
      if (savedCount) {
        setParishStatus(`${savedCount} saved/profile parish${savedCount === 1 ? "" : "es"} available. Use location for accurate distance.`);
      } else if (remoteRecords.length) {
        setParishStatus(`${remoteRecords.length} parish${remoteRecords.length === 1 ? "" : "es"} loaded from the directory. Use location for accurate distance.`);
      } else {
        setParishStatus("Showing the bundled parish directory. Saved profile parishes and database updates will appear here.");
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (selectedParish) {
    return (
      <View style={styles.stackLarge}>
        <Pressable style={styles.backButton} onPress={() => setSelectedParish(null)}>
          <Ionicons color={colors.primary} name="arrow-back" size={20} />
          <Text style={styles.backButtonText}>Nearby Parishes</Text>
        </Pressable>
        <SectionCard>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.overlinePurple}>{selectedParish.diocese}</Text>
              <Text style={styles.cardTitle}>{selectedParish.name}</Text>
            </View>
            <Text style={styles.distance}>{selectedParish.distance}</Text>
          </View>
          <View style={styles.cardBody}>
            <InfoRow icon="location-outline" label="Address" value={selectedParish.address} />
            <InfoRow icon="time-outline" label="Next Mass" value={selectedParish.mass} />
            <InfoRow icon="chatbubble-ellipses-outline" label="Confession" value={selectedParish.confession} />
            <InfoRow icon="call-outline" label="Phone" value={selectedParish.phone || "Pending"} />
            <InfoRow icon="map-outline" label="Coordinates" value={selectedParish.latitude && selectedParish.longitude ? `${selectedParish.latitude}, ${selectedParish.longitude}` : "Pending geocoding"} />
            <InfoRow icon="shield-checkmark-outline" label="Directory Status" value={selectedParish.verified} />
            <InfoRow icon="alert-circle-outline" label="Missing Data" value={selectedParish.dataQualityNotes || "Needs community confirmation."} />
            <Pressable style={styles.primaryButtonWide} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedParish.address)}`)}>
              <Text style={styles.primaryButtonText}>Open Directions</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setEditorOpen((value) => !value)}>
              <Ionicons color={colors.primary} name="create-outline" size={18} />
              <Text style={styles.secondaryButtonText}>Update Parish Details</Text>
            </Pressable>
            {editorOpen ? (
              <View style={styles.noticeBox}>
                <TextInput
                  onChangeText={setEditorAddress}
                  placeholder="Exact parish address"
                  placeholderTextColor="#77717d"
                  style={styles.searchInputBox}
                  value={editorAddress}
                />
                <TextInput
                  onChangeText={setEditorPhone}
                  placeholder="Parish phone number"
                  placeholderTextColor="#77717d"
                  style={styles.searchInputBox}
                  value={editorPhone}
                />
                <TextInput
                  onChangeText={setEditorMassTimes}
                  placeholder="Mass times"
                  placeholderTextColor="#77717d"
                  style={styles.searchInputBox}
                  value={editorMassTimes}
                />
                <TextInput
                  onChangeText={setEditorConfessionTimes}
                  placeholder="Confession times"
                  placeholderTextColor="#77717d"
                  style={styles.searchInputBox}
                  value={editorConfessionTimes}
                />
                <TextInput
                  multiline
                  onChangeText={setEditorNote}
                  placeholder="Extra notes for the parish admin..."
                  placeholderTextColor="#77717d"
                  style={styles.composerInput}
                  value={editorNote}
                />
                <SubmitButton
                  label="Save Parish Details"
                  successLabel="Saved"
                  state={parishSubmit}
                  onPress={async () => {
                    if (![editorAddress, editorPhone, editorMassTimes, editorConfessionTimes, editorNote].some((value) => value.trim())) return;
                    setParishSubmit("saving");
                    const result = await updateParishDetails({
                      parishId: selectedParish.id,
                      parishName: selectedParish.name,
                      submittedByName: "CatApp parish editor",
                      proposedAddress: editorAddress,
                      proposedPhone: editorPhone,
                      proposedMassTimes: editorMassTimes,
                      proposedConfessionTimes: editorConfessionTimes,
                      sourceContext: "parish_detail_screen",
                      note: editorNote || "Structured parish update submitted from the parish detail screen.",
                    });
                    setParishStatus(result.message);
                    if (result.parish) {
                      const parish = result.parish;
                      await saveLocalParish(parish as any);
                      setRawParishRecords((records) => mergeUniqueById([parish, ...records]));
                      setAllDirectoryParishes((records) => mergeUniqueById([formatParishRecord(parish), ...records]));
                      setDirectoryParishes((records) => mergeUniqueById([formatParishRecord(parish), ...records]));
                      setSelectedParish(formatParishRecord(parish));
                    }
                    setParishSubmit(result.ok || result.parish ? "success" : "idle");
                    if (result.ok || result.parish) {
                      setTimeout(() => {
                        setEditorAddress("");
                        setEditorPhone("");
                        setEditorMassTimes("");
                        setEditorConfessionTimes("");
                        setEditorNote("");
                        setEditorOpen(false);
                        setParishSubmit("idle");
                      }, 1100);
                    }
                  }}
                />
              </View>
            ) : null}
          </View>
        </SectionCard>
      </View>
    );
  }

  return (
    <View style={styles.stackLarge}>
      <SearchBox placeholder="Search city or address..." value={query} onChangeText={setQuery} />
      <Text style={styles.mutedText}>{parishStatus}</Text>
      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>Nearby Parishes</Text>
        <Pressable style={styles.mapButton} onPress={() => setMapMode((value) => !value)}>
          <Ionicons color={colors.secondary} name={mapMode ? "list-outline" : "map-outline"} size={21} />
          <Text style={styles.mapButtonText}>{mapMode ? "List" : "Map"}</Text>
        </Pressable>
      </View>
      <Pressable style={styles.secondaryButton} onPress={async () => {
        const result = await requestCurrentLocation();
        setParishStatus(result.message);
        if (!result.ok || !result.coords || !rawParishRecords.length) return;
        const formatted = rawParishRecords.map((record, index) => formatParishRecord(record, index, result.coords));
        const nearby = formatted
          .filter((record) => record.distanceKm !== null && record.distanceKm <= 10)
          .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
        const savedOrProfile = formatted.filter((record) => record.isProfileParish || record.isLocalParish);
        const nextParishes = mergeUniqueById([...savedOrProfile, ...nearby]);

        setDirectoryParishes(nextParishes);
        setParishStatus(
          nearby.length
            ? `Showing ${nearby.length} geocoded parish${nearby.length === 1 ? "" : "es"} within 10 km. Saved/profile parishes stay visible even while coordinates are pending.`
            : savedOrProfile.length
              ? "No geocoded parishes were found within 10 km. Your saved/profile parish is still shown while coordinates are pending."
              : "No geocoded parishes were found within 10 km.",
        );
      }}>
        <Ionicons color={colors.primary} name="navigate-outline" size={18} />
        <Text style={styles.secondaryButtonText}>Use My Location</Text>
      </Pressable>
      {mapMode ? (
        <View style={styles.mapPanel}>
          {visibleParishes.map((parish) => (
            <Pressable key={`map-${parish.id || parish.name}`} style={styles.mapPinRow} onPress={() => setSelectedParish(parish)}>
              <View style={styles.mapPin} />
              <View style={styles.flex}>
                <Text style={styles.hymnTitle}>{parish.name}</Text>
                <Text style={styles.mutedText}>{parish.distance} - {parish.address}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {visibleParishes.map((parish) => (
        <Pressable key={parish.id || parish.name} style={styles.parishCard} onPress={() => setSelectedParish(parish)}>
          <View style={styles.titleRow}>
            <Text style={styles.parishTitle}>{parish.name}</Text>
            <Text style={styles.distance}>{parish.distance}</Text>
          </View>
          <Text style={styles.parishDiocese}>{parish.diocese}</Text>
          <View style={styles.row}>
            <Ionicons color={colors.muted} name="time-outline" size={20} />
            <Text style={styles.massTime}>Next Mass: {parish.mass}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function ProfileScreen({
  darkMode,
  setDarkMode,
}: {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}) {
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [aboutPage, setAboutPage] = useState<"main" | "privacy" | "terms">("main");
  const [selectedAdminModule, setSelectedAdminModule] = useState<AdminModuleName | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileRole, setProfileRole] = useState("Guest");
  const [homeParish, setHomeParish] = useState("Holy Cross Cathedral, Lagos");
  const [homeParishAddress, setHomeParishAddress] = useState("");
  const [homeParishPhone, setHomeParishPhone] = useState("");
  const [homeParishMassTimes, setHomeParishMassTimes] = useState("");
  const [homeParishConfessionTimes, setHomeParishConfessionTimes] = useState("");
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileHydrated, setProfileHydrated] = useState(false);
  const [documentNote, setDocumentNote] = useState("");
  const [profileStatus, setProfileStatus] = useState("Sign in or create an account to complete your Catholic profile.");
  const [adminStatus, setAdminStatus] = useState("");
  const [showVerificationForm, setShowVerificationForm] = useState(false);
  const [prayerReminder, setPrayerReminder] = useState(false);
  const [offlineDownloads, setOfflineDownloads] = useState(false);
  const [privacyLocation, setPrivacyLocation] = useState(false);
  const [privacyActivity, setPrivacyActivity] = useState(true);
  const [adminOverview, setAdminOverview] = useState<any | null>(null);
  const [adminModuleRows, setAdminModuleRows] = useState<Record<string, any>[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminActionKey, setAdminActionKey] = useState("");
  const [myCommunityPosts, setMyCommunityPosts] = useState<any[]>([]);
  const [signInSubmit, setSignInSubmit] = useState<SubmitState>("idle");
  const [signUpSubmit, setSignUpSubmit] = useState<SubmitState>("idle");
  const [googleSubmit, setGoogleSubmit] = useState<SubmitState>("idle");
  const [profileSubmit, setProfileSubmit] = useState<SubmitState>("idle");
  const [identitySubmit, setIdentitySubmit] = useState<SubmitState>("idle");
  const [adminSubmit, setAdminSubmit] = useState<SubmitState>("idle");
  const [adTitle, setAdTitle] = useState("");
  const [adSponsor, setAdSponsor] = useState("");
  const [adPlacement, setAdPlacement] = useState("today_top");
  const [adBody, setAdBody] = useState("");
  const [adTargetUrl, setAdTargetUrl] = useState("");
  const [adSubmit, setAdSubmit] = useState<SubmitState>("idle");
  const [baptismalCard, setBaptismalCard] = useState<ImagePicker.ImagePickerAsset | null>(null);

  useEffect(() => {
    const finishAuth = async (url: string | null) => {
      if (!url) return;
      const result = await handleSupabaseAuthCallback(url);
      if (!result.ok) return;
      const record = await getCurrentUserProfile();
      if (!record?.user) return;
      setIsAuthenticated(true);
      setEmail(record.user.email || email);
      setFullName((current) => record.profile?.display_name || record.user.user_metadata?.full_name || current);
      const authRole = record.user.app_metadata?.role;
      setIsAdmin(Boolean(record.profile?.is_admin || authRole === "superadmin"));
      setProfileRole(authRole === "superadmin" ? "Superadmin" : record.profile?.is_admin ? "Admin" : record.profile?.verification_status || "Member");
      setProfileStatus(result.message);
    };

    Linking.getInitialURL().then(finishAuth);
    const subscription = Linking.addEventListener("url", ({ url }) => finishAuth(url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!showAdmin) return;
    setAdminLoading(true);
    fetchAdminOverview()
      .then((overview) => {
        setAdminOverview(overview);
        setAdminStatus(Object.keys(overview).length ? "Admin data refreshed." : "Admin access is required.");
      })
      .finally(() => setAdminLoading(false));
  }, [showAdmin]);

  useEffect(() => {
    if (!showAdmin || !selectedAdminModule || !isAdmin) return;
    setAdminModuleRows([]);
    setAdminLoading(true);
    fetchAdminModuleData(selectedAdminModule as AdminModuleName)
      .then((result) => {
        setAdminModuleRows(result.rows ?? []);
        setAdminStatus(result.message);
      })
      .finally(() => setAdminLoading(false));
  }, [isAdmin, selectedAdminModule, showAdmin]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (selectedAdminModule) {
        setSelectedAdminModule(null);
        return true;
      }
      if (showAdmin) {
        setShowAdmin(false);
        return true;
      }
      if (showAbout) {
        if (aboutPage !== "main") {
          setAboutPage("main");
          return true;
        }
        setShowAbout(false);
        return true;
      }
      if (profileEditing) {
        setProfileEditing(false);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [aboutPage, profileEditing, selectedAdminModule, showAbout, showAdmin]);

  useEffect(() => {
    let isMounted = true;

    const hydrateProfile = async () => {
      const [settings, record, posts] = await Promise.all([getAppSettings(), getCurrentUserProfile(), fetchMyCommunityPosts()]);
      if (!isMounted) return;

      setPrayerReminder(settings.prayerReminder);
      setOfflineDownloads(settings.offlineDownloads);
      setPrivacyLocation(settings.shareLocation);
      setPrivacyActivity(settings.showActivity);
      setDarkMode(settings.darkMode);
      if (settings.profile) {
        setFullName(settings.profile.fullName || "");
        setEmail(settings.profile.email || "");
        setHomeParish(settings.profile.homeParish || "Holy Cross Cathedral, Lagos");
        setHomeParishAddress(settings.profile.homeParishAddress || "");
        setHomeParishPhone(settings.profile.homeParishPhone || "");
        setHomeParishMassTimes(settings.profile.homeParishMassTimes || "");
        setHomeParishConfessionTimes(settings.profile.homeParishConfessionTimes || "");
        setProfileCompleted(Boolean(settings.profile.completed));
      }

      if (record?.user) {
        setIsAuthenticated(true);
        setEmail(record.user.email || settings.profile?.email || "");
        setFullName((current) => record.profile?.display_name || record.user.user_metadata?.full_name || current);
        setHomeParish((current) => record.user.user_metadata?.home_parish || current);
        setHomeParishAddress((current) => record.user.user_metadata?.home_parish_address || current);
        setHomeParishPhone((current) => record.user.user_metadata?.home_parish_phone || current);
        setHomeParishMassTimes((current) => record.user.user_metadata?.home_parish_mass_times || current);
        setHomeParishConfessionTimes((current) => record.user.user_metadata?.home_parish_confession_times || current);
        if (record.user.user_metadata?.home_parish) setProfileCompleted(true);
        const authRole = record.user.app_metadata?.role;
        setIsAdmin(Boolean(record.profile?.is_admin || authRole === "superadmin"));
        setProfileRole(authRole === "superadmin" ? "Superadmin" : record.profile?.is_admin ? "Admin" : record.profile?.verification_status || "Member");
        setProfileStatus("Signed in.");
      }
      setMyCommunityPosts(posts ?? []);

      setProfileHydrated(true);
    };

    hydrateProfile().catch(() => {
      if (isMounted) setProfileHydrated(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!profileHydrated) {
    return (
      <View style={styles.stackLarge}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.mutedText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.stackLarge}>
        <View style={styles.centered}>
          <Text style={styles.pageTitle}>Profile</Text>
          <Text style={styles.secondaryText}>Sign in before completing your Catholic identity, home parish and privacy settings.</Text>
          <Text style={styles.mutedText}>{profileStatus}</Text>
        </View>
        <SectionCard>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Google Account</Text>
            <Text style={styles.smallBadge}>OAuth</Text>
          </View>
          <View style={styles.cardBody}>
            <SubmitButton icon="logo-google" label="Continue with Google" successLabel="Opening Google" state={googleSubmit} variant="primary" onPress={async () => {
              setGoogleSubmit("saving");
              const result = await signInWithGoogle();
              setProfileStatus(result.message);
              setGoogleSubmit(result.ok ? "success" : "idle");
              if (result.ok) setTimeout(() => setGoogleSubmit("idle"), 1800);
            }} />
          </View>
        </SectionCard>
        <SectionCard>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Email Account</Text>
            <Text style={styles.smallBadge}>{authMode === "signin" ? "Sign in" : "Create"}</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.authToggle}>
              <Pressable style={[styles.authToggleButton, authMode === "signin" && styles.authToggleButtonActive]} onPress={() => setAuthMode("signin")}>
                <Text style={[styles.authToggleText, authMode === "signin" && styles.authToggleTextActive]}>Sign In</Text>
              </Pressable>
              <Pressable style={[styles.authToggleButton, authMode === "signup" && styles.authToggleButtonActive]} onPress={() => setAuthMode("signup")}>
                <Text style={[styles.authToggleText, authMode === "signup" && styles.authToggleTextActive]}>Create Account</Text>
              </Pressable>
            </View>
            {authMode === "signup" ? (
              <TextInput value={authFullName} onChangeText={setAuthFullName} style={styles.searchInputBox} placeholder="Full name" placeholderTextColor="#77717d" />
            ) : null}
            <TextInput value={authEmail} onChangeText={setAuthEmail} autoCapitalize="none" keyboardType="email-address" style={styles.searchInputBox} placeholder="Email address" placeholderTextColor="#77717d" />
            <TextInput value={authPassword} onChangeText={setAuthPassword} secureTextEntry style={styles.searchInputBox} placeholder="Password" placeholderTextColor="#77717d" />
            {authMode === "signin" ? (
              <SubmitButton icon="mail-outline" label="Sign In with Email" successLabel="Signed In" state={signInSubmit} variant="secondary" onPress={async () => {
                if (!authEmail.trim() || !authPassword.trim()) {
                  setProfileStatus("Enter your email and password to sign in.");
                  return;
                }
                setSignInSubmit("saving");
                const result = await signInWithEmail(authEmail, authPassword);
                setProfileStatus(result.message);
                const profile = await getCurrentUserProfile();
                if (!profile?.user) {
                  setSignInSubmit("idle");
                  return;
                }
                setIsAuthenticated(true);
                const authRole = profile.user.app_metadata?.role;
                setIsAdmin(Boolean(profile.profile?.is_admin || authRole === "superadmin"));
                setProfileRole(authRole === "superadmin" ? "Superadmin" : profile.profile?.is_admin ? "Admin" : profile.profile?.verification_status || "Member");
                setFullName(profile.profile?.display_name || profile.user.user_metadata?.full_name || authFullName);
                setEmail(profile.user.email || authEmail);
                setHomeParish(profile.user.user_metadata?.home_parish || homeParish);
                setHomeParishAddress(profile.user.user_metadata?.home_parish_address || homeParishAddress);
                setHomeParishPhone(profile.user.user_metadata?.home_parish_phone || homeParishPhone);
                setHomeParishMassTimes(profile.user.user_metadata?.home_parish_mass_times || homeParishMassTimes);
                setHomeParishConfessionTimes(profile.user.user_metadata?.home_parish_confession_times || homeParishConfessionTimes);
                if (profile.user.user_metadata?.home_parish) setProfileCompleted(true);
                setAuthPassword("");
                setSignInSubmit("success");
                setTimeout(() => setSignInSubmit("idle"), 1800);
              }} />
            ) : (
              <SubmitButton icon="person-add-outline" label="Create Email Account" successLabel="Account Created" state={signUpSubmit} variant="secondary" onPress={async () => {
                if (!authFullName.trim() || !authEmail.trim() || !authPassword.trim()) {
                  setProfileStatus("Enter your name, email and password to create an account.");
                  return;
                }
                setSignUpSubmit("saving");
                const result = await signUpWithEmail(authEmail, authPassword, authFullName);
                setProfileStatus(result.message);
                const profile = await getCurrentUserProfile();
                if (!profile?.user) {
                  setSignUpSubmit("idle");
                  return;
                }
                setIsAuthenticated(true);
                setFullName(profile.profile?.display_name || profile.user.user_metadata?.full_name || authFullName);
                setEmail(profile.user.email || authEmail);
                setProfileRole(profile.profile?.verification_status || "Member");
                setAuthPassword("");
                setSignUpSubmit("success");
                setTimeout(() => setSignUpSubmit("idle"), 1800);
              }} />
            )}
          </View>
        </SectionCard>
      </View>
    );
  }

  if (showAdmin) {
    if (!isAdmin) {
      return (
        <View style={styles.stackLarge}>
          <Pressable style={styles.backButton} onPress={() => setShowAdmin(false)}>
            <Ionicons color={colors.primary} name="arrow-back" size={20} />
            <Text style={styles.backButtonText}>Profile</Text>
          </Pressable>
          <SectionCard>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Admin Access</Text>
              <Text style={styles.smallBadge}>Restricted</Text>
            </View>
            <View style={styles.cardBody}>
              <InfoRow icon="shield-half-outline" label="Current role" value={profileRole} />
              <Text style={styles.postBody}>Your account must be marked as an admin before you can view queues or run admin actions.</Text>
            </View>
          </SectionCard>
        </View>
      );
    }

    if (selectedAdminModule) {
      const moduleName = selectedAdminModule;
      const moduleRows: Record<string, Array<[keyof typeof Ionicons.glyphMap, string, string]>> = {
        "Content Management": [
          ["book-outline", "Hymns", `${adminOverview?.hymns ?? 0} published hymn(s)`],
          ["sparkles-outline", "Prayers", `${adminOverview?.prayers ?? 0} published prayer(s)`],
          ["business-outline", "Candidate parishes", `${adminOverview?.candidateParishes ?? 0} candidate parish record(s)`],
          ["calendar-outline", "Daily readings", `${adminOverview?.readingApprovals ?? 0} reading approval item(s)`],
        ],
        "Daily Reading Approvals": [["checkmark-done-outline", "Approval queue", `${adminOverview?.readingApprovals ?? 0} pending item(s)`]],
        "Hymn Corrections": [["musical-notes-outline", "Correction queue", `${adminOverview?.hymnCorrections ?? 0} suggested correction(s)`]],
        "Parish Management": [["business-outline", "Parishes", `${adminOverview?.parishes ?? 0} verified parish records`], ["create-outline", "Parish edits", `${adminOverview?.pendingParishEdits ?? 0} submitted update(s)`]],
        "Community Reports": [["flag-outline", "Reports", `${adminOverview?.pendingReports ?? 0} report(s) waiting`]],
        "Identity Verification": [["shield-checkmark-outline", "Verification queue", `${adminOverview?.pendingIdentity ?? 0} pending request(s)`]],
        "Advertisement Management": [["megaphone-outline", "Active ads", `${adminOverview?.ads ?? 0} active placement(s)`]],
        "Roles & Access": [["shield-half-outline", "Current role", profileRole], ["people-outline", "Users", `${adminOverview?.users ?? 0} profile(s)`]],
        "Audit Logs": [["reader-outline", "Activity", `${adminOverview?.auditLogs ?? 0} logged action(s)`]],
      };
      return (
        <AdminErrorBoundary resetKey={selectedAdminModule}>
        <View style={styles.stackLarge}>
          <Pressable style={styles.backButton} onPress={() => setSelectedAdminModule(null)}>
            <Ionicons color={colors.primary} name="arrow-back" size={20} />
            <Text style={styles.backButtonText}>Admin Portal</Text>
          </Pressable>
          <View>
            <Text style={styles.overline}>Admin Module</Text>
            <Text style={styles.pageTitle}>{selectedAdminModule}</Text>
            <Text style={styles.secondaryText}>Review queues, records and moderation actions.</Text>
            {adminStatus ? <Text style={styles.mutedText}>{adminStatus}</Text> : null}
          </View>
          <SectionCard>
            <View style={styles.cardBody}>
              {(moduleRows[selectedAdminModule] || []).map(([icon, label, value]) => (
                <InfoRow key={label} icon={icon} label={label} value={value} />
              ))}
              <Pressable style={styles.secondaryButton} onPress={async () => {
                try {
                  setAdminLoading(true);
                  const [overview, data] = await Promise.all([
                    fetchAdminOverview(),
                    fetchAdminModuleData(moduleName),
                  ]);
                  setAdminOverview(overview);
                  setAdminModuleRows(Array.isArray(data.rows) ? data.rows : []);
                  setAdminStatus(data.message);
                } catch (error: any) {
                  setAdminStatus(error?.message || "Admin data could not be refreshed.");
                } finally {
                  setAdminLoading(false);
                }
              }}>
                <Ionicons color={colors.primary} name="refresh-outline" size={18} />
                <Text style={styles.secondaryButtonText}>Refresh Module Data</Text>
              </Pressable>
            </View>
          </SectionCard>
          {moduleName === "Advertisement Management" ? (
            <SectionCard>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Post Advertisement</Text>
                <Text style={styles.smallBadge}>Live placement</Text>
              </View>
              <View style={styles.cardBody}>
                <TextInput value={adTitle} onChangeText={setAdTitle} style={styles.searchInputBox} placeholder="Advert title" placeholderTextColor="#77717d" />
                <TextInput value={adSponsor} onChangeText={setAdSponsor} style={styles.searchInputBox} placeholder="Sponsor or parish name" placeholderTextColor="#77717d" />
                <TextInput value={adPlacement} onChangeText={setAdPlacement} autoCapitalize="none" style={styles.searchInputBox} placeholder="Placement, e.g. today_top" placeholderTextColor="#77717d" />
                <TextInput value={adTargetUrl} onChangeText={setAdTargetUrl} autoCapitalize="none" keyboardType="url" style={styles.searchInputBox} placeholder="Target URL (optional)" placeholderTextColor="#77717d" />
                <TextInput value={adBody} onChangeText={setAdBody} multiline style={styles.composerInput} placeholder="Advert body or admin note" placeholderTextColor="#77717d" />
                <SubmitButton
                  icon="megaphone-outline"
                  label="Post Advert"
                  successLabel="Advert Posted"
                  state={adSubmit}
                  variant="secondary"
                  onPress={async () => {
                    if (!adTitle.trim()) {
                      setAdminStatus("Add an advert title before posting.");
                      return;
                    }
                    setAdSubmit("saving");
                    const result = await createAdvertisement({
                      title: adTitle,
                      sponsor: adSponsor,
                      placement: adPlacement,
                      body: adBody,
                      targetUrl: adTargetUrl,
                      status: "active",
                    });
                    setAdminStatus(result.message);
                    if (result.ok) {
                      const [overview, data] = await Promise.all([
                        fetchAdminOverview(),
                        fetchAdminModuleData(moduleName),
                      ]);
                      setAdminOverview(overview);
                      setAdminModuleRows(Array.isArray(data.rows) ? data.rows : []);
                      setAdTitle("");
                      setAdSponsor("");
                      setAdPlacement("today_top");
                      setAdBody("");
                      setAdTargetUrl("");
                    }
                    setAdSubmit(result.ok ? "success" : "idle");
                    if (result.ok) setTimeout(() => setAdSubmit("idle"), 1200);
                  }}
                />
              </View>
            </SectionCard>
          ) : null}
          {adminLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.mutedText}>Loading admin data...</Text>
              </View>
            ) : adminModuleRows.filter(Boolean).length ? (
              adminModuleRows.filter(Boolean).map((record, index) => (
                <AdminRecordCard
                  key={`${moduleName}-${record?.id || index}`}
                  busy={adminActionKey === `${record?.id || index}-${moduleName}`}
                  moduleName={moduleName}
                  record={record}
                  onAction={async (action) => {
                    setAdminActionKey(`${record?.id || index}-${moduleName}`);
                    setAdminSubmit("saving");
                    try {
                      const result = await runAdminModuleAction(moduleName, action, record);
                      setAdminStatus(result.message);
                      const [overview, data] = await Promise.all([
                        fetchAdminOverview(),
                        fetchAdminModuleData(moduleName),
                      ]);
                      setAdminOverview(overview);
                      setAdminModuleRows(Array.isArray(data.rows) ? data.rows : []);
                      setAdminSubmit(result.ok ? "success" : "idle");
                      if (result.ok) setTimeout(() => setAdminSubmit("idle"), 1200);
                    } catch (error: any) {
                      setAdminStatus(error?.message || "Admin action failed.");
                      setAdminSubmit("idle");
                    } finally {
                      setAdminActionKey("");
                    }
                  }}
                />
              ))
            ) : (
              <View style={styles.noticeBox}>
                <Text style={styles.postBody}>No records are currently in this admin module.</Text>
              </View>
            )}
        </View>
        </AdminErrorBoundary>
      );
    }

    return (
      <View style={styles.stackLarge}>
        <Pressable style={styles.backButton} onPress={() => setShowAdmin(false)}>
          <Ionicons color={colors.primary} name="arrow-back" size={20} />
          <Text style={styles.backButtonText}>Profile</Text>
        </Pressable>
        <View>
          <Text style={styles.overline}>Role-protected</Text>
          <Text style={styles.pageTitle}>Admin Portal</Text>
          <Text style={styles.secondaryText}>In-app command center for parish records, content review, reports, identity and ads.</Text>
        </View>
        <View style={styles.adminGrid}>
          <AdminMetric label="Pending verifications" value={String(adminOverview?.pendingIdentity ?? 0)} icon="shield-checkmark-outline" />
          <AdminMetric label="Pending posts" value={String(adminOverview?.pendingPosts ?? 0)} icon="flag-outline" />
          <AdminMetric label="Reports" value={String(adminOverview?.pendingReports ?? 0)} icon="alert-circle-outline" />
          <AdminMetric label="Parish edits" value={String(adminOverview?.pendingParishEdits ?? 0)} icon="business-outline" />
          <AdminMetric label="Hymn fixes" value={String(adminOverview?.hymnCorrections ?? 0)} icon="musical-notes-outline" />
          <AdminMetric label="Reading approvals" value={String(adminOverview?.readingApprovals ?? 0)} icon="checkmark-done-outline" />
          <AdminMetric label="Ads" value={String(adminOverview?.ads ?? 0)} icon="megaphone-outline" />
          <AdminMetric label="Parishes" value={String(adminOverview?.parishes ?? 0)} icon="map-outline" />
          <AdminMetric label="Prayers / Hymns" value={`${adminOverview?.prayers ?? 0}/${adminOverview?.hymns ?? 0}`} icon="document-text-outline" />
        </View>
        <SectionCard>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Admin Queues</Text>
            <Text style={styles.smallBadge}>Human review</Text>
          </View>
          <View style={styles.cardBody}>
            <InfoRow icon="alert-circle-outline" label="Community reports" value={`${adminOverview?.pendingReports ?? 0} report(s) waiting for review`} />
            <InfoRow icon="person-add-outline" label="Identity verification" value={`${adminOverview?.pendingIdentity ?? 0} baptismal card/profile request(s)`} />
            <InfoRow icon="business-outline" label="Parish editor queue" value={`${adminOverview?.pendingParishEdits ?? 0} submitted parish correction(s)`} />
            <InfoRow icon="flag-outline" label="Pending posts" value={`${adminOverview?.pendingPosts ?? 0} post(s) waiting`} />
            <InfoRow icon="megaphone-outline" label="Advertisement management" value={`${adminOverview?.ads ?? 0} ad record(s)`} />
          </View>
        </SectionCard>
        <SectionCard>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Admin Modules</Text>
            <Text style={styles.smallBadge}>App only</Text>
          </View>
          <View style={styles.cardBody}>
            {adminModules.map((item) => (
              <Pressable key={item} style={styles.preferenceRow} onPress={() => setSelectedAdminModule(item)}>
                <Text style={styles.preferenceLabel}>{item}</Text>
                <Ionicons color={colors.muted} name="chevron-forward" size={22} />
              </Pressable>
            ))}
          </View>
        </SectionCard>
      </View>
    );
  }

  if (showAbout) {
    if (aboutPage === "privacy") {
      return (
        <View style={styles.stackLarge}>
          <Pressable style={styles.backButton} onPress={() => setAboutPage("main")}>
            <Ionicons color={colors.primary} name="arrow-back" size={20} />
            <Text style={styles.backButtonText}>About</Text>
          </Pressable>
          <View>
            <Text style={styles.overline}>CatApp</Text>
            <Text style={styles.pageTitle}>Privacy Policy</Text>
            <Text style={styles.secondaryText}>How CatApp handles profile, parish, community and verification data.</Text>
          </View>
          <SectionCard>
            <View style={styles.cardBody}>
              <InfoRow icon="person-outline" label="Account Data" value="We use your name, email and home parish to personalize your profile and sync your saved parish details." />
              <InfoRow icon="business-outline" label="Parish Data" value="Parish details you submit may be stored as community parish records or admin review requests." />
              <InfoRow icon="shield-checkmark-outline" label="Baptismal Card" value="Uploaded baptismal card images are used only for Catholic identity verification by authorized admins." />
              <InfoRow icon="chatbubbles-outline" label="Community Content" value="Posts, comments, reports and reactions may be stored to run community moderation and safety features." />
              <InfoRow icon="location-outline" label="Location" value="Location is optional and used to estimate parish distance when you enable it." />
              <Text style={styles.postBody}>For privacy questions or deletion requests, contact Nadbooks Ventures at hello@hazi.ng or WhatsApp +234 902 984 0305.</Text>
            </View>
          </SectionCard>
        </View>
      );
    }

    if (aboutPage === "terms") {
      return (
        <View style={styles.stackLarge}>
          <Pressable style={styles.backButton} onPress={() => setAboutPage("main")}>
            <Ionicons color={colors.primary} name="arrow-back" size={20} />
            <Text style={styles.backButtonText}>About</Text>
          </Pressable>
          <View>
            <Text style={styles.overline}>CatApp</Text>
            <Text style={styles.pageTitle}>Terms of Use</Text>
            <Text style={styles.secondaryText}>Guidelines for using CatApp respectfully and responsibly.</Text>
          </View>
          <SectionCard>
            <View style={styles.cardBody}>
              <InfoRow icon="heart-outline" label="Catholic Community" value="Use CatApp for prayer, parish discovery, readings, hymns and respectful Catholic community participation." />
              <InfoRow icon="create-outline" label="Submitted Content" value="Only submit parish, profile, advert or community information you believe is accurate and appropriate." />
              <InfoRow icon="megaphone-outline" label="Advertisements" value="Advert placements are subject to review and may be accepted, paused or removed by CatApp admins." />
              <InfoRow icon="shield-outline" label="Moderation" value="Admins may review, reject or remove content that is misleading, abusive, unsafe or inconsistent with the purpose of the app." />
              <InfoRow icon="alert-circle-outline" label="No Official Parish Guarantee" value="Community-submitted parish data may need verification. Confirm critical schedules directly with the parish." />
              <Text style={styles.postBody}>By using CatApp, you agree to use it lawfully, protect other users' dignity, and contact Nadbooks Ventures for support where needed.</Text>
            </View>
          </SectionCard>
        </View>
      );
    }

    return (
      <View style={styles.stackLarge}>
        <Pressable style={styles.backButton} onPress={() => {
          setAboutPage("main");
          setShowAbout(false);
        }}>
          <Ionicons color={colors.primary} name="arrow-back" size={20} />
          <Text style={styles.backButtonText}>Profile</Text>
        </Pressable>
        <View>
          <Text style={styles.overline}>About CatApp</Text>
          <Text style={styles.pageTitle}>Nadbooks Ventures</Text>
          <Text style={styles.secondaryText}>For support, partnerships and Catholic advert placements.</Text>
        </View>
        <SectionCard>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Contact Details</Text>
            <Text style={styles.smallBadge}>Official</Text>
          </View>
          <View style={styles.cardBody}>
            <InfoRow icon="business-outline" label="Name" value="Nadbooks Ventures" />
            <InfoRow icon="mail-outline" label="Email" value="hello@hazi.ng" />
            <InfoRow icon="logo-whatsapp" label="Phone / WhatsApp" value="+234 902 984 0305" />
            <Pressable style={styles.preferenceRow} onPress={() => setAboutPage("privacy")}>
              <View style={styles.row}>
                <Ionicons color={colors.secondary} name="lock-closed-outline" size={22} />
                <Text style={styles.preferenceLabel}>Privacy Policy</Text>
              </View>
              <Ionicons color={colors.muted} name="chevron-forward" size={22} />
            </Pressable>
            <Pressable style={styles.preferenceRow} onPress={() => setAboutPage("terms")}>
              <View style={styles.row}>
                <Ionicons color={colors.secondary} name="document-text-outline" size={22} />
                <Text style={styles.preferenceLabel}>Terms of Use</Text>
              </View>
              <Ionicons color={colors.muted} name="chevron-forward" size={22} />
            </Pressable>
            <Pressable style={styles.primaryButtonWide} onPress={() => Linking.openURL("mailto:hello@hazi.ng?subject=CatApp%20advert%20enquiry")}>
              <Ionicons color="#ffffff" name="mail-outline" size={18} />
              <Text style={styles.primaryButtonText}>Contact Us for Ads</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => Linking.openURL("https://wa.me/2349029840305?text=Hello%20Nadbooks%20Ventures%2C%20I%20want%20to%20advertise%20on%20CatApp.")}>
              <Ionicons color={colors.primary} name="logo-whatsapp" size={18} />
              <Text style={styles.secondaryButtonText}>Message on WhatsApp</Text>
            </Pressable>
          </View>
        </SectionCard>
      </View>
    );
  }

  return (
    <View style={styles.stackLarge}>
      <View style={styles.centered}>
        <Text style={styles.pageTitle}>{fullName || "Catholic Profile"}</Text>
        <Text style={styles.secondaryText}>{email}</Text>
        <Text style={styles.mutedText}>{profileRole} - {profileStatus}</Text>
      </View>
      {profileCompleted && !profileEditing ? (
        <SectionCard>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Profile Details</Text>
            <Text style={styles.smallBadge}>{profileRole}</Text>
          </View>
          <View style={styles.cardBody}>
            <InfoRow icon="person-outline" label="Name" value={fullName || "Not set"} />
            <InfoRow icon="mail-outline" label="Email" value={email || "Not set"} />
            <InfoRow icon="business-outline" label="Home parish" value={homeParish || "Not set"} />
            <InfoRow icon="location-outline" label="Address" value={homeParishAddress || "Pending"} />
            <InfoRow icon="call-outline" label="Phone" value={homeParishPhone || "Pending"} />
            <InfoRow icon="time-outline" label="Mass times" value={homeParishMassTimes || "Pending"} />
            <InfoRow icon="chatbubble-outline" label="Confession" value={homeParishConfessionTimes || "Pending"} />
            <Pressable style={styles.secondaryButton} onPress={() => setProfileEditing(true)}>
              <Ionicons color={colors.primary} name="create-outline" size={18} />
              <Text style={styles.secondaryButtonText}>Edit Profile</Text>
            </Pressable>
          </View>
        </SectionCard>
      ) : (
      <SectionCard>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Catholic Profile</Text>
          <Text style={styles.smallBadge}>{profileCompleted ? "Editing" : "New"}</Text>
        </View>
        <View style={styles.cardBody}>
          <TextInput value={fullName} onChangeText={setFullName} style={styles.searchInputBox} placeholder="Full name" placeholderTextColor="#77717d" />
          <TextInput value={homeParish} onChangeText={setHomeParish} style={styles.searchInputBox} placeholder="Home parish" placeholderTextColor="#77717d" />
          <TextInput value={homeParishAddress} onChangeText={setHomeParishAddress} style={styles.searchInputBox} placeholder="Home parish exact address" placeholderTextColor="#77717d" />
          <TextInput value={homeParishPhone} onChangeText={setHomeParishPhone} style={styles.searchInputBox} placeholder="Home parish phone" placeholderTextColor="#77717d" />
          <TextInput value={homeParishMassTimes} onChangeText={setHomeParishMassTimes} style={styles.searchInputBox} placeholder="Home parish Mass times" placeholderTextColor="#77717d" />
          <TextInput value={homeParishConfessionTimes} onChangeText={setHomeParishConfessionTimes} style={styles.searchInputBox} placeholder="Home parish confession times" placeholderTextColor="#77717d" />
          <SubmitButton
            icon="business-outline"
            label="Save Profile Details"
            successLabel="Profile Saved"
            state={profileSubmit}
            variant="secondary"
            onPress={async () => {
              if (![fullName, email, homeParish].some((value) => value.trim())) {
                setProfileStatus("Add your name, email or parish before saving.");
                return;
              }

              setProfileSubmit("saving");
              const localParish = homeParish.trim() ? localParishFromProfile({
                fullName,
                homeParish,
                homeParishAddress,
                homeParishPhone,
                homeParishMassTimes,
                homeParishConfessionTimes,
              }) : null;
              await syncSetting("profile", {
                fullName,
                email,
                homeParish,
                homeParishAddress,
                homeParishPhone,
                homeParishMassTimes,
                homeParishConfessionTimes,
                completed: true,
              });
              if (localParish) await saveLocalParish(localParish);

              const profileResult = await updateCurrentUserProfile({
                fullName,
                email,
                homeParish,
                homeParishAddress,
                homeParishPhone,
                homeParishMassTimes,
                homeParishConfessionTimes,
              });
              const result = localParish
                ? await syncHomeParishFromProfile({
                    fullName,
                    email,
                    homeParish,
                    homeParishAddress,
                    homeParishPhone,
                    homeParishMassTimes,
                    homeParishConfessionTimes,
                  })
                : { ok: true, message: "Profile saved." };
              setProfileStatus(profileResult.ok ? result.message : `${profileResult.message} Local profile saved.`);
              setProfileSubmit("success");
              setTimeout(() => {
                setProfileCompleted(true);
                setProfileEditing(false);
                setProfileSubmit("idle");
              }, 1100);
            }}
          />
        </View>
      </SectionCard>
      )}
      <SectionCard>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>My Community Posts</Text>
          <Text style={styles.smallBadge}>{myCommunityPosts.length}</Text>
        </View>
        <View style={styles.cardBody}>
          {myCommunityPosts.length ? myCommunityPosts.map((post) => (
            <View key={post.id} style={styles.noticeBox}>
              <Text style={styles.hymnTitle}>{post.title}</Text>
              <Text style={styles.postBody}>{post.body}</Text>
              <View style={styles.adminActionRow}>
                <Pressable style={styles.adminActionButton} onPress={() => Share.share({ message: communityPostLink(post), url: communityPostLink(post) })}>
                  <Ionicons color={colors.primary} name="logo-whatsapp" size={16} />
                  <Text style={styles.adminActionText}>Share</Text>
                </Pressable>
                <Pressable style={[styles.adminActionButton, styles.adminActionDanger]} onPress={async () => {
                  const result = await deleteCommunityPost(post.id);
                  setProfileStatus(result.message);
                  if (result.ok) setMyCommunityPosts((items) => items.filter((item) => item.id !== post.id));
                }}>
                  <Ionicons color={colors.danger} name="trash-outline" size={16} />
                  <Text style={[styles.adminActionText, styles.adminActionDangerText]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )) : <Text style={styles.mutedText}>Your published posts will appear here.</Text>}
        </View>
      </SectionCard>
      <SectionCard>
        <View style={styles.identityHeader}>
          <View style={styles.goldIcon}>
            <Ionicons color={colors.primary} name="shield-checkmark-outline" size={24} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Catholic Identity</Text>
            <Text style={styles.mutedText}>Verified Lay Catholic</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>
        <View style={styles.uploadBox}>
          <Text style={styles.postBody}>Complete your profile to unlock parish voting and community leadership features.</Text>
          <Pressable style={styles.primaryButtonWide} onPress={() => setShowVerificationForm((value) => !value)}>
            <Text style={styles.primaryButtonText}>Verify with Baptismal Card</Text>
          </Pressable>
          {showVerificationForm ? (
            <>
              <Pressable
                style={styles.secondaryButton}
                onPress={async () => {
                  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (!permission.granted) {
                    setProfileStatus("Photo access is required to upload a baptismal card.");
                    return;
                  }
                  const result = await ImagePicker.launchImageLibraryAsync({
                    allowsEditing: false,
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.8,
                  });
                  if (!result.canceled && result.assets?.[0]) {
                    setBaptismalCard(result.assets[0]);
                    setProfileStatus("Baptismal card selected. Submit it for admin verification.");
                  }
                }}
              >
                <Ionicons color={colors.primary} name="image-outline" size={18} />
                <Text style={styles.secondaryButtonText}>{baptismalCard ? "Change Baptismal Card Photo" : "Choose Baptismal Card Photo"}</Text>
              </Pressable>
              {baptismalCard ? (
                <View style={styles.noticeBox}>
                  <Image source={{ uri: baptismalCard.uri }} style={styles.verificationPreview} />
                  <Text style={styles.mutedText}>{baptismalCard.fileName || "Selected baptismal card image"}</Text>
                </View>
              ) : (
                <Text style={styles.mutedText}>Upload a clear photo of the baptismal card so admins can verify it.</Text>
              )}
              <TextInput
                multiline
                onChangeText={setDocumentNote}
                placeholder="Describe the baptismal card or parish verification document you will upload/review..."
                placeholderTextColor="#77717d"
                style={styles.composerInput}
                value={documentNote}
              />
              <SubmitButton
                icon="cloud-upload-outline"
                label="Submit Verification Request"
                successLabel="Submitted"
                state={identitySubmit}
                variant="secondary"
                 onPress={async () => {
                  if (!baptismalCard) {
                    setProfileStatus("Choose a baptismal card photo before submitting verification.");
                    return;
                  }
                  setIdentitySubmit("saving");
                  const result = await submitIdentityVerification({
                    fullName,
                    email,
                    parishName: homeParish,
                    documentNote,
                    documentUri: baptismalCard.uri,
                    documentFileName: baptismalCard.fileName,
                    documentMimeType: baptismalCard.mimeType,
                  });
                  setProfileStatus(result.message);
                  setIdentitySubmit(result.ok ? "success" : "idle");
                  if (result.ok) {
                    setTimeout(() => {
                      setDocumentNote("");
                      setBaptismalCard(null);
                      setShowVerificationForm(false);
                      setIdentitySubmit("idle");
                    }, 1100);
                  }
                }}
              />
            </>
          ) : null}
        </View>
      </SectionCard>
      <View style={styles.profileInfo}>
        <Ionicons color={colors.primary} name="business-outline" size={26} />
        <View>
          <Text style={styles.overline}>Home Parish</Text>
          <Text style={styles.hymnTitle}>{homeParish}</Text>
        </View>
      </View>
      <View style={styles.preferenceCard}>
        <View style={styles.preferenceRow}>
          <View style={styles.row}>
            <Ionicons color={colors.secondary} name="notifications-outline" size={23} />
            <Text style={styles.preferenceLabel}>Prayer Reminders</Text>
          </View>
          <Switch
            onValueChange={async (enabled) => {
              if (!enabled) {
                const result = await cancelPrayerReminders();
                setPrayerReminder(false);
                await syncSetting("prayerReminder", false);
                setProfileStatus(result.message);
                return;
              }
              const result = await scheduleDailyPrayerReminder(6, 30);
              setPrayerReminder(result.ok);
              await syncSetting("prayerReminder", result.ok);
              setProfileStatus(result.message);
            }}
            thumbColor="#ffffff"
            trackColor={{ false: colors.outline, true: colors.primary }}
            value={prayerReminder}
          />
        </View>
        <View style={styles.preferenceRow}>
          <View style={styles.row}>
            <Ionicons color={colors.secondary} name="download-outline" size={23} />
            <Text style={styles.preferenceLabel}>Offline Downloads</Text>
          </View>
          <Switch
            onValueChange={async (enabled) => {
              setOfflineDownloads(enabled);
              await syncSetting("offlineDownloads", enabled);
              if (!enabled) {
                setProfileStatus("Offline downloads turned off. Already cached items remain on this device.");
                return;
              }
              const [remoteHymns, remotePrayers, remoteParishes] = await Promise.all([
                fetchPublishedHymns(),
                fetchPublishedPrayers(),
                fetchVerifiedParishes(),
              ]);
              if (remoteHymns) setOfflineCache("library:hymns", remoteHymns);
              if (remotePrayers) setOfflineCache("library:prayers", remotePrayers);
              setOfflineCache("library:novenas", novenas);
              if (remoteParishes) setOfflineCache("parishes:verified", remoteParishes);
              setProfileStatus(`Offline downloads ready: ${remoteHymns?.length ?? 0} hymns, ${remotePrayers?.length ?? 0} prayers, ${novenas.length} novenas, ${remoteParishes?.length ?? 0} parishes cached.`);
            }}
            thumbColor="#ffffff"
            trackColor={{ false: colors.outline, true: colors.primary }}
            value={offlineDownloads}
          />
        </View>
        <View style={styles.preferenceRow}>
          <View style={styles.row}>
            <Ionicons color={colors.secondary} name="location-outline" size={23} />
            <Text style={styles.preferenceLabel}>Share Location for Parish Distance</Text>
          </View>
          <Switch
            onValueChange={async (enabled) => {
              if (!enabled) {
                setPrivacyLocation(false);
                await syncSetting("shareLocation", false);
                setProfileStatus("Location sharing turned off.");
                return;
              }
              const result = await requestCurrentLocation();
              setPrivacyLocation(result.ok);
              await syncSetting("shareLocation", result.ok);
              setProfileStatus(result.ok ? "Location sharing is on for parish distance." : result.message);
            }}
            thumbColor="#ffffff"
            trackColor={{ false: colors.outline, true: colors.primary }}
            value={privacyLocation}
          />
        </View>
        <View style={styles.preferenceRow}>
          <View style={styles.row}>
            <Ionicons color={colors.secondary} name="eye-outline" size={23} />
            <Text style={styles.preferenceLabel}>Show Activity on Profile</Text>
          </View>
          <Switch
            onValueChange={async (enabled) => {
              setPrivacyActivity(enabled);
              await syncSetting("showActivity", enabled);
              setProfileStatus(enabled ? "Profile activity can be shown." : "Profile activity is hidden.");
            }}
            thumbColor="#ffffff"
            trackColor={{ false: colors.outline, true: colors.primary }}
            value={privacyActivity}
          />
        </View>
        <View style={styles.preferenceRow}>
          <View style={styles.row}>
            <Ionicons color={colors.secondary} name="moon-outline" size={23} />
            <Text style={styles.preferenceLabel}>Theme (Light/Dark)</Text>
          </View>
          <Switch
            onValueChange={async (enabled) => {
              setDarkMode(enabled);
              await syncSetting("darkMode", enabled);
              setProfileStatus(enabled ? "Dark theme turned on." : "Light theme turned on.");
            }}
            thumbColor="#ffffff"
            trackColor={{ false: colors.outline, true: colors.primary }}
            value={darkMode}
          />
        </View>
      </View>
      {isAdmin ? <Pressable style={styles.adminCard} onPress={() => setShowAdmin(true)}>
        <Ionicons color="#ffd6fd" name="shield-half-outline" size={26} />
        <View style={styles.flex}>
          <Text style={styles.adminTitle}>Admin Portal</Text>
          <Text style={styles.adminText}>Parish Management & Analytics</Text>
        </View>
        <Ionicons color="#ffd6fd" name="open-outline" size={25} />
      </Pressable> : null}
      <Pressable style={styles.aboutCard} onPress={() => setShowAbout(true)}>
        <Ionicons color={colors.primary} name="information-circle-outline" size={25} />
        <View style={styles.flex}>
          <Text style={styles.aboutTitle}>About & Contact</Text>
          <Text style={styles.mutedText}>Support, WhatsApp and advert enquiries</Text>
        </View>
        <Ionicons color={colors.muted} name="chevron-forward" size={22} />
      </Pressable>
      <Pressable onPress={async () => {
        const result = await signOut();
        setIsAuthenticated(false);
        setIsAdmin(false);
        setProfileRole("Guest");
        setAuthPassword("");
        setProfileStatus(result.message);
      }}>
        <Text style={styles.signOut}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

function BottomTabs({ activeTab, onChange }: { activeTab: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <View style={styles.bottomTabs}>
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={[styles.tabButton, active && styles.activeTab]}>
            <Ionicons color={active ? colors.secondary : colors.muted} name={tab.icon} size={23} />
            <Text style={[styles.tabText, active && styles.activeTabText]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function QuickCard({
  icon,
  title,
  subtitle,
  color,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.quickCard} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${title}`}>
      <View style={[styles.quickIcon, { backgroundColor: color }]}>
        <MaterialCommunityIcons color={colors.primary} name={icon} size={23} />
      </View>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.mutedText}>{subtitle}</Text>
    </Pressable>
  );
}

function ResourceTile({ title, subtitle, onPress }: { title: string; subtitle: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.resourceTile} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${title}`}>
      <View style={styles.tileIcon}>
        <Ionicons color={colors.primary} name={title === "Bible" ? "book-outline" : "sparkles-outline"} size={24} />
      </View>
      <Text style={styles.resourceTitle}>{title}</Text>
      <Text style={styles.mutedText}>{subtitle}</Text>
    </Pressable>
  );
}

function HymnTextLine({ line }: { line: string }) {
  const isMarker = /^(\d+\.\s|chorus:?|refrain:?|antiphon:?)/i.test(line);

  return (
    <Text style={[styles.hymnLyricLine, isMarker && styles.hymnLyricMarker]}>
      {line}
    </Text>
  );
}

function SearchBox({
  placeholder,
  value,
  onChangeText,
}: {
  placeholder: string;
  value?: string;
  onChangeText?: (value: string) => void;
}) {
  return (
    <View style={styles.searchBox}>
      <Ionicons color={colors.muted} name="search-outline" size={25} />
      <TextInput
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#77717d"
        style={styles.searchInput}
        value={value}
      />
    </View>
  );
}

function Preference({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.row}>
        <Ionicons color={colors.secondary} name={icon} size={23} />
        <Text style={styles.preferenceLabel}>{label}</Text>
      </View>
      <Ionicons color={colors.muted} name="chevron-forward" size={22} />
    </View>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.sectionCard}>{children}</View>;
}

class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode; resetKey: string | null },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidUpdate(previousProps: { resetKey: string | null }) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: "" });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.noticeBox}>
          <Text style={styles.postTitle}>Admin module could not render</Text>
          <Text style={styles.postBody}>{this.state.message || "A record in this module has an unsupported shape."}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function SubmitButton({
  icon,
  label,
  successLabel = "Saved",
  state,
  variant = "primary",
  onPress,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  successLabel?: string;
  state: SubmitState;
  variant?: "primary" | "secondary";
  onPress: () => void | Promise<void>;
}) {
  const saving = state === "saving";
  const success = state === "success";
  const buttonStyle = variant === "primary" ? styles.primaryButtonWide : styles.secondaryButton;
  const textStyle = variant === "primary" ? styles.primaryButtonText : styles.secondaryButtonText;
  const iconColor = variant === "primary" ? "#ffffff" : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: saving, disabled: saving }}
      disabled={saving}
      onPress={onPress}
      style={[buttonStyle, saving && styles.submitButtonBusy, success && styles.submitButtonSuccess]}
    >
      {saving ? (
        <ActivityIndicator color={iconColor} size="small" />
      ) : (
        <Ionicons color={success ? "#ffffff" : iconColor} name={success ? "checkmark-circle-outline" : icon ?? "save-outline"} size={18} />
      )}
      <Text style={[textStyle, success && styles.submitButtonSuccessText]}>
        {saving ? "Saving..." : success ? successLabel : label}
      </Text>
    </Pressable>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: any;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons color={colors.secondary} name={icon} size={22} />
      <View style={styles.flex}>
        <Text style={styles.overline}>{label}</Text>
        <Text style={styles.infoValue}>{safeDisplayText(value)}</Text>
      </View>
    </View>
  );
}

function AdminRecordCard({
  moduleName,
  record,
  busy,
  onAction,
}: {
  moduleName: AdminModuleName;
  record: Record<string, any>;
  busy: boolean;
  onAction: (action: string) => Promise<void>;
}) {
  const actions = adminActionsForRecord(moduleName, record);
  return (
    <View style={styles.postCard}>
      <View style={styles.postMeta}>
        <Text style={styles.verifiedBadge}>{adminRecordSubtitle(record) || moduleName}</Text>
        <Text style={styles.mutedText}>{safeAdminDate(record.created_at || record.updated_at)}</Text>
      </View>
      <Text style={styles.postTitle}>{adminRecordTitle(moduleName, record)}</Text>
      <Text style={styles.postBody}>{adminRecordBody(record).slice(0, 450)}</Text>
      {record.sponsor ? <InfoRow icon="person-outline" label="Sponsor" value={record.sponsor} /> : null}
      {record.placement ? <InfoRow icon="phone-portrait-outline" label="Placement" value={record.placement} /> : null}
      {record.target_url ? <InfoRow icon="link-outline" label="Target URL" value={record.target_url} /> : null}
      {record.document_file_name ? <InfoRow icon="document-attach-outline" label="Baptismal card file" value={record.document_file_name} /> : null}
      {record.document_url ? (
        <Pressable style={styles.secondaryButton} onPress={() => Linking.openURL(String(record.document_url))}>
          <Ionicons color={colors.primary} name="open-outline" size={18} />
          <Text style={styles.secondaryButtonText}>Open Baptismal Card</Text>
        </Pressable>
      ) : null}
      {record.proposed_phone ? <InfoRow icon="call-outline" label="Proposed phone" value={safeAdminText(record.proposed_phone)} /> : null}
      {safeAdminJson(record.proposed_mass_times) ? <InfoRow icon="time-outline" label="Proposed Mass" value={safeAdminJson(record.proposed_mass_times)} /> : null}
      {safeAdminJson(record.proposed_confession_times) ? <InfoRow icon="chatbubble-outline" label="Proposed confession" value={safeAdminJson(record.proposed_confession_times)} /> : null}
      {actions.length ? (
        <View style={styles.adminActionRow}>
          {actions.map((item) => (
            <Pressable
              key={item.action}
              disabled={busy}
              onPress={() => onAction(item.action)}
              style={[styles.adminActionButton, item.danger && styles.adminActionDanger, busy && styles.submitButtonBusy]}
            >
              {busy ? <ActivityIndicator color={item.danger ? colors.danger : colors.primary} size="small" /> : <Ionicons color={item.danger ? colors.danger : colors.primary} name={item.icon} size={16} />}
              <Text style={[styles.adminActionText, item.danger && styles.adminActionDangerText]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function AdminMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.adminMetric}>
      <Ionicons color={colors.secondary} name={icon} size={22} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.mutedText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === "android" ? Math.max(NativeStatusBar.currentHeight ?? 0, 24) : 0,
  },
  safeAreaDark: { backgroundColor: colors.primary },
  app: { flex: 1, backgroundColor: colors.background },
  appDark: { backgroundColor: colors.primary },
  header: {
    alignItems: "center",
    backgroundColor: colors.background,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  headerDark: { backgroundColor: colors.primary },
  headerIdentity: { alignItems: "center", flexDirection: "row", gap: 8 },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.outline,
    borderRadius: 17,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  avatarText: { color: colors.primary, fontSize: 16, fontWeight: "700" },
  brandLogo: { borderRadius: 7, height: 32, resizeMode: "contain", width: 32 },
  logo: { color: colors.primary, fontFamily: "serif", fontSize: 23, fontWeight: "700" },
  logoDark: { color: "#ffffff" },
  iconButton: { alignItems: "center", height: 34, justifyContent: "center", width: 34 },
  screen: { paddingBottom: 152, paddingHorizontal: 14, paddingTop: 0 },
  stackLarge: { gap: 14 },
  bottomAdContainer: { backgroundColor: colors.background, paddingHorizontal: 14, paddingTop: 6 },
  adBar: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  adText: { color: "#ffffff", fontSize: 10, fontWeight: "700", letterSpacing: 1, textAlign: "center", textTransform: "uppercase" },
  adSubText: { color: "#fff6e6", fontSize: 12, lineHeight: 16, textAlign: "center" },
  metaRow: { alignItems: "center", flexDirection: "row", gap: 7, marginBottom: 4 },
  greenDot: { backgroundColor: colors.green, borderRadius: 5, height: 10, width: 10 },
  overline: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase" },
  pageTitle: { color: colors.text, fontFamily: "serif", fontSize: 25, fontWeight: "700", lineHeight: 30 },
  secondaryText: { color: colors.secondary, fontSize: 14, lineHeight: 20 },
  controlRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  datePickerRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  dateInput: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  dateButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateButtonActive: { backgroundColor: colors.secondaryContainer },
  dateButtonText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  calendarPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  calendarHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  calendarHeaderTitle: { alignItems: "center", flex: 1 },
  calendarMonthTitle: { color: colors.primary, fontSize: 18, fontWeight: "800" },
  calendarNavButton: { alignItems: "center", backgroundColor: colors.surfaceLow, borderColor: colors.outline, borderRadius: 10, borderWidth: 1, height: 36, justifyContent: "center", width: 36 },
  weekdayRow: { flexDirection: "row" },
  weekdayText: { color: colors.muted, flex: 1, fontSize: 11, fontWeight: "800", textAlign: "center", textTransform: "uppercase" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 0 },
  calendarDay: {
    alignItems: "center",
    aspectRatio: 1,
    borderRadius: 8,
    justifyContent: "center",
    width: `${100 / 7}%`,
  },
  calendarDayEmpty: { opacity: 0 },
  calendarDayActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  calendarDayToday: { backgroundColor: colors.secondaryContainer },
  calendarDayText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  calendarDayTextActive: { color: "#ffffff" },
  calendarDayTextEmpty: { color: "transparent" },
  quickGrid: { flexDirection: "row", gap: 12 },
  quickCard: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  quickIcon: { alignItems: "center", borderRadius: 18, height: 36, justifyContent: "center", marginBottom: 10, width: 36 },
  quickTitle: { color: colors.text, fontSize: 19, fontWeight: "600", lineHeight: 24 },
  mutedText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardHeader: {
    alignItems: "center",
    backgroundColor: colors.surfaceLow,
    borderBottomColor: colors.outline,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
  },
  row: { alignItems: "center", flexDirection: "row", gap: 8 },
  cardTitle: { color: colors.primary, fontSize: 22, fontWeight: "700" },
  linkText: { color: colors.secondary, fontSize: 12, fontWeight: "600" },
  cardBody: { gap: 18, padding: 16 },
  collectBox: { backgroundColor: colors.surfaceLow, borderLeftColor: colors.primary, borderLeftWidth: 4, borderRadius: 8, padding: 16 },
  readingBlock: { gap: 8 },
  overlinePurple: { color: colors.secondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  collectText: { color: colors.text, fontFamily: "serif", fontSize: 18, fontStyle: "italic", lineHeight: 30 },
  readingText: { color: colors.text, fontFamily: "serif", fontSize: 18, lineHeight: 29 },
  readingConclusion: { color: colors.primary, fontFamily: "serif", fontSize: 18, fontStyle: "italic", fontWeight: "700", lineHeight: 29, marginTop: 6 },
  readingTextLarge: { fontSize: 21, lineHeight: 34 },
  psalmResponse: { color: colors.primary, fontFamily: "serif", fontSize: 18, fontStyle: "italic", lineHeight: 28, textAlign: "center" },
  primaryButton: {
    alignSelf: "center",
    backgroundColor: colors.primary,
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  primaryButtonWide: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 16, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 14 },
  primaryButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.primary,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 11,
  },
  secondaryButtonText: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  submitButtonBusy: { opacity: 0.78 },
  submitButtonSuccess: { backgroundColor: colors.success, borderColor: colors.success },
  submitButtonSuccessText: { color: "#ffffff" },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButtonText: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  spotlight: { borderRadius: 12, height: 170, justifyContent: "flex-end", overflow: "hidden" },
  spotlightImage: { borderRadius: 12 },
  spotlightOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(48,2,28,0.45)" },
  spotlightContent: { padding: 16 },
  spotlightLabel: { color: "#ffd6fd", fontSize: 12, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase" },
  spotlightTitle: { color: "#ffffff", fontFamily: "serif", fontSize: 24, fontWeight: "700" },
  spotlightBody: { color: "#ffffff", fontSize: 15 },
  searchBox: {
    alignItems: "center",
    borderColor: colors.outline,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  searchInput: { color: colors.text, flex: 1, fontSize: 20 },
  searchInputBox: {
    backgroundColor: colors.surfaceLow,
    borderColor: colors.outline,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    padding: 14,
  },
  hero: { borderRadius: 12, height: 180, justifyContent: "flex-end", overflow: "hidden" },
  heroImage: { borderRadius: 12 },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(48,2,28,0.52)" },
  heroContent: { padding: 22 },
  heroTitle: { color: "#ffffff", fontSize: 36, fontWeight: "800" },
  heroKicker: { color: "#ffffff", fontSize: 16, fontWeight: "700", letterSpacing: 2.4, textTransform: "uppercase" },
  resourceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  resourceTile: {
    backgroundColor: colors.surface,
    borderColor: "#eee3da",
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    width: "48%",
  },
  tileIcon: { alignItems: "center", backgroundColor: colors.surfaceContainer, borderRadius: 10, height: 44, justifyContent: "center", marginBottom: 28, width: 44 },
  resourceTitle: { color: colors.text, fontSize: 28, fontWeight: "700", marginBottom: 2 },
  smallBadge: { backgroundColor: colors.secondaryContainer, borderRadius: 12, color: colors.secondary, fontSize: 12, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 5 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  filterChip: { backgroundColor: "#fae5fa", borderRadius: 14, color: colors.secondary, fontSize: 12, fontWeight: "800", paddingHorizontal: 12, paddingVertical: 7 },
  moreResults: { borderTopColor: "#f0e6dd", borderTopWidth: 1, padding: 16 },
  hymnRow: { alignItems: "center", borderTopColor: "#f0e6dd", borderTopWidth: 1, flexDirection: "row", gap: 12, padding: 16 },
  hymnNumber: { color: colors.secondary, fontSize: 15, fontWeight: "800" },
  hymnTitle: { color: colors.text, fontFamily: "serif", fontSize: 20, fontWeight: "700" },
  firstLine: { color: colors.primary, fontFamily: "serif", fontSize: 22, fontStyle: "italic", lineHeight: 32 },
  hymnLyricLine: { color: colors.text, fontFamily: "serif", fontSize: 18, lineHeight: 30 },
  hymnLyricMarker: { color: colors.primary, fontWeight: "700", marginTop: 8 },
  noticeBox: { backgroundColor: colors.surfaceLow, borderColor: colors.outline, borderRadius: 10, borderWidth: 1, padding: 14 },
  rosaryMysteryCard: { backgroundColor: colors.surfaceLow, borderColor: colors.outline, borderRadius: 10, borderWidth: 1, gap: 6, padding: 14 },
  flex: { flex: 1 },
  missionCard: { backgroundColor: colors.primary, borderRadius: 12, padding: 22 },
  missionTitle: { color: "#ffffff", fontSize: 28, fontWeight: "800" },
  missionText: { color: "#f1cce1", fontSize: 18, lineHeight: 28, marginTop: 6 },
  segmented: { flexDirection: "row", gap: 10 },
  segmentActive: { backgroundColor: colors.primary, borderRadius: 14, color: "#ffffff", fontSize: 13, fontWeight: "800", paddingHorizontal: 18, paddingVertical: 10 },
  segment: { borderColor: colors.outline, borderRadius: 14, borderWidth: 1, color: colors.primary, fontSize: 13, fontWeight: "600", paddingHorizontal: 18, paddingVertical: 10 },
  postCard: {
    backgroundColor: colors.surface,
    borderColor: "#eee3da",
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  featuredPost: { backgroundColor: "#f3ede4", borderLeftColor: colors.primary, borderLeftWidth: 4 },
  postMeta: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  postAuthor: { color: colors.secondary, fontSize: 13, fontWeight: "800" },
  usernameLink: { color: colors.primary, fontSize: 13, fontWeight: "800", lineHeight: 20 },
  usernameLinkDisabled: { color: colors.muted },
  verifiedBadge: { backgroundColor: "#fae5fa", borderRadius: 14, color: colors.secondary, fontSize: 11, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 5 },
  postTitle: { color: colors.text, fontSize: 22, fontWeight: "600", lineHeight: 29 },
  postBody: { color: colors.text, fontSize: 16, lineHeight: 25 },
  postFooter: { borderTopColor: "#f0e6dd", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingTop: 12 },
  reactionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reactionChip: { backgroundColor: colors.surfaceLow, borderColor: colors.outline, borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  reactionText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  composerInput: {
    backgroundColor: colors.surfaceLow,
    borderColor: colors.outline,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 130,
    padding: 14,
    textAlignVertical: "top",
  },
  floatingAction: { alignItems: "center", alignSelf: "flex-end", backgroundColor: colors.primary, borderRadius: 10, height: 54, justifyContent: "center", width: 54 },
  titleRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 12 },
  mapButton: { alignItems: "center", backgroundColor: colors.secondaryContainer, borderRadius: 24, flexDirection: "row", gap: 8, paddingHorizontal: 18, paddingVertical: 13 },
  mapButtonText: { color: colors.secondary, fontSize: 16, fontWeight: "700" },
  mapPanel: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.outline,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  mapPinRow: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 10, flexDirection: "row", gap: 12, padding: 12 },
  mapPin: { backgroundColor: colors.primary, borderColor: colors.tertiaryFixed, borderRadius: 10, borderWidth: 3, height: 20, width: 20 },
  parishCard: { backgroundColor: colors.surface, borderColor: colors.outline, borderRadius: 14, borderWidth: 1, gap: 10, padding: 20 },
  parishTitle: { color: colors.primary, flex: 1, fontSize: 27, fontWeight: "600", lineHeight: 34 },
  parishDiocese: { color: colors.muted, fontSize: 17, fontWeight: "600" },
  distance: { backgroundColor: colors.tertiaryFixed, borderRadius: 10, color: colors.text, fontSize: 16, fontWeight: "700", paddingHorizontal: 12, paddingVertical: 8 },
  massTime: { color: colors.muted, fontSize: 20 },
  infoRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  infoValue: { color: colors.text, fontSize: 17, lineHeight: 25 },
  centered: { alignItems: "center" },
  authToggle: { backgroundColor: colors.surfaceLow, borderColor: colors.outline, borderRadius: 12, borderWidth: 1, flexDirection: "row", padding: 4 },
  authToggleButton: { alignItems: "center", borderRadius: 8, flex: 1, paddingVertical: 10 },
  authToggleButtonActive: { backgroundColor: colors.primary },
  authToggleText: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  authToggleTextActive: { color: "#ffffff" },
  identityHeader: { alignItems: "center", flexDirection: "row", gap: 14, padding: 16 },
  goldIcon: { alignItems: "center", backgroundColor: colors.tertiaryFixed, borderRadius: 10, height: 48, justifyContent: "center", width: 48 },
  progressTrack: { backgroundColor: colors.surfaceContainer, borderRadius: 5, height: 8, width: 82 },
  progressFill: { backgroundColor: colors.gold, borderRadius: 5, height: 8, width: 58 },
  uploadBox: { borderColor: colors.outline, borderRadius: 12, borderStyle: "dashed", borderWidth: 1, gap: 16, margin: 16, marginTop: 0, padding: 18 },
  verificationPreview: { borderRadius: 10, height: 190, resizeMode: "cover", width: "100%" },
  profileInfo: { alignItems: "center", backgroundColor: colors.surfaceContainer, borderRadius: 12, flexDirection: "row", gap: 16, padding: 18 },
  preferenceCard: { backgroundColor: colors.surface, borderColor: colors.outline, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16 },
  preferenceRow: { alignItems: "center", borderBottomColor: "#eadce1", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: 17 },
  preferenceLabel: { color: colors.text, fontSize: 17 },
  adminCard: { alignItems: "center", backgroundColor: "#884b8f", borderRadius: 12, flexDirection: "row", gap: 14, padding: 20 },
  adminTitle: { color: "#ffd6fd", fontSize: 24, fontWeight: "800" },
  adminText: { color: "#f0c1ef", fontSize: 15 },
  aboutCard: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.outline, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 14, padding: 18 },
  aboutTitle: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  adminGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  adminMetric: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: 12,
    borderWidth: 1,
    gap: 7,
    padding: 16,
    width: "48%",
  },
  metricValue: { color: colors.primary, fontSize: 30, fontWeight: "800" },
  adminActionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  adminActionButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceLow,
    borderColor: colors.outline,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  adminActionDanger: { backgroundColor: "#fff1f1", borderColor: "#f1b8b8" },
  adminActionText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  adminActionDangerText: { color: colors.danger },
  signOut: { color: colors.danger, fontSize: 18, textAlign: "center" },
  bottomTabs: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.outline,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    left: 0,
    paddingBottom: 12,
    paddingHorizontal: 8,
    paddingTop: 10,
    position: "absolute",
    right: 0,
  },
  tabButton: { alignItems: "center", borderRadius: 28, gap: 4, minWidth: 66, paddingHorizontal: 12, paddingVertical: 8 },
  activeTab: { backgroundColor: "#f8adfb" },
  tabText: { color: colors.text, fontSize: 12 },
  activeTabText: { color: colors.secondary },
});
