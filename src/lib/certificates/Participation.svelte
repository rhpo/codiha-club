<!--
	Issued automatically when a member checks in to a workshop or is accepted
	into a hackathon.
-->
<script>
  // @ts-nocheck
  import CertificateBase from "./CertificateBase.svelte";

  export let data;

  const fmt = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";

  /* Shrink-to-fit: workshop titles are written by admins and run long. */
  $: titleSize = Math.max(
    11,
    Math.min(
      20,
      Math.floor(620 / (0.55 * Math.max(1, (data.contextTitle || " ").length)))
    )
  );
</script>

<CertificateBase
  heading="CERTIFICATE OF PARTICIPATION"
  name={data.memberName}
  university={data.memberUniversity}
  code={data.code}
  issuedAt={data.issuedAt}
  verifyUrl={data.verifyUrl}
  let:W
  let:body
  let:faint
>
  <text
    x={W / 2}
    y="362"
    text-anchor="middle"
    font-family={body}
    font-style="italic"
    font-size="11"
    fill="#d1e0d6">for actively taking part in</text
  >
  <text
    x={W / 2}
    y="390"
    text-anchor="middle"
    font-family={body}
    font-weight="bold"
    font-size={titleSize}
    fill="#ffffff">{data.contextTitle}</text
  >
  {#if data.contextDate}
    <text
      x={W / 2}
      y="412"
      text-anchor="middle"
      font-family={body}
      font-size="10"
      fill={faint}>{fmt(data.contextDate)}</text
    >
  {/if}
</CertificateBase>
