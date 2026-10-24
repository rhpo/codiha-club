<script>
  // @ts-nocheck
  import Fa from "svelte-fa";
  import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
  import { UNIVERSITIES, FIELDS, YEARS } from "$lib/utils.js";

  export let data;
  export let form;

  const v = (key) => form?.values?.[key] ?? data.profile?.[key] ?? "";
  $: editing = !!data.profile?.onboarded_at;
</script>

<svelte:head><title>Complete your CODIHA profile</title></svelte:head>

<div class="page narrow">
  <div class="page-head">
    <span class="eyebrow">{editing ? "Your profile" : "Step 2 of 2"}</span>
    <h1>{editing ? "Edit your profile" : "Tell us about you"}</h1>
    <p>
      {#if editing}
        Keep your details up to date. Certificates are issued with the name
        below.
      {:else}
        Signed in as <strong>{data.email}</strong>. A club admin reviews new
        members before your dashboard unlocks.
      {/if}
    </p>
  </div>

  {#if data.missing?.length && !form?.error}
    <div class="notice warn">
      Before you can use the site we need a few details:
      <strong>{data.missing.map((m) => m.label).join(", ")}</strong>.
    </div>
  {/if}

  {#if form?.error}<div class="notice bad">{form.error}</div>{/if}

  <form class="panel form" method="POST">
    <input type="hidden" name="next" value={data.next} />
    <label class="field">
      <span>Full name *</span>
      <input
        name="full_name"
        value={v("full_name")}
        placeholder="Ramy Hadid"
        required
        autocomplete="name"
      />
    </label>

    <div class="form-row two">
      <label class="field">
        <span>University *</span>
        <select name="university" required>
          <option value="" disabled selected={!v("university")}>Select…</option>
          {#each UNIVERSITIES as u}
            <option value={u} selected={v("university") === u}>{u}</option>
          {/each}
        </select>
      </label>

      <label class="field">
        <span>Field of study *</span>
        <select name="field" required>
          <option value="" disabled selected={!v("field")}>Select…</option>
          {#each FIELDS as f}
            <option value={f} selected={v("field") === f}>{f}</option>
          {/each}
        </select>
      </label>
    </div>

    <div class="form-row two">
      <label class="field">
        <span>Year *</span>
        <select name="year" required>
          <option value="" disabled selected={!v("year")}>Select…</option>
          {#each YEARS as y}
            <option value={y} selected={v("year") === y}>{y}</option>
          {/each}
        </select>
      </label>

      <label class="field">
        <span>Discord username</span>
        <input name="discord" value={v("discord")} placeholder="ramy#0001" />
      </label>
    </div>

    <div class="form-row two">
      <label class="field">
        <span>Phone (optional)</span>
        <input
          name="phone"
          value={v("phone")}
          placeholder="+213 ..."
          inputmode="tel"
        />
      </label>
      <label class="field">
        <span>GitHub (optional)</span>
        <input name="github" value={v("github")} placeholder="github.com/you" />
      </label>
    </div>

    <label class="field">
      <span>LinkedIn (optional)</span>
      <input
        name="linkedin"
        value={v("linkedin")}
        placeholder="linkedin.com/in/you"
      />
    </label>

    <label class="field">
      <span>Why did you join? *</span>
      <textarea
        name="bio"
        required
        minlength="10"
        placeholder="What are you building? What do you want to learn?"
        >{v("bio")}</textarea
      >
      <span class="hint">A sentence or two is plenty.</span>
    </label>

    <button class="btn block" type="submit">
      {#if data.photoPending}
        Next <Fa icon={faArrowRight} />
      {:else}
        Save changes
      {/if}
    </button>

    {#if data.photoPending}
      <p class="tiny muted foot">
        Step 1 of 2. Next you will take a photo of your face.
      </p>
    {/if}
  </form>
</div>

<style>
  .foot {
    margin: 0.2rem 0 0;
    text-align: center;
  }
</style>
