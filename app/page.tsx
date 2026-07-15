"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

const SUPABASE_URL = "https://nntlgxqwngsewmpkajls.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5udGxneHF3bmdzZXdtcGthamxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NTU5NTUsImV4cCI6MjA5OTQzMTk1NX0.2_lmzcU58bfP3Od6xAiGgFvFTWuxHwgbYgesBFA8krI";
const METRIC_KEY = "catapp_android_apk";
const APK_PATH =
  "https://raw.githubusercontent.com/guyxander/CatApp/apk-hosting/public/download/CatApp-standalone-2026-07-15.apk";

type Metrics = {
  clicks: number;
  downloads: number;
};

const emptyMetrics: Metrics = {
  clicks: 0,
  downloads: 0,
};

async function callMetricRpc<T>(
  functionName: string,
  body: Record<string, string>,
): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Metrics request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function normalizeMetrics(payload: unknown): Metrics {
  const record = Array.isArray(payload) ? payload[0] : payload;

  if (!record || typeof record !== "object") {
    return emptyMetrics;
  }

  const clicks = Number((record as { clicks?: unknown }).clicks);
  const downloads = Number((record as { downloads?: unknown }).downloads);

  return {
    clicks: Number.isFinite(clicks) ? clicks : 0,
    downloads: Number.isFinite(downloads) ? downloads : 0,
  };
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

export default function Home() {
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copyStatus, setCopyStatus] = useState("Copy link");
  const [error, setError] = useState("");

  const downloadUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return APK_PATH;
    }

    return new URL(APK_PATH, window.location.origin).toString();
  }, []);

  useEffect(() => {
    let isMounted = true;

    callMetricRpc("get_app_download_metrics", { p_key: METRIC_KEY })
      .then((payload) => {
        if (isMounted) {
          setMetrics(normalizeMetrics(payload));
        }
      })
      .catch(() => {
        if (isMounted) {
          setError("Download stats are temporarily unavailable.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function recordEvent(eventName: "click" | "download") {
    const payload = await callMetricRpc("track_app_download_event", {
      p_key: METRIC_KEY,
      p_event: eventName,
    });

    setMetrics(normalizeMetrics(payload));
  }

  async function handleDownload() {
    setIsDownloading(true);
    setError("");

    try {
      await recordEvent("download");
    } catch {
      setError("The download will start, but the counter did not update.");
    } finally {
      setIsDownloading(false);
      window.location.href = APK_PATH;
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(downloadUrl);
      await recordEvent("click");
      setCopyStatus("Copied");
      window.setTimeout(() => setCopyStatus("Copy link"), 2200);
    } catch {
      setCopyStatus("Copy failed");
      window.setTimeout(() => setCopyStatus("Copy link"), 2200);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-section" aria-labelledby="download-title">
        <div className="hero-copy">
          <div className="brand-row">
            <Image
              src="/catapp-logo.png"
              alt="CatApp"
              width={64}
              height={64}
              priority
            />
            <div>
              <p className="eyebrow">Android APK</p>
              <h1 id="download-title">Download CatApp</h1>
            </div>
          </div>

          <p className="lead">
            Catholic prayers, parish tools, community posts, novenas, and daily
            spiritual resources in one Android app.
          </p>

          <div className="actions">
            <button
              className="primary-action"
              onClick={handleDownload}
              disabled={isDownloading}
              type="button"
            >
              {isDownloading ? "Preparing download..." : "Download APK"}
            </button>
            <button className="secondary-action" onClick={handleCopyLink} type="button">
              {copyStatus}
            </button>
          </div>

          <p className="install-note">
            If your phone asks for permission, allow installation from your
            browser or file manager, then open the APK again.
          </p>
        </div>

        <div className="stats-panel" aria-label="Download statistics">
          <div>
            <span className="stat-value">
              {isLoading ? "..." : formatCount(metrics.clicks)}
            </span>
            <span className="stat-label">Button clicks</span>
          </div>
          <div>
            <span className="stat-value">
              {isLoading ? "..." : formatCount(metrics.downloads)}
            </span>
            <span className="stat-label">Downloads</span>
          </div>
          {error ? <p className="status-message">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}
