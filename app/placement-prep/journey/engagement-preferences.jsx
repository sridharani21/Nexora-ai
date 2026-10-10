"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Loader2, Save, Smartphone } from "lucide-react";
import { removeWebPushSubscription, saveJourneyPreferences, saveWebPushSubscription } from "@/actions/placement-modules";

export default function EngagementPreferences({ preferences, vapidPublicKey }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(preferences.inAppReminders);
  const [frequency, setFrequency] = useState(preferences.reminderFrequency);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function save(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    try {
      await saveJourneyPreferences({ inAppReminders: enabled, reminderFrequency: frequency });
      setMessage("In-app reminder preferences saved.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save reminder preferences.");
    } finally {
      setPending(false);
    }
  }

  return <section className="section">
    <article className="card engagement-preferences">
      <div className="section-heading"><div><h2>Reminder preferences</h2><p>Control how upcoming actions are shown in this Nexora journey dashboard.</p></div><Bell className="icon" size={21} /></div>
      <form className="engagement-preferences-form" onSubmit={save}>
        <label className="interview-check-option"><input checked={enabled} onChange={(event) => setEnabled(event.target.checked)} type="checkbox" /> Show in-app reminders and preparation actions.</label>
        <label className="plan-time-label" htmlFor="journey-reminder-frequency">Reminder horizon
          <select disabled={!enabled} id="journey-reminder-frequency" onChange={(event) => setFrequency(event.target.value)} value={frequency}>
            <option value="DAILY">Daily · due today or overdue</option>
            <option value="WEEKLY">Weekly · due within seven days or overdue</option>
            <option value="NEVER">Never · hide reminders</option>
          </select>
        </label>
        <p className="helper">These preferences control in-app reminders and optional browser push. Open learning tasks without due dates remain visible. Nexora does not send email or SMS notifications.</p>
        {error && <p className="error-message" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
        <button className="button button-primary" disabled={pending} type="submit">{pending ? <Loader2 className="spin" size={15} /> : <Save size={15} />} Save preferences</button>
      </form>
      <PushNotifications vapidPublicKey={vapidPublicKey} />
    </article>
  </section>;
}

function decodeVapidKey(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

function PushNotifications({ vapidPublicKey }) {
  const [subscription, setSubscription] = useState(null);
  const [state, setState] = useState("loading");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    if (!vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return () => { active = false; };
    }
    navigator.serviceWorker.register("/sw.js")
      .then((registration) => registration.pushManager.getSubscription())
      .then((current) => {
        if (active) {
          setSubscription(current);
          setState("ready");
        }
      })
      .catch((registrationError) => {
        if (active) {
          setError(registrationError instanceof Error ? registrationError.message : "Unable to register browser notifications.");
          setState("error");
        }
      });
    return () => { active = false; };
  }, [vapidPublicKey]);

  async function subscribe() {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Allow notifications in your browser settings to enable placement reminders.");
      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      const next = current || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidKey(vapidPublicKey) });
      await saveWebPushSubscription(next.toJSON());
      setSubscription(next);
      setMessage("Browser push reminders are enabled for this device.");
    } catch (subscribeError) {
      setError(subscribeError instanceof Error ? subscribeError.message : "Unable to enable browser push reminders.");
    } finally {
      setPending(false);
    }
  }

  async function unsubscribe() {
    if (!subscription) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await removeWebPushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
      setSubscription(null);
      setMessage("Browser push reminders are disabled for this device.");
    } catch (unsubscribeError) {
      setError(unsubscribeError instanceof Error ? unsubscribeError.message : "Unable to disable browser push reminders.");
    } finally {
      setPending(false);
    }
  }

  return <div className="push-notification-settings">
    <div className="section-heading"><div><h3>Browser push</h3><p>Optional reminders for this device. Nexora sends generic messages, not your job or assessment details.</p></div><Smartphone className="icon" size={20} /></div>
    {state === "unsupported" && <p className="helper">Browser push is unavailable or not configured on this device. Use in-app reminders or configure Web Push and a supported browser.</p>}
    {state === "loading" && <p className="helper">Checking browser notification support…</p>}
    {state === "error" && <p className="helper">The notification service worker could not be registered.</p>}
    {state === "ready" && <button className="button button-secondary" disabled={pending} onClick={subscription ? unsubscribe : subscribe} type="button">{pending ? <Loader2 className="spin" size={15} /> : <Bell size={15} />}{subscription ? "Disable browser push on this device" : "Enable browser push on this device"}</button>}
    <p className="helper">Your browser will ask permission only after you choose Enable. Turn off in-app reminders above to pause scheduled push delivery.</p>
    {error && <p className="error-message" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
  </div>;
}
