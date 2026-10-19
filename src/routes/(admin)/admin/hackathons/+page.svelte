<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import { faPlus, faPen, faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
	import HackathonForm from '$lib/components/HackathonForm.svelte';
	import { dateRange, formatDate } from '$lib/utils.js';
	import { page } from '$app/stores';

	export let data;
	export let form;

	let showNew = $page.url.searchParams.get('new') === '1';
	const tone = { draft: 'warn', published: 'ok', closed: '', cancelled: 'bad', archived: '' };
</script>

<svelte:head><title>Hackathons | CODIHA Admin</title></svelte:head>

<div class="spread">
	<div class="page-head">
		<h1>Hackathons</h1>
		<p>{data.hackathons.length} total</p>
	</div>
	<button class="btn" on:click={() => (showNew = !showNew)}>
		<Fa icon={faPlus} /> {showNew ? 'Close' : 'New hackathon'}
	</button>
</div>

{#if form?.error}<div class="notice bad">{form.error}</div>{/if}

{#if showNew}
	<div class="panel">
		<h3>Create a hackathon</h3>
		<HackathonForm action="?/create" submitLabel="Create hackathon" />
	</div>
{/if}

<div class="table-wrap">
	<table class="data">
		<thead>
			<tr>
				<th>Hackathon</th>
				<th>When</th>
				<th>Deadline</th>
				<th>Status</th>
				<th class="num">Apps</th>
				<th class="num">Accepted</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each data.hackathons as h (h.id)}
				<tr>
					<td>
						<div class="who">
							{#if h.cover_url}<img class="thumb" src={h.cover_url} alt="" />{/if}
							<span class="who-col">
								<span class="name">{h.title}</span>
								<span class="sub">{h.theme ?? `/${h.slug}`}</span>
							</span>
						</div>
					</td>
					<td class="tiny muted">{dateRange(h.starts_at, h.ends_at)}</td>
					<td class="tiny muted">{h.apply_deadline ? formatDate(h.apply_deadline) : '-'}</td>
					<td><span class="pill {tone[h.status]}">{h.status}</span></td>
					<td class="num">
						{data.counts[h.id]?.total ?? 0}
						{#if data.counts[h.id]?.pending}
							<span class="pill warn tiny">{data.counts[h.id].pending} new</span>
						{/if}
					</td>
					<td class="num">
						{data.counts[h.id]?.accepted ?? 0}{#if h.capacity}<span class="muted tiny">/{h.capacity}</span>{/if}
					</td>
					<td>
						<div class="row">
							<a class="btn sm ghost" href="/admin/hackathons/{h.id}" title="Manage">
								<Fa icon={faPen} />
							</a>
							<a class="btn sm ghost" href="/hackathons/{h.slug}" target="_blank" rel="noopener" title="Public page">
								<Fa icon={faUpRightFromSquare} />
							</a>
						</div>
					</td>
				</tr>
			{:else}
				<tr><td colspan="7" class="center muted">No hackathons yet.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	h3 {
		font-family: Cubano, sans-serif;
		margin: 0 0 0.75rem;
	}
	.thumb {
		width: 52px;
		height: 32px;
		object-fit: cover;
		border-radius: 6px;
		flex: 0 0 auto;
	}
	.who-col {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	table.data {
		min-width: 900px;
	}
</style>
