<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import {
		faQrcode,
		faLaptopCode,
		faTrophy,
		faHandHoldingHeart
	} from '@fortawesome/free-solid-svg-icons';
	import { faInstagram } from '@fortawesome/free-brands-svg-icons';
	import Coin from '$lib/components/Coin.svelte';

	/**
	 * The reel, self-hosted from static/videos. Instagram's own embed was not an
	 * option: it wraps the clip in a header, an action bar and a caption that
	 * cannot be turned off, which is most of the box.
	 */
	export let src = '/videos/codiha-score.mp4';
	export let poster = '';
	/** Only used for the "watch on Instagram" link under the clip. */
	export let reel = 'DQ_ejLujFAr';

	// A missing file would otherwise leave a black rectangle on the homepage.
	let failed = false;

	// The clip is currently 1276x718. Taking the real ratio from the file means
	// re-cutting it portrait, or swapping it entirely, needs no CSS change.
	let ratio = '16 / 9';

	/**
	 * The element is server-rendered, so the browser starts loading the clip
	 * before Svelte hydrates. By then an `error` event has already come and
	 * gone, which is why the initial `node.error` check matters as much as the
	 * listener.
	 */
	const watchMedia = (node) => {
		const mark = () => (failed = true);
		const measure = () => {
			if (node.videoWidth && node.videoHeight) ratio = `${node.videoWidth} / ${node.videoHeight}`;
		};
		if (node.error) mark();
		measure();
		node.addEventListener('error', mark, true);
		node.addEventListener('loadedmetadata', measure);
		return {
			destroy: () => {
				node.removeEventListener('error', mark, true);
				node.removeEventListener('loadedmetadata', measure);
			}
		};
	};

	// Schema defaults (supabase/schema.sql). Admins can override them per event
	// or hackathon, so these are shown as the usual amount, not a promise.
	const ways = [
		{ icon: faQrcode, points: '+10', title: 'Show up', text: 'Scan the QR on the room screen at any event. Once per event.' },
		{ icon: faLaptopCode, points: '+25', title: 'Build', text: 'Get accepted into a hackathon and take part.' },
		{ icon: faTrophy, points: '+150', title: 'Win', text: 'First place on a hackathon podium. 100 for second, 60 for third.' },
		{ icon: faHandHoldingHeart, points: '+?', title: 'Help out', text: 'Run a workshop, mentor, organise. The board adds points with a reason.' }
	];
</script>

<section class="block" id="score">
	<div class="section-head" data-aos="fade-right">
		<div>
			<span class="eyebrow">How it works</span>
			<h2><Coin size="1em" /> The CODIHA Score</h2>
		</div>
		<a href="/leaderboard">See the board →</a>
	</div>

	<div class="layout">
		<div class="explain" data-aos="fade-up">
			<p class="lead">
				Every point you earn is a line in a public ledger with a reason attached. Nothing is
				typed in by hand, nothing disappears, and the board runs for the whole academic year.
			</p>

			<ul class="ways">
				{#each ways as way, i}
					<li data-aos="fade-up" data-aos-delay={80 + i * 80}>
						<span class="ico"><Fa icon={way.icon} /></span>
						<div class="copy">
							<b>{way.title} <em>{way.points} <Coin size="0.95em" /></em></b>
							<span>{way.text}</span>
						</div>
					</li>
				{/each}
			</ul>

			<p class="tiny muted foot">
				Amounts are the usual values. Admins can set a different reward per event or hackathon.
			</p>
		</div>

		<figure class="reel" data-aos="zoom-in" data-aos-delay="120">
			{#if failed}
				<a class="missing" href="https://www.instagram.com/reel/{reel}/" target="_blank" rel="noopener">
					<Fa icon={faInstagram} />
					<span>Watch the explainer on Instagram</span>
				</a>
			{:else}
				<!-- "metadata", not "none": it keeps the homepage cheap but still
				     fetches enough to fire on:error when the file is missing, so a
				     bad path shows the link card instead of a black rectangle. -->
				<video
					{src}
					poster={poster || undefined}
					style="aspect-ratio: {ratio}"
					controls
					playsinline
					preload="metadata"
					use:watchMedia
				>
					<track kind="captions" />
				</video>
			{/if}

			<figcaption class="tiny muted">
				Also on
				<a href="https://www.instagram.com/reel/{reel}/" target="_blank" rel="noopener">
					@codihaclub
				</a>
			</figcaption>
		</figure>
	</div>
</section>

<style>
	.block {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		margin-bottom: 2rem;
	}

	.block h2 {
		font-size: 1.8rem;
	}

	.layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.25rem;
		width: 100%;
		align-items: start;
	}

	.explain {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}

	.lead {
		margin: 0;
		font-family: Inter, sans-serif;
		font-size: 1rem;
		line-height: 1.6;
		color: var(--muted);
	}

	.ways {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.ways li {
		display: flex;
		align-items: flex-start;
		gap: 0.8rem;
		padding: 0.85rem 1rem;
		border-radius: var(--radius-sm);
		background: var(--glass);
		border: 1px solid var(--glass-border);
	}

	.ico {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		flex: 0 0 auto;
		border-radius: 10px;
		background: var(--accent-soft);
		border: 1px solid var(--accent-line);
		color: var(--accent);
	}

	.copy {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-family: Inter, sans-serif;
		min-width: 0;
	}

	.copy b {
		font-weight: 700;
		font-size: 0.98rem;
	}

	.copy em {
		font-style: normal;
		font-weight: 800;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
	}

	.copy span {
		font-size: 0.86rem;
		line-height: 1.45;
		color: var(--muted);
	}

	.foot {
		margin: 0;
		font-family: Inter, sans-serif;
	}

	/* ---- reel ------------------------------------------------------------ */

	.reel {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: stretch;
		width: 100%;
		/* a landscape clip stops being watchable much past this */
		max-width: 640px;
		align-self: center;
	}

	.reel video {
		width: 100%;
		/* aspect-ratio is set inline from the file's own dimensions, and
		   object-fit: contain means an odd ratio letterboxes instead of
		   cropping someone's face off. */
		object-fit: contain;
		border: 1px solid var(--glass-border);
		border-radius: var(--radius);
		background: #000;
		display: block;
	}

	.missing {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		width: 100%;
		aspect-ratio: 16 / 9;
		border: 1px dashed var(--glass-border);
		border-radius: var(--radius);
		background: var(--glass);
		font-family: Inter, sans-serif;
		font-size: 0.9rem;
		text-align: center;
		padding: 1.5rem;
		color: #fff;
		text-decoration: none;
	}

	.missing :global(svg) {
		font-size: 2rem;
		color: var(--accent);
	}

	.missing:hover {
		border-color: var(--glass-border-strong);
		text-decoration: none;
	}

	.reel figcaption {
		font-family: Inter, sans-serif;
		text-align: center;
	}

	.reel a {
		color: var(--accent);
	}

	@media (min-width: 1000px) {
		.layout {
			/* the clip is landscape, so it needs a column it can breathe in */
			grid-template-columns: minmax(0, 1fr) minmax(0, 540px);
			gap: 2rem;
		}

		.reel {
			position: sticky;
			top: calc(var(--nav-body, 96px) + 1rem);
		}
	}

	@media screen and (max-width: 760px) {
		.block h2 {
			font-size: 1.45rem;
		}
	}
</style>
