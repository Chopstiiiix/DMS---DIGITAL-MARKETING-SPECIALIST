"use client";

import { useActionState } from "react";
import { createLink, type CreateLinkState } from "./actions";

const initial: CreateLinkState = { error: null, createdSlug: null };

interface Props {
  channels: readonly string[];
  campaigns: { id: string; name: string }[];
  defaultDestination: string;
  allowedHosts: string[];
  linkBase: string;
}

export function NewLinkForm({ channels, campaigns, defaultDestination, allowedHosts, linkBase }: Props) {
  const [state, action, pending] = useActionState(createLink, initial);

  return (
    <form action={action} className="card grid gap-4 p-4 sm:grid-cols-2">
      <label className="field sm:col-span-2">
        <span>Label</span>
        <input
          name="label"
          required
          maxLength={160}
          placeholder="Instagram bio link, October"
          className="input"
        />
      </label>

      <label className="field sm:col-span-2">
        <span>Destination</span>
        <input
          name="destination"
          type="url"
          required
          defaultValue={defaultDestination}
          className="input font-mono"
        />
        <span className="text-xs font-normal text-muted">
          Allowed: {allowedHosts.length ? allowedHosts.join(", ") : "none set for this brand"}
        </span>
      </label>

      <label className="field">
        <span>Channel</span>
        <select name="channel" required defaultValue="" className="input">
          <option value="" disabled>
            Where will this be shared?
          </option>
          {channels.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>
          Content pillar <span className="font-normal text-muted">(optional)</span>
        </span>
        <input name="pillar" maxLength={60} placeholder="money math" className="input" />
      </label>

      <label className="field">
        <span>
          Campaign <span className="font-normal text-muted">(optional)</span>
        </span>
        <select name="campaignId" defaultValue="" className="input">
          <option value="">No campaign</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>
          Or start a new campaign <span className="font-normal text-muted">(optional)</span>
        </span>
        <input name="newCampaign" maxLength={120} placeholder="Kenya mentorship programme" className="input" />
      </label>

      <label className="field sm:col-span-2">
        <span>
          Short name <span className="font-normal text-muted">(optional, generated if empty)</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="shrink-0 font-mono text-xs font-normal text-muted">{linkBase}</span>
          <input name="slug" maxLength={40} placeholder="kenya" className="input font-mono" />
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Creating…" : "Create link"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        {state.createdSlug && (
          <p role="status" className="text-sm">
            Created{" "}
            <span className="font-mono">
              {linkBase}
              {state.createdSlug}
            </span>
          </p>
        )}
      </div>
    </form>
  );
}
