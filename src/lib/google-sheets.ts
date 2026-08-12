import { google } from "googleapis";
import type {
  InventoryItem,
  InventoryType,
} from "@/src/types/inventory";

export interface SheetInventoryRow {
  inventoryType: InventoryType;
  size: number;
  quantity: number;
  barcode: string;
  updatedAt: Date;
  rowNumber: number;
}

const SHEET_NAMES: Record<InventoryType, string> = {
  BELT_9MM: "Belt Inventory 9mm",
  BELT_15MM: "Belt Inventory 15mm",
  GEAR: "Gear Inventory",
  SPROCKET: "Sprocket Inventory",
};

export function sheetNameForType(type: InventoryType): string {
  return SHEET_NAMES[type];
}

function getSpreadsheetId(): string {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("GOOGLE_SPREADSHEET_ID is not configured.");
  }

  return spreadsheetId;
}

function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL is not configured.",
    );
  }

  if (!privateKey) {
    throw new Error("GOOGLE_PRIVATE_KEY is not configured.");
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });

  return google.sheets({
    version: "v4",
    auth,
  });
}

export function parseSheetRow(
  values: string[],
  inventoryType: InventoryType,
  rowNumber = 0,
): SheetInventoryRow | null {
  const [sizeValue, quantityValue, barcodeValue, updatedAtValue] =
    values;

  const size = Number(sizeValue);
  const quantity = Number(quantityValue);
  const barcode = barcodeValue?.trim();
  const timestampText = updatedAtValue?.trim();

  if (!Number.isFinite(size)) {
    return null;
  }

  if (!Number.isInteger(quantity) || quantity < 0) {
    return null;
  }

  if (!barcode) {
    return null;
  }

  if (!timestampText) {
    return null;
  }

  const updatedAt = new Date(timestampText);

  if (Number.isNaN(updatedAt.getTime())) {
    return null;
  }

  return {
    inventoryType,
    size,
    quantity,
    barcode,
    updatedAt,
    rowNumber,
  };
}

export async function readSheetRows(
  type: InventoryType,
): Promise<SheetInventoryRow[]> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const sheetName = sheetNameForType(type);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!A2:D`,
  });

  const rows = response.data.values ?? [];
  const parsedRows: SheetInventoryRow[] = [];

  rows.forEach((row, index) => {
    const values = row.map((value) => String(value));

    const parsed = parseSheetRow(
      values,
      type,
      index + 2,
    );

    if (parsed) {
      parsedRows.push(parsed);
    }
  });

  return parsedRows;
}

export async function writeItemToSheet(
  item: InventoryItem,
): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const sheetName = sheetNameForType(item.inventoryType);

  const barcodeResponse =
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!C2:C`,
    });

  const barcodeRows = barcodeResponse.data.values ?? [];

  const index = barcodeRows.findIndex((row) => {
    const barcode = String(row[0] ?? "").trim();

    return barcode === item.barcode;
  });

  if (index === -1) {
    throw new Error(
      `Barcode ${item.barcode} was not found in ${sheetName}.`,
    );
  }

  const rowNumber = index + 2;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!B${rowNumber}:D${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          item.quantity,
          item.barcode,
          item.updatedAt,
        ],
      ],
    },
  });
}