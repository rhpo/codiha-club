# Certificates

One Svelte file per certificate design. If you can edit HTML, you can add one.

## Adding a new certificate

**1. Copy a design file.** `Membership.svelte` is the simplest. Call the copy
something like `Volunteer.svelte`.

**2. Edit the wording.** Everything shared — the border, the CODIHA header, the
person's name, the signature block, the QR code — comes from `CertificateBase`.
Your file only supplies the heading and the few lines in the middle:

```svelte
<CertificateBase
  heading="CERTIFICATE OF APPRECIATION"
  intro="CODIHA Club warmly thanks"
  name={data.memberName}
  university={data.memberUniversity}
  code={data.code}
  issuedAt={data.issuedAt}
  verifyUrl={data.verifyUrl}
  let:W
  let:body
>
  <text x={W / 2} y="380" text-anchor="middle" font-family={body} font-size="16" fill="#ffffff">
    for volunteering at {data.contextTitle}
  </text>
</CertificateBase>
```

**3. Register it** in `index.js`:

```js
import Volunteer from './Volunteer.svelte';
export const CERTIFICATE_DESIGNS = { ..., volunteer: Volunteer };
```

**4. Allow the new kind in the database.** Add a migration that widens the
check constraint:

```sql
alter table public.certificates drop constraint certificates_kind_check;
alter table public.certificates add constraint certificates_kind_check
  check (kind in ('participation', 'winner', 'membership', 'volunteer'));
```

That is the whole job. The PDF, the download button and the verification page
pick it up automatically.

## Things worth knowing

**It is an SVG, not HTML.** The downloadable PDF is made by converting the
exact element on screen, so what you see is what people get. That means SVG
tags: `<text>` and `<rect>`, not `<p>` and `<div>`, and `fill` instead of
`color`.

**Coordinates are top-down.** The page is 842 × 595 points (A4 landscape).
`y="100"` is 100 points from the *top*.

**Text does not wrap.** SVG has no line breaking. Use a second `<text>` for a
second line, and shrink the font for anything an admin types in — see how
`Participation.svelte` sizes workshop titles.

**Cubano is caps-only.** It is the font for headings. Never set someone's name
in it: "CodeBOT" comes out "CODEBOT". Names and dates use `body`, which the
base component hands you.

**The slot gives you helpers.** `let:W` is the page width (useful for
`x={W / 2}` to centre), and `let:body`, `let:display`, `let:faint` are the
font and colour the rest of the certificate uses, so yours matches.

## Previewing

Sign in, open any certificate from your dashboard, edit the file and save —
the page hot-reloads. Click **Download PDF** to check the real output, since
that is the part people keep.

## Why the PDF is built in the browser

Rendering a Svelte component to a PDF on the server would need a headless
browser. The site runs on Netlify Functions and Cloudflare workerd, and
neither can host one. Converting the SVG in the browser is what lets the
design stay in a `.svelte` file instead of being drawn by hand in code.
