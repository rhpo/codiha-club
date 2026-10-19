<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import { faPlus, faQrcode, faPen, faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
	import EventForm from '$lib/components/EventForm.svelte';
	import { dateRange } from '$lib/utils.js';
	import { page } from '$app/stores';

	export let data;
	export let form;

	let showNew = $page.url.searchParams.get('new') === '1';
	const tone = { draft: 'warn', published: 'ok', cancelled: 'bad', archived: '' };
</script>

<svelte:head><title>Events | CODIHA Admin</title></svelte:head>

<div class="spread">
	<div class="page-head">
		<h1>Events</h1>
		<p>{data.events.length} total</p>
	</div>
	<button class="btn" on:click={() => (showNew = !showNew)}>
		<Fa icon={faPlus} /> {showNew ? 'Close' : 'New event'}
	</button>
</div>

{#if form?.error}<div class="notice bad">{form.error}</div>{/if}

{#if showNew}
	<div class="panel">
		<h3>Create an event</h3>
		<EventForm action="?/create" submitLabel="Create event" />
	</div>
{/if}

<div class="table-wrap">
	<table class="data">
		<thead>
			<tr>
				<th>Event</th>
				<th>When</th>
				<th>Status</th>
				<th class="num">Reg.</th>
				<th class="num">Present</th>
				<th class="num">Pts</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each data.events as e (e.id)}
				<tr>
					<td>
						<div class="who">
							{#if e.cover_url}<img class="thumb" src={e.cover_url} alt="" />{/if}
							<span class="who-col">
								<span class="name">{e.title}</span>
								<span class="sub">/{e.slug}{e.location ? ` · ${e.location}` : ''}</span>
							</span>
						</div>
					</td>
					<td class="tiny muted">{dateRange(e.starts_at, e.ends_at)}</td>
					<td><span class="pill {tone[e.status]}">{e.status}</span></td>
					<td class="num">{data.regCount[e.id] ?? 0}{#if e.capacity}<span class="muted tiny">/{e.capacity}</span>{/if}</td>
					<td class="num">{data.attCount[e.id] ?? 0}</td>
					<td class="num">{e.checkin_points}</td>
					<td>
						<div class="row">
							<a class="btn sm ghost" href="/admin/events/{e.id}" title="Manage">
								<Fa icon={faPen} />
							</a>
							<a
								class="btn sm"
								href="/admin/events/{e.id}/present"
								target="_blank"
								rel="noopener"
								title="Presentation mode"
							>
								<Fa icon={faQrcode} />
							</a>
							<a class="btn sm ghost" href="/events/{e.slug}" target="_blank" rel="noopener" title="Public page">
								<Fa icon={faUpRightFromSquare} />
							</a>
						</div>
					</td>
				</tr>
			{:else}
				<tr><td colspan="7" class="center muted">No events yet. Create your first one.</td></tr>
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
		min-width: 860px;
	}
</style>
