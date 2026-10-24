<script>
  // @ts-nocheck
  import Fa from "svelte-fa";
  import Coin from "$lib/components/Coin.svelte";
  import {
    faCheck,
    faXmark,
    faUserShield,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import Avatar from "$lib/components/Avatar.svelte";
  import { formatDate } from "$lib/utils.js";
  import { ROLE_LABELS, canAssignTo } from "$lib/roles.js";
  import { enhance } from "$app/forms";

  /** Human date for the status line. */
  const fmtWhen = (iso) =>
    new Date(iso).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  /* <input type="datetime-local"> wants the local wall clock with no zone,
	   so the stored UTC instant is shifted before it is handed over. */
  const toLocalInput = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  export let data;
  export let form;

  let selected = new Set();
  let openRow = null;

  const toggle = (id) => {
    selected.has(id) ? selected.delete(id) : selected.add(id);
    selected = new Set(selected);
  };

  // Somebody who abandoned the form has nothing to approve: no university,
  // no field, no year. They are excluded from selection and bulk actions.
  $: pendingIds = data.members
    .filter((m) => m.status === "pending" && m.onboarded_at)
    .map((m) => m.id);
  const statusTone = { pending: "warn", approved: "ok", rejected: "bad" };
</script>

<svelte:head><title>Members | CODIHA Admin</title></svelte:head>

<div class="page-head">
  <h1>Members</h1>
  <p>
    {data.tally.all} accounts · {data.tally.pending ?? 0} awaiting approval ·
    {data.tally.approved ?? 0} approved · {data.tally.incomplete ?? 0} never finished
    signing up
  </p>
</div>

{#if form?.error}<div class="notice bad">{form.error}</div>{/if}
{#if form?.success}<div class="notice ok">{form.success}</div>{/if}

<section class="panel window-panel">
  <div class="wp-head">
    <div>
      <strong>Applications</strong>
      <p class="tiny muted">
        {#if data.applications.state === "always"}
          Open to anyone, with no closing date.
        {:else if data.applications.state === "open"}
          Open now.
          {#if data.applications.closesAt}Closing {fmtWhen(
              data.applications.closesAt
            )}.{/if}
        {:else if data.applications.state === "before"}
          Not open yet. Opens {fmtWhen(data.applications.opensAt)}.
        {:else}
          Closed since {fmtWhen(data.applications.closesAt)}.
        {/if}
      </p>
    </div>
    <span class="pill {data.applications.accepting ? 'ok' : 'bad'}">
      {data.applications.accepting ? "Accepting" : "Not accepting"}
    </span>
  </div>

  {#if data.canSetWindow}
    <form
      method="POST"
      action="?/applicationWindow"
      class="wp-form"
      use:enhance
    >
      <label class="field">
        <span>Opens</span>
        <input
          type="datetime-local"
          name="opens_at"
          value={toLocalInput(data.applications.opensAt)}
        />
      </label>
      <label class="field">
        <span>Closes</span>
        <input
          type="datetime-local"
          name="closes_at"
          value={toLocalInput(data.applications.closesAt)}
        />
      </label>
      <button class="btn sm" type="submit">Save window</button>
    </form>
    <p class="tiny muted">
      Leave both empty to accept applications indefinitely. Members who have
      already applied can still edit their own details after it closes.
    </p>
  {:else}
    <p class="tiny muted">Only an admin can change when applications run.</p>
  {/if}
</section>

<form class="toolbar" method="GET">
  <input
    type="search"
    name="q"
    value={data.filter.q}
    placeholder="Search name, email, university…"
  />
  <select name="status">
    {#each ["all", "incomplete", "pending", "approved", "rejected"] as s}
      <option value={s} selected={data.filter.status === s}>
        {s}
        {s !== "all" ? `(${data.tally[s] ?? 0})` : `(${data.tally.all})`}
      </option>
    {/each}
  </select>
  <button class="btn sm" type="submit">Filter</button>
  <a class="btn sm ghost" href="/admin/members">Reset</a>
</form>

{#if pendingIds.length}
  <form method="POST" action="?/bulkApprove" class="panel bulk">
    <div class="row">
      <button
        class="btn sm ghost"
        type="button"
        on:click={() =>
          (selected = new Set(
            selected.size === pendingIds.length ? [] : pendingIds
          ))}
      >
        {selected.size === pendingIds.length
          ? "Clear selection"
          : `Select all pending (${pendingIds.length})`}
      </button>
      <span class="tiny muted">{selected.size} selected</span>
    </div>
    {#each [...selected] as id}
      <input type="hidden" name="ids" value={id} />
    {/each}
    <button class="btn sm ok" type="submit" disabled={!selected.size}>
      <Fa icon={faCheck} /> Approve selected
    </button>
  </form>
{/if}

<div class="table-wrap">
  <table class="data">
    <thead>
      <tr>
        <th />
        <th>Member</th>
        <th>University</th>
        <th>Year</th>
        <th class="num">This year</th>
        <th>Status</th>
        <th>Joined</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each data.members as m (m.id)}
        <tr>
          <td>
            {#if m.status === "pending" && m.onboarded_at}
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                on:change={() => toggle(m.id)}
                aria-label="Select {m.full_name}"
              />
            {/if}
          </td>
          <td>
            <div class="who">
              <Avatar src={m.avatar_url} name={m.full_name} size={32} />
              <span class="who-col">
                <span class="name">
                  {m.full_name || "-"}
                  {#if m.role !== "member"}<span class="pill accent tiny"
                      >{ROLE_LABELS[m.role]}</span
                    >{/if}
                </span>
                <span class="sub">{m.email ?? "-"}</span>
              </span>
            </div>
          </td>
          <td class="tiny"
            >{m.university ?? "-"}<br /><span class="muted"
              >{m.field ?? ""}</span
            ></td
          >
          <td class="tiny">{m.year ?? "-"}</td>
          <td class="num"
            ><strong>{data.pointsBy[m.id]?.semester ?? 0}</strong></td
          >
          <td>
            {#if !m.onboarded_at}
              <span class="pill" title="Signed in but never completed the form">
                incomplete
              </span>
            {:else}
              <span class="pill {statusTone[m.status]}">{m.status}</span>
            {/if}
            {#if m.status === "approved" && m.role !== "superadmin"}
              <!-- Read-only. avatar_face_verified is set by the face check
                   on /photo and by nothing else, so there is no button. -->
              <span
                class="pill {m.avatar_face_verified ? 'ok' : 'warn'}"
                title={m.avatar_face_verified
                  ? "Passed the automatic face check."
                  : "Has not passed the face check yet. Only the member can fix this, by uploading a photo that passes."}
              >
                {m.avatar_face_verified ? "photo ok" : "no photo"}
              </span>
            {/if}
          </td>
          <td class="tiny muted">{formatDate(m.created_at)}</td>
          <td>
            <div class="row">
              {#if m.status !== "approved"}
                <form method="POST" action="?/approve">
                  <input type="hidden" name="id" value={m.id} />
                  <button class="btn sm ok" type="submit" title="Approve"
                    ><Fa icon={faCheck} /></button
                  >
                </form>
              {/if}
              <button
                class="btn sm ghost"
                type="button"
                on:click={() => (openRow = openRow === m.id ? null : m.id)}
              >
                ⋯
              </button>
            </div>
          </td>
        </tr>

        {#if openRow === m.id}
          <tr class="expand">
            <td colspan="8">
              <div class="panels">
                <form method="POST" action="?/points" class="inline-form">
                  <input type="hidden" name="id" value={m.id} />
                  <label class="field" style="flex:0 0 110px">
                    <span><Coin /> Coins</span>
                    <input
                      type="number"
                      name="amount"
                      placeholder="e.g. 20 or -10"
                      required
                    />
                  </label>
                  <label class="field">
                    <span>Reason (required)</span>
                    <input
                      name="reason"
                      placeholder="Ran the Git workshop"
                      required
                      minlength="3"
                    />
                  </label>
                  <button class="btn sm" type="submit">Add to ledger</button>
                </form>

                {#if m.status !== "rejected"}
                  <form method="POST" action="?/reject" class="inline-form">
                    <input type="hidden" name="id" value={m.id} />
                    <label class="field">
                      <span><Fa icon={faXmark} /> Reject reason (required)</span
                      >
                      <input
                        name="reason"
                        placeholder="Not a student at a partner university"
                        required
                      />
                    </label>
                    <button class="btn sm danger" type="submit"
                      >Reject member</button
                    >
                  </form>
                {/if}

                {#if data.assignable?.length && canAssignTo(data.actorRole, m.role) && m.id !== data.actorId}
                  <form method="POST" action="?/setRole" class="inline-form">
                    <input type="hidden" name="id" value={m.id} />
                    <label class="field" style="flex:0 0 180px">
                      <span><Fa icon={faUserShield} /> Role</span>
                      <select name="role">
                        <option value="member" selected={m.role === "member"}>
                          {ROLE_LABELS.member}
                        </option>
                        {#each data.assignable as r}
                          {#if r !== "member"}
                            <option value={r} selected={m.role === r}
                              >{ROLE_LABELS[r]}</option
                            >
                          {/if}
                        {/each}
                      </select>
                    </label>
                    <button class="btn sm ghost" type="submit">Save role</button
                    >
                  </form>
                {/if}

                {#if data.canSetWindow && m.id !== data.actorId && canAssignTo(data.actorRole, m.role)}
                  <div class="danger-zone">
                    {#if m.status === "approved"}
                      <form method="POST" action="?/kick" class="inline-form">
                        <input type="hidden" name="id" value={m.id} />
                        <div class="dz-copy">
                          <strong>End membership</strong>
                          <span class="tiny muted">
                            Marks them an alumnus. They lose access, but keep
                            their points, certificates and history.
                          </span>
                        </div>
                        <button class="btn sm ghost" type="submit">
                          Make alumnus
                        </button>
                      </form>
                    {:else if m.status === "alumni"}
                      <form
                        method="POST"
                        action="?/approve"
                        class="inline-form"
                      >
                        <input type="hidden" name="id" value={m.id} />
                        <div class="dz-copy">
                          <strong>Alumnus</strong>
                          <span class="tiny muted"
                            >Bring them back as an active member.</span
                          >
                        </div>
                        <button class="btn sm ok" type="submit"
                          >Reactivate</button
                        >
                      </form>
                    {/if}

                    <form
                      method="POST"
                      action="?/deleteMember"
                      class="inline-form"
                    >
                      <input type="hidden" name="id" value={m.id} />
                      <label class="field">
                        <span><Fa icon={faTrash} /> Delete permanently</span>
                        <input
                          name="confirm_name"
                          placeholder={`Type "${m.full_name}" to confirm`}
                          autocomplete="off"
                          required
                        />
                        <span class="hint">
                          Erases the account and everything attached to it:
                          points, registrations, applications and certificates.
                          Cannot be undone.
                        </span>
                      </label>
                      <button class="btn sm danger" type="submit">Delete</button
                      >
                    </form>
                  </div>
                {/if}

                <div class="meta tiny muted">
                  {#if m.discord}<span>Discord: {m.discord}</span>{/if}
                  {#if m.phone}<span>Phone: {m.phone}</span>{/if}
                  {#if m.github}<span>GitHub: {m.github}</span>{/if}
                  {#if m.linkedin}<span>LinkedIn: {m.linkedin}</span>{/if}
                  <span>All-time points: {data.pointsBy[m.id]?.total ?? 0}</span
                  >
                  {#if m.reject_reason}<span>Rejected: {m.reject_reason}</span
                    >{/if}
                  {#if m.bio}<span>Bio: {m.bio}</span>{/if}
                </div>
              </div>
            </td>
          </tr>
        {/if}
      {:else}
        <tr
          ><td colspan="8" class="center muted"
            >No members match this filter.</td
          ></tr
        >
      {/each}
    </tbody>
  </table>
</div>

<style>
  .danger-zone {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.7rem 0.8rem;
    border: 1px solid var(--glass-border);
    border-left: 3px solid #c0493f;
    border-radius: 10px;
  }

  .dz-copy {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    flex: 1 1 14rem;
    min-width: 0;
  }

  .window-panel {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    margin-bottom: 1rem;
  }

  .wp-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.8rem;
  }

  .wp-head p {
    margin: 0.15rem 0 0;
  }

  .wp-form {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.6rem;
  }

  .wp-form .field {
    flex: 1 1 12rem;
    min-width: 0;
  }

  .bulk {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .who-col {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  table.data {
    min-width: 900px;
  }
  .expand td {
    background: rgba(0, 0, 0, 0.25);
  }
  .panels {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.5rem 0;
  }
  .panels form {
    margin: 0;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
  }
  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--accent);
  }
  td form {
    margin: 0;
  }
  .photo-form {
    margin: 0.3rem 0 0;
  }

  .photo-btn {
    cursor: pointer;
    font-family: Inter, sans-serif;
  }
</style>
