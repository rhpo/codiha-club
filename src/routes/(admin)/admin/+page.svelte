<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import {
		faUsers,
		faCalendarDays,
		faLaptopCode,
		faCertificate,
		faQrcode,
		faPlus,
		faEnvelope
	} from '@fortawesome/free-solid-svg-icons';
	import Avatar from '$lib/components/Avatar.svelte';
	import { dateRange, formatDateTime, relative } from '$lib/utils.js';

	export let data;
</script>

<svelte:head><title>Admin | CODIHA Club</title></svelte:head>

<div class="page-head">
	<span class="eyebrow">Control room</span>
	<h1>Overview</h1>
	<p>Approve members, run events, judge hackathons and send club mail.</p>
</div>

<div class="stats">
	<div class="stat">
		<span class="value">{data.counts.members}</span>
		<span class="label"><Fa icon={faUsers} /> Approved members</span>
	</div>
	<div class="stat">
		<span class="value">{data.counts.events}</span>
		<span class="label"><Fa icon={faCalendarDays} /> Workshops</span>
	</div>
	<div class="stat">
		<span class="value">{data.counts.hackathons}</span>
		<span class="label"><Fa icon={faLaptopCode} /> Hackathons</span>
	</div>
	<div class="stat">
		<span class="value">{data.counts.certificates}</span>
		<span class="label"><Fa icon={faCertificate} /> Certificates issued</span>
	</div>
</div>

<div class="btn-row">
	<a class="btn" href="/admin/events?new=1"><Fa icon={faPlus} /> New event</a>
	<a class="btn ghost" href="/admin/hackathons?new=1"><Fa icon={faPlus} /> New hackathon</a>
	<a class="btn ghost" href="/admin/polls?new=1"><Fa icon={faPlus} /> New vote</a>
	<a class="btn ghost" href="/admin/mail"><Fa icon={faEnvelope} /> Send mail</a>
</div>

<div class="grid cols-2">
	<div class="panel">
		<div class="spread">
			<h3>Waiting for approval</h3>
			<a class="tiny" href="/admin/members?status=pending">All pending →</a>
		</div>
		{#if data.pending.length}
			<ul class="plain">
				{#each data.pending as m (m.id)}
					<li>
						<Avatar src={m.avatar_url} name={m.full_name} size={30} />
						<span class="who-col">
							<strong>{m.full_name || m.email}</strong>
							<span class="tiny muted">{[m.university, m.field, m.year].filter(Boolean).join(' · ')}</span>
						</span>
						<span class="tiny muted">{relative(m.created_at)}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="tiny muted">Nothing pending.</p>
		{/if}
	</div>

	<div class="panel">
		<div class="spread">
			<h3>Next events</h3>
			<a class="tiny" href="/admin/events">Manage →</a>
		</div>
		{#if data.upcoming.length}
			<ul class="plain">
				{#each data.upcoming as e (e.id)}
					<li>
						<span class="who-col">
							<strong>{e.title}</strong>
							<span class="tiny muted">{dateRange(e.starts_at, e.ends_at)}</span>
						</span>
						<span class="row">
							<span class="pill {e.status === 'published' ? 'ok' : 'warn'}">{e.status}</span>
							<a class="btn sm" href="/admin/events/{e.id}/present" target="_blank" rel="noopener">
								<Fa icon={faQrcode} />
							</a>
						</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="tiny muted">No upcoming events scheduled.</p>
		{/if}
	</div>

	<div class="panel">
		<div class="spread">
			<h3>Open votes</h3>
			<a class="tiny" href="/admin/polls">Manage →</a>
		</div>
		{#if data.openPolls.length}
			<ul class="plain">
				{#each data.openPolls as p (p.id)}
					<li>
						<span class="who-col">
							<strong>{p.title}</strong>
							<span class="tiny muted">closes {relative(p.closes_at)}</span>
						</span>
						<a class="tiny" href="/admin/polls/{p.id}">Results →</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="tiny muted">No vote is open.</p>
		{/if}
	</div>

	<div class="panel">
		<h3>Latest points activity</h3>
		{#if data.recentLedger.length}
			<ul class="plain">
				{#each data.recentLedger as l (l.id)}
					<li>
						<span class="who-col">
							<strong>{l.profiles?.full_name ?? 'Member'}</strong>
							<span class="tiny muted">{l.reason}</span>
						</span>
						<span class="amt" class:minus={l.amount < 0}>{l.amount > 0 ? '+' : ''}{l.amount}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="tiny muted">No points awarded yet.</p>
		{/if}
	</div>
</div>

{#if data.abilities?.manageUsers && data.quotas?.length}
	<section class="panel">
		<h3>Mail send quota today</h3>
		<p class="tiny muted qnote">
			How many messages each mailbox has sent today.
		</p>
		<div class="table-wrap">
			<table class="data quota">
				<thead>
					<tr><th>Mailbox</th><th>Member</th><th class="num">Used</th><th class="num">Limit</th></tr>
				</thead>
				<tbody>
					{#each data.quotas as q (q.account_id)}
						<tr>
							<td class="tiny">{q.address}</td>
							<td class="tiny muted">{q.full_name ?? 'Shared'}</td>
							<td class="num">
								<strong class:over={q.daily_send_limit !== null && q.used_today >= q.daily_send_limit}>
									{q.used_today}
								</strong>
							</td>
							<td class="num tiny muted">{q.daily_send_limit ?? 'unlimited'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/if}


<style>
	h3 {
		font-family: Cubano, sans-serif;
		margin: 0 0 0.5rem;
		font-size: 1.1rem;
	}
	ul.plain {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	ul.plain li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.88rem;
	}
	.who-col {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}
	.who-col strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.amt {
		font-family: Cubano, sans-serif;
		color: var(--ok);
	}
	.amt.minus {
		color: var(--bad);
	}
	.qnote {
		margin: -0.5rem 0 0.75rem;
	}
	.quota .over {
		color: var(--bad);
	}
</style>
