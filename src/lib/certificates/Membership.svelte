<!--
	Membership / role certificate: "served the club as President, from X to
	present". Claimed by the member once they have been in the club a week or
	attended a workshop.
-->
<script>
  // @ts-nocheck
  import CertificateBase from "./CertificateBase.svelte";
  import { certificateRoleTitle } from "$lib/roles.js";

  export let data;

  const fmt = (iso) =>
    new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  $: title = certificateRoleTitle(data.role);
  $: period = data.periodStart
    ? `from ${fmt(data.periodStart)} to ${
        data.periodEnd ? fmt(data.periodEnd) : "present"
      }`
    : "";
</script>

<CertificateBase
  heading="CERTIFICATE OF MEMBERSHIP"
  intro="CODIHA Club proudly certifies that"
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
    fill="#d1e0d6">served the club as</text
  >
  <text
    x={W / 2}
    y="390"
    text-anchor="middle"
    font-family={body}
    font-weight="bold"
    font-size="20"
    fill="#ffffff">{title}</text
  >
  {#if period}
    <text
      x={W / 2}
      y="412"
      text-anchor="middle"
      font-family={body}
      font-size="10"
      fill={faint}>{period}</text
    >
  {/if}
</CertificateBase>
