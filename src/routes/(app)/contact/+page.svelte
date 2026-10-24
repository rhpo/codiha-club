<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import { faEnvelope, faPaperPlane } from '@fortawesome/free-solid-svg-icons';

	export let data;
	export let form;

	/** What the server sent back after a rejection, so nothing is retyped. */
	$: v = (key, fallback = '') => form?.values?.[key] ?? fallback;
</script>

<svelte:head>
	<title>Contact | CODIHA Club</title>
	<meta name="description" content="Get in touch with the CODIHA Club board." />
</svelte:head>

<div class="page narrow">
	<div class="page-head">
		<span class="eyebrow">Get in touch</span>
		<h1><Fa icon={faEnvelope} /> Contact the club</h1>
		<p>
			A question about joining, an idea for a workshop, or something you want to build with us.
			Write to the board here and somebody will come back to you.
		</p>
	</div>

	{#if form?.error}<div class="notice bad">{form.error}</div>{/if}
	{#if form?.success}<div class="notice ok">{form.success}</div>{/if}

	<form class="panel form" method="POST" action="?/send">
		<!-- Hidden from people, tempting to bots. Never shown, never read by
		     anyone using the page normally. -->
		<input
			class="trap"
			type="text"
			name="company"
			tabindex="-1"
			autocomplete="off"
			aria-hidden="true"
		/>

		<div class="form-row two">
			<label class="field">
				<span>Your name *</span>
				<input name="name" value={v('name', data.me?.full_name ?? '')} required maxlength="80" />
			</label>
			<label class="field">
				<span>Email *</span>
				<input
					type="email"
					name="email"
					value={v('email', data.me?.email ?? '')}
					required
					placeholder="you@example.com"
				/>
			</label>
		</div>

		<label class="field">
			<span>Subject</span>
			<input name="subject" value={v('subject')} maxlength="140" placeholder="What is this about?" />
		</label>

		<label class="field">
			<span>Message *</span>
			<textarea name="body" rows="6" required maxlength="4000" placeholder="Tell us what you need."
				>{v('body')}</textarea
			>
		</label>

		<button class="btn" type="submit"><Fa icon={faPaperPlane} /> Send message</button>
	</form>
</div>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	/* Off the page rather than display:none, which some bots skip. */
	.trap {
		position: absolute;
		left: -9999px;
		width: 1px;
		height: 1px;
		opacity: 0;
	}
</style>
