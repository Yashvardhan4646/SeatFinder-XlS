import * as XLSX from "xlsx";

export interface SeatEntry {
  sno: string;
  admissionNo: string;
  enrollmentNo: string;
  name: string;
  program: string;
  sem: string;
  sec: string;
  subCode: string;
  subjectName: string;
  roomNo: string;
  seatNo: string;
  shiftIndex: number;
  shiftLabel: string;
  shiftTiming: string;
}

export interface ShiftInfo {
  sheet: string;
  label: string;
  timing: string;
}

export interface ParsedWorkbook {
  examId: string;
  shifts: ShiftInfo[];
  entries: SeatEntry[];
}

/** Trim + collapse whitespace, cast any value to a clean string. */
export function normalize(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

const HEADER_PATTERNS: Array<[keyof SeatEntry, RegExp]> = [
  ["sno", /^s\.?\s*no\.?$|^sl\.?\s*no/],
  ["admissionNo", /admission/],
  ["enrollmentNo", /enrollment|roll\s*no/],
  ["name", /student\s*name|^name$/],
  ["program", /program|course|branch/],
  ["sem", /^sem|semester/],
  ["sec", /^sec\b|section/],
  ["subCode", /sub[a-z]*\s*code|paper\s*code/],
  ["subjectName", /sub[a-z]*\s*name|^subject/],
  ["roomNo", /room/],
  ["seatNo", /seat/],
];

function detectHeaderRow(
  rows: string[][],
): { index: number; colMap: Map<number, keyof SeatEntry> } | null {
  for (let i = 0; i < rows.length; i++) {
    const colMap = new Map<number, keyof SeatEntry>();
    rows[i].forEach((cell, c) => {
      const norm = normalize(cell).toLowerCase();
      if (!norm) return;
      for (const [field, re] of HEADER_PATTERNS) {
        if (re.test(norm)) {
          colMap.set(c, field);
          break;
        }
      }
    });
    const detected = new Set(colMap.values());
    if (detected.has("admissionNo") || detected.has("enrollmentNo")) {
      return { index: i, colMap };
    }
  }
  return null;
}

function extractTiming(rows: string[][]): string {
  for (const row of rows) {
    for (const cell of row) {
      const norm = normalize(cell);
      if (!norm) continue;
      // e.g. "SHIFT 1 - TIMINGS : 09.30 AM - 12.30 PM" -> "09.30 AM - 12.30 PM"
      const range = norm.match(
        /\d{1,2}[:.]\d{2}\s*(?:am|pm)?\s*(?:[-–]|to)\s*\d{1,2}[:.]\d{2}\s*(?:am|pm)/i,
      );
      if (range) return range[0];
    }
  }
  return "";
}

export function shiftNumber(label: string): string {
  const m = label.match(/shift\s*-?\s*(\d+)/i);
  return m ? `Shift ${m[1]}` : label;
}

export function parseSeatingWorkbook(
  examId: string,
  buffer: ArrayBuffer | Uint8Array | ArrayBufferView,
): ParsedWorkbook {
  if (!buffer) {
    return { examId, shifts: [], entries: [] };
  }
  const data =
    buffer instanceof Uint8Array
      ? buffer
      : buffer instanceof ArrayBuffer
        ? new Uint8Array(buffer)
        : ArrayBuffer.isView(buffer)
          ? new Uint8Array(
              (buffer as ArrayBufferView).buffer,
              (buffer as ArrayBufferView).byteOffset,
              (buffer as ArrayBufferView).byteLength,
            )
          : new Uint8Array(buffer as unknown as ArrayBuffer);
  const wb = XLSX.read(data, { type: "array" });
  const shifts: ShiftInfo[] = [];
  const entries: SeatEntry[] = [];

  wb.SheetNames.forEach((sheetName, shiftIndex) => {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) return;
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    }) as unknown as string[][];

    const header = detectHeaderRow(rows);
    if (!header) return;

    const timing = extractTiming(rows.slice(0, header.index));
    shifts.push({ sheet: sheetName, label: sheetName, timing });

    for (let r = header.index + 1; r < rows.length; r++) {
      const row = rows[r];
      const entry: SeatEntry = {
        sno: "",
        admissionNo: "",
        enrollmentNo: "",
        name: "",
        program: "",
        sem: "",
        sec: "",
        subCode: "",
        subjectName: "",
        roomNo: "",
        seatNo: "",
        shiftIndex,
        shiftLabel: sheetName,
        shiftTiming: timing,
      };
      header.colMap.forEach((field, c) => {
        entry[field] = normalize(row[c]) as never;
      });
      if (
        !entry.enrollmentNo &&
        !entry.admissionNo &&
        !entry.name &&
        !entry.roomNo
      ) {
        continue;
      }
      entries.push(entry);
    }
  });

  return { examId, shifts, entries };
}

/* ---------- Search & matching ---------- */

export function normalizeQuery(query: string): string {
  return normalize(query).toLowerCase();
}

/**
 * Roll / admission number matches (exact or partial) take priority;
 * otherwise fall back to a tokenized substring match on the name.
 */
export function searchEntries(query: string, entries: SeatEntry[]): SeatEntry[] {
  const q = normalizeQuery(query);
  if (q.length < 2) return [];
  const rollMatches = entries.filter(
    (e) =>
      normalize(e.enrollmentNo).toLowerCase().includes(q) ||
      normalize(e.admissionNo).toLowerCase().includes(q),
  );
  if (rollMatches.length > 0) return rollMatches;
  return entries.filter((e) => normalize(e.name).toLowerCase().includes(q));
}

export interface StudentGroup {
  key: string;
  entries: SeatEntry[];
}

/** Bucket entries by student identity; each group's entries sorted by shift then S.No. */
export function groupByStudent(entries: SeatEntry[]): StudentGroup[] {
  const map = new Map<string, SeatEntry[]>();
  for (const e of entries) {
    const key =
      normalize(e.admissionNo) ||
      normalize(e.enrollmentNo) ||
      normalize(e.name).toLowerCase();
    const bucket = map.get(key);
    if (bucket) bucket.push(e);
    else map.set(key, [e]);
  }
  const groups = [...map.entries()].map(([key, list]) => ({
    key,
    entries: list.sort(
      (a, b) =>
        a.shiftIndex - b.shiftIndex ||
        normalize(a.sno).localeCompare(normalize(b.sno), undefined, {
          numeric: true,
        }),
    ),
  }));
  groups.sort((a, b) =>
    normalize(a.entries[0]?.name).localeCompare(normalize(b.entries[0]?.name)),
  );
  return groups;
}
