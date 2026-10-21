<!--
	Hackathon podium. The frame takes the colour of the place, which is the
	only design that overrides the default accent.
-->
<script>
  // @ts-nocheck
  import CertificateBase from "./CertificateBase.svelte";

  export let data;

  const PLACE_LABEL = { 1: "FIRST PLACE", 2: "SECOND PLACE", 3: "THIRD PLACE" };
  const PLACE_COLOR = { 1: "#fabf24", 2: "#c7ccd6", 3: "#cc8042" };

  const fmt = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";

  $: titleSize = Math.max(
    11,
    Math.min(
      20,
      Math.floor(620 / (0.55 * Math.max(1, (data.contextTitle || " ").length)))
    )
  );
</script>

<CertificateBase
  heading="CERTIFICATE OF ACHIEVEMENT"
  eyebrow={PLACE_LABEL[data.place] ?? "WINNER"}
  accent={PLACE_COLOR[data.place] ?? "#fabf24"}
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
    fill="#d1e0d6">for an outstanding result at</text
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
