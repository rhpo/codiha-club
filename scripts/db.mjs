#!/usr/bin/env node
/**
 * Talk to the Supabase project from the terminal, so applying the schema or
 * promoting an admin does not mean copy-pasting into the dashboard.
 *
 * Uses the Management API endpoint the dashboard SQL editor itself calls, so
 * there is no Postgres driver to install and no database password to handle.
 *
 *   npm run db:status                 what exists, who is admin
 *   npm run db:apply                  apply supabase/schema.sql
 *   node scripts/db.mjs apply <file>  apply any .sql file
 *   node scripts/db.mjs admin <email> grant admin + approve
 *   node scripts/db.mjs sql "<query>" run one statement
 *
 * Needs SUPABASE_ACCESS_TOKEN in .env: a personal access token from
 * https://supabase.com/dashboard/account/tokens
 *
 * That token is account-wide. Keep it in .env (git-ignored) only; it must
 * never go into Netlify or the browser bundle, which need nothing but the
 * anon key and the service-role key.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
	let raw = '';
	try {
		raw = readFileSync(resolve(ROOT, '.env'), 'utf8');
	} catch {
		die('No .env file found in the repo root.');
	}
	const env = {};
	for (const line of raw.split('\n')) {
		const t = line.trim();
		if (!t || t.startsWith('#')) continue;
		const i = t.indexOf('=');
		if (i === -1) continue;
		env[t.slice(0, i).trim()] = t
			.slice(i + 1)
			.trim()
			.replace(/^["']|["']$/g, '');
	}
	return env;
}

function die(msg, hint) {
	console.error(`\n  ${msg}`);
	if (hint) console.error(`  ${hint}`);
	console.error('');
	process.exit(1);
}

const env = loadEnv();

const ref = (env.PUBLIC_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!ref) die('PUBLIC_SUPABASE_URL in .env is not a https://<ref>.supabase.co URL.');

const token = env.SUPABASE_ACCESS_TOKEN;
if (!token) {
	die(
		'SUPABASE_ACCESS_TOKEN is not set in .env.',
		'Create one at https://supabase.com/dashboard/account/tokens and add:\n' +
			'  SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxx'
	);
}

/** Runs SQL against the project. Returns the rows the last statement produced. */
async function sql(query) {
	const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ query })
	});

	const text = await res.text();
	if (!res.ok) {
		let detail = text;
		try {
			const j = JSON.parse(text);
			detail = j.message || j.error || text;
		} catch {
			/* not JSON, show it raw */
		}
		if (res.status === 401) {
			die('Supabase rejected the token (401).', 'Is SUPABASE_ACCESS_TOKEN still valid?');
		}
		die(`Supabase returned ${res.status}:`, detail);
	}

	try {
		return JSON.parse(text);
	} catch {
		return [];
	}
}

function table(rows) {
	if (!Array.isArray(rows) || rows.length === 0) return '  (no rows)';
	const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
	const cell = (v) => (v === null || v === undefined ? '-' : String(v));
	const width = (c) => Math.max(c.length, ...rows.map((r) => cell(r[c]).length));
	const w = Object.fromEntries(cols.map((c) => [c, Math.min(width(c), 44)]));
	const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));
	const line = (vals) => '  ' + cols.map((c) => clip(cell(vals[c]), w[c])).join('  ');
	return [
		'  ' + cols.map((c) => c.toUpperCase().padEnd(w[c])).join('  '),
		'  ' + cols.map((c) => '-'.repeat(w[c])).join('  '),
		...rows.map(line)
	].join('\n');
}

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
	case 'apply': {
		const file = args[0] ?? 'supabase/schema.sql';
		const path = resolve(ROOT, file);
		let text;
		try {
			text = readFileSync(path, 'utf8');
		} catch {
			die(`Cannot read ${file}`);
		}
		console.log(`\n  Applying ${file} to project ${ref} …`);
		await sql(text);
		console.log('  Done.\n');
		break;
	}

	case 'status': {
		const tables = await sql(
			`select table_name from information_schema.tables
			  where table_schema = 'public' order by table_name;`
		);
		console.log(`\n  Project ${ref}`);
		console.log(`  Tables and views in public: ${tables.length}`);
		if (!tables.length) {
			console.log('\n  The database is empty. Run:  npm run db:apply\n');
			break;
		}
		console.log('  ' + tables.map((t) => t.table_name).join(', '));

		const people = await sql(
			`select email, full_name, role, status
			   from public.profiles order by role desc, created_at asc limit 30;`
		);
		console.log(`\n  Members (${people.length}):`);
		console.log(table(people));

		const admins = people.filter((p) => p.role === 'admin');
		if (!admins.length) {
			console.log(
				'\n  No admin yet. Sign in once at /login, finish onboarding, then:\n' +
					'    node scripts/db.mjs admin you@example.com\n'
			);
		} else {
			console.log('');
		}
		break;
	}

	case 'admin': {
		const email = args[0];
		if (!email) die('Usage: node scripts/db.mjs admin <email>');
		// Single-quote escaping: the value is interpolated into SQL text.
		const safe = email.replace(/'/g, "''");
		const rows = await sql(
			`update public.profiles
			    set role = 'admin', status = 'approved', approved_at = now(),
			        onboarded_at = coalesce(onboarded_at, now())
			  where lower(email) = lower('${safe}')
			  returning email, full_name, role, status;`
		);
		if (!rows.length) {
			die(
				`No profile with email ${email}.`,
				'Sign in through /login first so the profile row is created, then retry.'
			);
		}
		console.log('\n  Promoted:\n' + table(rows) + '\n');
		break;
	}

	case 'sql': {
		if (!args[0]) die('Usage: node scripts/db.mjs sql "select 1"');
		console.log('\n' + table(await sql(args.join(' '))) + '\n');
		break;
	}

	default:
		console.log(
			[
				'',
				'  node scripts/db.mjs status          what exists, who is admin',
				'  node scripts/db.mjs apply [file]    apply supabase/schema.sql by default',
				'  node scripts/db.mjs admin <email>   grant admin + approve',
				'  node scripts/db.mjs sql "<query>"   run one statement',
				''
			].join('\n')
		);
		process.exit(cmd ? 1 : 0);
}
