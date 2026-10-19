<script>
	// @ts-nocheck
	import { onMount } from 'svelte';

	// Posted alongside every datetime-local field so the server can convert the
	// admin's wall-clock input to UTC. See $lib/server/datetime.ts.
	let offset = 0;
	onMount(() => {
		offset = new Date().getTimezoneOffset();
	});
</script>

<input type="hidden" name="tz_offset" value={offset} />
