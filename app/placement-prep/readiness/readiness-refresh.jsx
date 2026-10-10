"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

export default function ReadinessRefresh({ action, label }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function refresh() {
    setLoading(true);
    setError("");
    try { await action(); window.location.reload(); } catch (error) { setError(error instanceof Error ? error.message : "Unable to generate readiness analysis."); } finally { setLoading(false); }
  }
  return <><button className="button button-primary" onClick={refresh} disabled={loading}>{loading ? <Loader2 size={16} /> : <RefreshCw size={16} />} {label}</button>{error && <p className="error-message">{error}</p>}</>;
}
