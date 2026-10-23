import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parseSeatingWorkbook, shiftNumber } from "../lib/seating";

function buildSampleWorkbook(): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const rows: string[][] = [
    ["Galgotias University EXAMINATION SEATING PLAN"],
    ["Date of Exam: 23rd OCTOBER 2026"],
    ["SHIFT 2 - TIMINGS : 01.00 PM - 04.00 PM"],
    [""],
    ["S. No.", "Admission No.", "Enrollment No.", "Name", "Program", "Sem", "Sec", "Sub Code", "Subject Name", "Room No.", "Seat No."],
    ["1", "ADM23CSE101", "23CSE1001", "Rahul Sharma", "B.Tech CSE", "4", "A", "CSE201", "Data Structures", "R-101", "7"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "23 October2026 (Shift-2)");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  if (out instanceof ArrayBuffer) return out;
  if (ArrayBuffer.isView(out)) {
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  }
  return new Uint8Array(out).buffer;
}

describe("parseSeatingWorkbook", () => {
  it("locates the header row dynamically and extracts shift metadata", () => {
    const wb = parseSeatingWorkbook("2026-10-23", buildSampleWorkbook());
    expect(wb.shifts).toHaveLength(1);
    expect(wb.shifts[0]!.label).toBe("23 October2026 (Shift-2)");
    expect(wb.shifts[0]!.timing).toBe("01.00 PM - 04.00 PM");
    expect(wb.entries).toHaveLength(1);
    const e = wb.entries[0]!;
    expect(e.enrollmentNo).toBe("23CSE1001");
    expect(e.admissionNo).toBe("ADM23CSE101");
    expect(e.name).toBe("Rahul Sharma");
    expect(e.roomNo).toBe("R-101");
    expect(e.seatNo).toBe("7");
    expect(e.shiftTiming).toBe("01.00 PM - 04.00 PM");
  });

  it("maps sheet names to readable shift labels", () => {
    expect(shiftNumber("23 October2026 (Shift-2)")).toBe("Shift 2");
  });
});
