<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import { faHourglassHalf, faCircleXmark } from '@fortawesome/free-solid-svg-icons';
	import { faDiscord as brandDiscord } from '@fortawesome/free-brands-svg-icons';

	export let data;
	$: rejected = data.profile.status === 'rejected';
</script>

<svelte:head><title>Membership {rejected ? 'review' : 'pending'} | CODIHA Club</title></svelte:head>

<div class="page narrow">
	<div class="panel state">
		<div class="icon" class:bad={rejected}>
			<Fa icon={rejected ? faCircleXmark : faHourglassHalf} />
		</div>

		{#if rejected}
			<h1>Application not approved</h1>
			<p class="muted">
				A club admin reviewed your application and it wasn't approved
				{#if data.profile.reject_reason}&nbsp;<em>{data.profile.reject_reason}</em>{/if}.
			</p>
			<p class="muted tiny">
				Think this is a mistake? Reach out on Discord and we'll take another look.
			</p>
		{:else}
			<h1>You're on the list</h1>
			<p class="muted">
				Thanks {data.profile.full_name.split(' ')[0]}! Your membership is <strong>pending</strong>
				admin approval. You'll get an email the moment it's approved, and your dashboard, points
				and certificates unlock right away.
			</p>
		{/if}

		<div class="summary">
			<div><span>University</span><strong>{data.profile.university ?? '-'}</strong></div>
			<div><span>Field</span><strong>{data.profile.field ?? '-'}</strong></div>
			<div><span>Year</span><strong>{data.profile.year ?? '-'}</strong></div>
		</div>

		<div class="btn-row">
			<a class="btn ghost" href="/onboarding?edit=1">Edit my details</a>
			<a class="btn" href="https://discord.gg/uuv2xKwhJx" target="_blank" rel="noopener">
				<Fa icon={brandDiscord} /> Join the Discord
			</a>
			<a class="btn ghost" href="/events">Browse events</a>
		</div>
	</div>
</div>

<style>
	.state {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.75rem;
		padding: 2rem 1.25rem;
	}
	.icon {
		font-size: 2.4rem;
		color: var(--warn);
	}
	.icon.bad {
		color: var(--bad);
	}
	h1 {
		margin: 0;
		font-size: 1.6rem;
	}
	p {
		margin: 0;
		max-width: 46ch;
		line-height: 1.6;
	}
	.summary {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.5rem;
		width: 100%;
		margin: 0.5rem 0;
	}
	.summary div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		background: rgba(0, 0, 0, 0.18);
		border-radius: var(--radius-sm);
		padding: 0.55rem 0.75rem;
		font-size: 0.88rem;
	}
	.summary span {
		color: var(--muted-2);
	}
	@media (min-width: 620px) {
		.summary {
			grid-template-columns: repeat(3, 1fr);
		}
		.summary div {
			flex-direction: column;
			align-items: center;
			gap: 0.15rem;
			text-align: center;
		}
	}
</style>
