# Daily Readings API Sources

CatApp should not rely on a random public scraper for daily Mass readings. The app needs a licensed, auditable source that can return the complete Mass reading set for the Nigerian calendar: collect, first reading, responsorial psalm, optional second reading, Gospel acclamation, Gospel, source/copyright, lectionary number, liturgical rank and colour.

## Recommended Production Architecture

1. **Primary API: CatApp Supabase content API**
   - Store licensed readings and prayers in CatApp's own PostgreSQL tables.
   - Sync content from approved/licensed sources through admin import tools.
   - Return complete daily payloads from a Supabase Edge Function:

```http
GET /functions/v1/daily-readings?date=2026-07-12&territory=NG&diocese=lagos
```

2. **Canonical calendar layer: Nigerian liturgical calendar**
   - Nigeria must not inherit the U.S. calendar by default.
   - Store general Roman calendar records plus Nigerian proper calendar overrides, diocesan overrides, solemnities, feasts, memorials, liturgical colour and lectionary references.

3. **Licensed text provider layer**
   - Use the translation and Mass texts that the Catholic Bishops' Conference of Nigeria or approved publisher authorises for digital use.
   - Store source, owner, licence, approval state, version, effective dates and withdrawal status per content block.

## Candidate External Sources

### USCCB

USCCB has complete daily readings online, including Reading 1, Psalm, Reading 2 where applicable, Alleluia/acclamation and Gospel. However, the USCCB calendar page says its liturgical calendar is for the dioceses of the United States, and the daily readings page includes a permission notice for electronic/digital reproduction. Use only if CatApp obtains written permission and only for U.S. territory behavior.

### Universalis

Universalis publishes "Readings at Mass" and states that its apps/programs include Mass Today with readings and prayers, offline access, all dates, and more languages/options. Treat Universalis as a licensed commercial integration, not a free open API, unless a formal data/API agreement is obtained.

### AELF

AELF is a useful model for a structured liturgical readings service in French-speaking contexts, but it is not the correct default for English Nigeria. It may be useful only for future multilingual territories after licensing and calendar validation.

## CatApp Daily Reading Payload

```ts
type DailyReadingsResponse = {
  date: string;
  territory: "NG";
  diocese?: string;
  celebration: {
    title: string;
    rank: string;
    color: "green" | "white" | "red" | "violet" | "rose" | "black";
    lectionary: string;
  };
  sections: Array<{
    kind:
      | "collect"
      | "reading1"
      | "psalm"
      | "reading2"
      | "acclamation"
      | "gospel";
    title: string;
    citation?: string;
    response?: string;
    text: string;
    optional?: boolean;
    source: string;
    copyright: string;
  }>;
  sourceSummary: string;
  licenseStatus: "approved" | "pending" | "withdrawn";
  generatedAt: string;
};
```

## Implementation Note

The mobile app should call CatApp's Supabase Edge Function, cache at least seven days offline, and never expose provider keys or raw third-party endpoints directly from the client.

## Implemented CatApp Endpoints

The project now includes local Supabase Edge Functions:

```text
supabase/functions/daily-readings
supabase/functions/import-daily-readings
```

Public app endpoint:

```http
GET https://nntlgxqwngsewmpkajls.supabase.co/functions/v1/daily-readings?date=2026-07-12&territory=NG&diocese=lagos
```

Protected import endpoint:

```http
POST https://nntlgxqwngsewmpkajls.supabase.co/functions/v1/import-daily-readings
Header: x-catapp-import-secret: <CATAPP_IMPORT_SECRET>
Body: { "date": "2026-07-12", "territory": "NG", "diocese": "lagos" }
```

The import endpoint expects the configured licensed provider API to return the `DailyReadingsResponse` shape above. It validates that the payload includes the complete Mass structure before writing to Supabase.
