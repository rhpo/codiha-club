/**
 * @types/qrcode only declares the package root, which we deliberately avoid:
 * the root pulls in `fs` via qrcode/lib/server, and the SSR function also runs
 * on Cloudflare's workerd runtime where `fs` does not exist.
 *
 * Only the two members the certificate renderer touches are declared.
 */
declare module "qrcode/lib/core/qrcode.js" {
  interface BitMatrix {
    /** Width and height in modules, including no quiet zone. */
    readonly size: number;
    /** True when the module at (row, col) is dark. Row 0 is the top row. */
    get(row: number, col: number): boolean;
  }

  export function create(
    data: string,
    options?: { errorCorrectionLevel?: "L" | "M" | "Q" | "H"; version?: number }
  ): { modules: BitMatrix };
}
