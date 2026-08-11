import bwipjs from "@bwip-js/node";
import { normalizeBarcode } from "./inventory";

const BARCODE_PATTERN = /^[A-Z0-9._/-]{1,64}$/;

export function validateBarcode(value: string): string {
  const barcode = normalizeBarcode(value);
  if (!BARCODE_PATTERN.test(barcode)) {
    throw new Error("The barcode contains unsupported characters.");
  }
  return barcode;
}

export async function generateBarcodePng(value: string): Promise<Buffer> {
  const barcode = validateBarcode(value);
  return bwipjs.toBuffer({
    bcid: "code128",
    text: barcode,
    scale: 3,
    height: 12,
    includetext: false,
    paddingwidth: 4,
    paddingheight: 2,
    backgroundcolor: "FFFFFF",
  });
}
