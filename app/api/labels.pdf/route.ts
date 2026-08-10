import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { type NextRequest } from "next/server";
import { listInventoryItems } from "@/src/db/queries";
import { generateBarcodePng } from "@/src/lib/barcodes";
import { errorResponse } from "@/src/lib/http";
import { INVENTORY_META, isInventoryType } from "@/src/lib/inventory";
import { hasApiSession } from "@/src/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  if (!hasApiSession(request)) {
    return errorResponse("Authentication is required.", 401, "UNAUTHORIZED");
  }

  const requestedType = request.nextUrl.searchParams.get("type");
  if (!requestedType || !isInventoryType(requestedType)) {
    return errorResponse("The inventory type is invalid.", 400, "INVALID_TYPE");
  }

  try {
    const items = await listInventoryItems(requestedType);
    const metadata = INVENTORY_META[requestedType];
    const document = await PDFDocument.create();
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 24;
    const columnGap = 12;
    const rowGap = 10;
    const columns = 2;
    const rows = 7;
    const labelWidth = (pageWidth - margin * 2 - columnGap) / columns;
    const labelHeight = (pageHeight - margin * 2 - rowGap * (rows - 1)) / rows;
    const labelsPerPage = columns * rows;
    let page = document.addPage([pageWidth, pageHeight]);

    for (let index = 0; index < items.length; index += 1) {
      if (index > 0 && index % labelsPerPage === 0) {
        page = document.addPage([pageWidth, pageHeight]);
      }

      const pageIndex = index % labelsPerPage;
      const column = pageIndex % columns;
      const row = Math.floor(pageIndex / columns);
      const x = margin + column * (labelWidth + columnGap);
      const y = pageHeight - margin - labelHeight - row * (labelHeight + rowGap);
      const item = items[index];

      page.drawRectangle({
        x,
        y,
        width: labelWidth,
        height: labelHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.8,
      });
      page.drawText(`${metadata.singular}: ${item.size}${metadata.unit}`, {
        x: x + 9,
        y: y + labelHeight - 18,
        size: 11,
        font: bold,
      });
      page.drawText(`Qty: ${item.quantity}`, {
        x: x + labelWidth - 48,
        y: y + labelHeight - 18,
        size: 8,
        font: regular,
      });

      const barcodePng = await generateBarcodePng(item.barcode);
      const barcode = await document.embedPng(new Uint8Array(barcodePng));
      const maximumWidth = labelWidth - 34;
      const maximumHeight = 46;
      const scale = Math.min(maximumWidth / barcode.width, maximumHeight / barcode.height);
      const barcodeWidth = barcode.width * scale;
      const barcodeHeight = barcode.height * scale;
      page.drawImage(barcode, {
        x: x + (labelWidth - barcodeWidth) / 2,
        y: y + 28,
        width: barcodeWidth,
        height: barcodeHeight,
      });
      page.drawText(item.barcode, {
        x: x + 9,
        y: y + 9,
        size: 8,
        font: regular,
      });
    }

    const bytes = await document.save();
    const filename = `${requestedType.toLowerCase()}-labels.pdf`;
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Label PDF generation failed", error);
    return errorResponse("The label PDF could not be generated.", 500, "PDF_FAILED");
  }
}
