<script>
	// @ts-nocheck
	import Fa from "svelte-fa";
	import FileDrop from '$lib/components/FileDrop.svelte';
	import {
		faPaperPlane,
		faPaperclip,
		faTriangleExclamation,
	} from "@fortawesome/free-solid-svg-icons";
	import { formatDateTime } from "$lib/utils.js";

	export let data;
	export let form;

	let audience = "approved";
	let asHtml = false;
	let memberFilter = "";
	let sending = false;

	$: filteredMembers = data.members.filter((m) =>
		`${m.full_name ?? ""} ${m.email ?? ""}`
			.toLowerCase()
			.includes(memberFilter.toLowerCase()),
	);

	const tone = { sent: "ok", queued: "warn", partial: "warn", failed: "bad" };
</script>

<svelte:head><title>Mail | CODIHA Admin</title></svelte:head>

<div class="page-head">
	<h1>Club mail</h1>
	<p>
		Sent from
		<strong
			>{data.sender.name ?? "CODIHA Club"} &lt;{data.sender.email ??
				"not configured"}&gt;</strong
		>. Recipients never see each other.
	</p>
</div>

{#if !data.sender.configured}
	<div class="notice bad">
		<Fa icon={faTriangleExclamation} />
		<strong>BREVO_API_KEY is not set.</strong>
		Add it to your
		<code>.env</code> and to the Netlify environment variables, then redeploy.
	</div>
{/if}

{#if form?.error}<div class="notice bad">{form.error}</div>{/if}
{#if form?.success}
	<div class="notice ok">{form.success}</div>
	{#if form.warning}<div class="notice warn tiny">{form.warning}</div>{/if}
{/if}

<form
	class="panel form"
	method="POST"
	action="?/send"
	enctype="multipart/form-data"
	on:submit={() => (sending = true)}
>
	<label class="field">
		<span>Audience</span>
		<select name="audience" bind:value={audience}>
			<option value="approved"
				>Approved members ({data.audienceCounts.approved})</option
			>
			<option value="all"
				>Everyone with an email ({data.audienceCounts.all})</option
			>
			<option value="pending"
				>Pending members ({data.audienceCounts.pending})</option
			>
			<option value="admins">Admins ({data.audienceCounts.admins})</option
			>
			<option value="event">Registrants of an event…</option>
			<option value="hackathon">Applicants of a hackathon…</option>
			<option value="selected">Hand-picked members…</option>
			<option value="custom">Custom email list…</option>
		</select>
	</label>

	{#if audience === "event"}
		<label class="field">
			<span>Event</span>
			<select name="event_id" required>
				<option value="" disabled selected>Select an event…</option>
				{#each data.events as e (e.id)}
					<option value={e.id}>{e.title}</option>
				{/each}
			</select>
		</label>
	{/if}

	{#if audience === "hackathon"}
		<div class="form-row two">
			<label class="field">
				<span>Hackathon</span>
				<select name="hackathon_id" required>
					<option value="" disabled selected
						>Select a hackathon…</option
					>
					{#each data.hackathons as h (h.id)}
						<option value={h.id}>{h.title}</option>
					{/each}
				</select>
			</label>
			<label class="field">
				<span>Application status</span>
				<select name="application_status">
					<option value="all">all applicants</option>
					<option value="accepted">accepted only</option>
					<option value="pending">pending only</option>
					<option value="rejected">rejected only</option>
				</select>
			</label>
		</div>
	{/if}

	{#if audience === "selected"}
		<label class="field">
			<span>Filter</span>
			<input
				bind:value={memberFilter}
				placeholder="Search name or email…"
			/>
		</label>
		<div class="member-picker">
			{#each filteredMembers as m (m.id)}
				<label class="check">
					<input type="checkbox" name="member_ids" value={m.id} />
					{m.full_name || m.email}
					<span class="tiny muted">{m.email} · {m.status}</span>
				</label>
			{/each}
			{#if !filteredMembers.length}<p class="tiny muted">
					No member matches.
				</p>{/if}
		</div>
	{/if}

	{#if audience === "custom"}
		<label class="field">
			<span>Email addresses</span>
			<textarea
				name="custom_emails"
				placeholder="one@example.com, two@example.com&#10;three@example.com"
			/>
			<span class="hint">Separate with commas, spaces or new lines.</span>
		</label>
	{/if}

	<label class="field">
		<span>Subject *</span>
		<input
			name="subject"
			required
			placeholder="Next workshop: Docker from scratch"
		/>
	</label>

	<label class="field">
		<span>Message *</span>
		<textarea
			name="body"
			required
			rows="10"
			placeholder={asHtml
				? "<p>Hello <strong>members</strong>…</p>"
				: "Hi everyone,\n\nOur next workshop is on Saturday at 14:00 in Amphi B.\n\nSee you there!"}
		/>
		<span class="hint">
			Wrapped in the CODIHA email template automatically (logo, colours,
			footer).
		</span>
	</label>

	<label class="check">
		<input type="checkbox" name="as_html" value="1" bind:checked={asHtml} />
		My message is already HTML (don't convert line breaks)
	</label>

	<FileDrop
		name="attachments"
		multiple
		label="Drop attachments"
		hint="10 MB in total"
	>
		<Fa icon={faPaperclip} /> Attachments
	</FileDrop>

	<button class="btn" type="submit" disabled={sending}>
		<Fa icon={faPaperPlane} />
		{sending ? "Sending…" : "Send email"}
	</button>
</form>

<div class="panel">
	<h3>Recent sends</h3>
	<div class="table-wrap">
		<table class="data">
			<thead>
				<tr
					><th>When</th><th>Subject</th><th>Audience</th><th
						class="num">To</th
					><th>Status</th><th>By</th></tr
				>
			</thead>
			<tbody>
				{#each data.log as l (l.id)}
					<tr>
						<td class="tiny muted"
							>{formatDateTime(l.created_at)}</td
						>
						<td>
							{l.subject}
							{#if l.attachments?.length}
								<span class="pill tiny"
									><Fa icon={faPaperclip} />
									{l.attachments.length}</span
								>
							{/if}
							{#if l.error}<br /><span class="tiny bad-text"
									>{l.error}</span
								>{/if}
						</td>
						<td class="tiny muted">{l.audience}</td>
						<td class="num">{l.recipient_count}</td>
						<td
							><span class="pill {tone[l.status]}"
								>{l.status}</span
							></td
						>
						<td class="tiny muted"
							>{l.profiles?.full_name ?? "-"}</td
						>
					</tr>
				{:else}
					<tr
						><td colspan="6" class="center muted"
							>No emails sent yet.</td
						></tr
					>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	h3 {
		font-family: Cubano, sans-serif;
		margin: 0 0 0.75rem;
		font-size: 1.1rem;
	}
	code {
		font-family: var(--font-mono);
		background: rgba(0, 0, 0, 0.3);
		padding: 1px 5px;
		border-radius: 4px;
	}
	.member-picker {
		max-height: 280px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.6rem;
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-sm);
		background: rgba(0, 0, 0, 0.2);
	}
	table.data {
		min-width: 780px;
	}
	.bad-text {
		color: var(--bad);
	}
</style>
