# Supabase Setup

Supabase project linked: `CatApp`

- Project ref: `nntlgxqwngsewmpkajls`
- URL: `https://nntlgxqwngsewmpkajls.supabase.co`
- Region: `eu-west-1`

## Database Status

The remote database now has tables for:

- `profiles`
- `parishes`
- `hymns`
- `daily_readings`
- `liturgical_reading_entries`
- `liturgical_date_mappings`
- `community_posts`
- `community_comments`
- `community_reports`
- `user_saved_items`
- `recent_items`
- `hymn_correction_requests`
- `reading_approval_requests`
- `notification_preferences`
- `advertisements`
- `admin_audit_logs`

RLS is enabled on all public tables.

Seeded rows:

- 441 verified parishes
- 36 approved complete dated daily-reading payloads from fixed-date Word document entries and the July 12, 2026 mapping
- 496 published hymns extracted from `assets/source/Daily mass readings, hymns and prayers.docx`
- 768 clean liturgical reading entries extracted from `assets/source/Daily mass readings, hymns and prayers.docx`
- 365 Nigeria Ordo 2026 liturgical date mappings from `assets/source/Nigeria_Ordo_2026.docx`
- 152 published prayers
- 1 active advertisement placement

The 2026 Ordo mapping is stored in `assets/data/nigeria-ordo-2026.json`. It maps every Nigerian date in 2026 to an approved `liturgical_reading_entries` record. A small number of dates are tagged `approved-content-fallback` because the current approved reading-entry source does not yet contain an exact title for that date; those rows use the closest approved temporal reading until exact licensed text is added.

## Add Keys

Create a file named `.env.local` in the project root by copying `.env.local.example`.

Fill in:

```env
EXPO_PUBLIC_SUPABASE_URL=https://nntlgxqwngsewmpkajls.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
SUPABASE_PROJECT_REF=nntlgxqwngsewmpkajls
SUPABASE_ACCESS_TOKEN=your-supabase-cli-access-token
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CATAPP_IMPORT_SECRET=create-a-long-random-secret
READINGS_PROVIDER_NAME=licensed-nigerian-provider
READINGS_PROVIDER_URL=https://licensed-provider.example/daily-readings
```

Important:

- `EXPO_PUBLIC_SUPABASE_ANON_KEY` is safe for the mobile app.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Use it only for local import scripts. Do not put it in mobile code.
- `READINGS_PROVIDER_URL` must point to the licensed daily readings provider/import API.

## Import Hymns

After adding `.env.local`, double-click:

```text
scripts/import-hymns.bat
```

That imports all extracted hymn records from the Word document dataset:

```text
assets/data/hymns.json
```

into the Supabase `hymns` table.

## Import Nigeria Ordo 2026 Date Mappings

After the 768 `liturgical_reading_entries` rows are imported, run:

```text
node scripts/import-nigeria-ordo-2026-mappings-to-supabase.js
```

That refreshes the Lagos/Nigeria 2026 rows in `liturgical_date_mappings` so the `daily-readings` endpoint can resolve every 2026 date before the app falls back to local offline data.

## Import Bulk Liturgical Reading Entries

The Word document can be extracted into structured readings and hymns with:

```text
python scripts/extract-docx-bulk-content.py "assets/source/Daily mass readings, hymns and prayers.docx"
```

Then import the clean liturgical entries and date mappings with:

```text
node scripts/import-liturgical-reading-entries-to-supabase.js
node scripts/import-liturgical-date-mappings-to-supabase.js
node scripts/import-dated-readings-to-supabase.js
```

The dated importer materializes every fixed-date reading available in the Word document for 2026-2030. The remaining Word-document entries stay in `liturgical_reading_entries` and are resolved through calendar mappings as the Nigeria/diocesan calendar is completed.

## Import Daily Readings

After adding `.env.local`, double-click:

```text
scripts/import-daily-readings.bat
```

Enter the date in `YYYY-MM-DD` format. The script fetches:

```text
READINGS_PROVIDER_URL?date=<date>&territory=NG&diocese=lagos
```

Then it validates the complete Mass payload and upserts it into `daily_readings`.

## Edge Functions

The app-facing production endpoint lives in:

```text
supabase/functions/daily-readings
```

The protected provider-import endpoint lives in:

```text
supabase/functions/import-daily-readings
```

Deploy them by double-clicking:

```text
scripts/deploy-supabase-functions.bat
```

Or deploy them with the Supabase CLI:

```text
supabase functions deploy daily-readings
supabase functions deploy import-daily-readings
```

## Android Build

For a local Android export, Codex already verifies with:

```text
expo export --platform android --output-dir dist
```

For an APK test build, use Expo EAS:

```text
eas build --platform android --profile preview
```

For a Play Store app bundle:

```text
eas build --platform android --profile production
eas submit --platform android --profile production
```

You can run these from the Expo website/desktop workflow if you do not want to type commands. The project now has `eas.json` with preview APK and production AAB profiles.

## Native App Foundations

The app now includes Expo-native modules for:

- Persistent offline storage: `@react-native-async-storage/async-storage`
- Daily prayer reminders: `expo-notifications`
- Parish distance/location permission: `expo-location`

Android permissions are declared in `app.json` for location and notifications. The app can now cache readings/library state on device, schedule a daily 6:30 AM prayer reminder, and request foreground location for parish distance calculations.

## Enable Shared Community Reactions

The app can save reactions locally immediately. To make reactions shared across all users, open Supabase on your browser:

1. Go to your CatApp Supabase project.
2. Open **SQL Editor**.
3. Open this project file:

```text
scripts/community-reactions-schema.sql
```

4. Paste the whole SQL into Supabase SQL Editor.
5. Click **Run**.

After that, `Amen`, `Praying`, `Thanks`, and `Insightful` reactions can be read and updated through Supabase.
