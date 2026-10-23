import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Clock3,
  Code2,
  Copy,
  DoorOpen,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Filter,
  GitBranch,
  Github,
  GitPullRequest,
  GraduationCap,
  Heart,
  HelpCircle,
  Info,
  Keyboard,
  Layers,
  Loader2,
  MapPin,
  Maximize2,
  Printer,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  Terminal,
  Upload,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  groupByStudent,
  normalize,
  parseSeatingWorkbook,
  searchEntries,
  shiftNumber,
  type ParsedWorkbook,
  type SeatEntry,
  type StudentGroup,
} from "@/lib/seating";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Exam Seating Finder — Made by Yashvardhan" },
      {
        name: "description",
        content:
          "Unofficial university examination hall and seat number lookup portal created by Yashvardhan. Search the seating plan instantly by roll number, admission number, or name.",
      },
      {
        property: "og:title",
        content: "Exam Seating Finder — Made by Yashvardhan",
      },
      {
        property: "og:description",
        content:
          "Unofficial university examination seating plan finder made by Yashvardhan. Instant room and desk allocations without scrolling spreadsheets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

interface ExamMeta {
  id: string;
  label: string;
  file: string;
}

const QUICK_LOOKUPS = [
  {
    label: "Praveen",
    query: "24131040494",
    type: "Roll No",
    detail: "Room C102 · Shift 1",
  },
  {
    label: "Aadil Noor",
    query: "AADIL NOOR",
    type: "2 Shifts",
    detail: "Rooms A401 & B004",
  },
  {
    label: "Aman Sharma",
    query: "24SCSE1040320",
    type: "Adm No",
    detail: "B.Tech CSE",
  },
  {
    label: "Krish Kumar",
    query: "24131040349",
    type: "Seat 3C",
    detail: "Shift 1",
  },
];

function Index() {
  const [exams, setExams] = useState<ExamMeta[]>([]);
  const [examsError, setExamsError] = useState<string | null>(null);
  const [examId, setExamId] = useState("");
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null);
  const [loadingExam, setLoadingExam] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [shiftFilter, setShiftFilter] = useState<string>("ALL");
  const [showContributeModal, setShowContributeModal] = useState(false);

  const cache = useRef(new Map<string, ParsedWorkbook>());
  const searchRef = useRef<HTMLInputElement>(null);

  // URL parameter sync (?q=... and ?contribute=1)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlQ = params.get("q");
      if (urlQ) {
        setQuery(urlQ);
      }
      if (params.get("contribute") === "1" || params.get("contribute") === "true") {
        setShowContributeModal(true);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (query.trim()) {
        url.searchParams.set("q", query.trim());
      } else {
        url.searchParams.delete("q");
      }
      window.history.replaceState(null, "", url.toString());
    }
  }, [query]);

  // Load exam metadata catalog
  useEffect(() => {
    fetch("/data/exams.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ExamMeta[]>;
      })
      .then((data) => {
        setExams(data);
        if (data[0]) setExamId(data[0].id);
      })
      .catch(() =>
        setExamsError("Could not load exam catalog. Please reload the page."),
      );
  }, []);

  // Fetch and parse seating workbook
  useEffect(() => {
    if (!examId) return;
    const cached = cache.current.get(examId);
    if (cached) {
      setParsed(cached);
      setExamError(null);
      return;
    }
    const exam = exams.find((e) => e.id === examId);
    if (!exam || !exam.file) return;

    let cancelled = false;
    setLoadingExam(true);
    setExamError(null);
    setParsed(null);

    fetch(exam.file)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => {
        if (cancelled) return;
        const wb = parseSeatingWorkbook(examId, buf);
        cache.current.set(examId, wb);
        setParsed(wb);
      })
      .catch(() => {
        if (!cancelled)
          setExamError(
            "Could not load the seating workbook. Please verify your connection.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingExam(false);
      });

    return () => {
      cancelled = true;
    };
  }, [examId, exams]);

  // Handle custom excel upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const customId = `custom-${Date.now()}`;
    const customLabel = file.name.replace(/\.[^/.]+$/, "");
    setLoadingExam(true);
    setExamError(null);
    setParsed(null);

    file
      .arrayBuffer()
      .then((buf) => {
        const wb = parseSeatingWorkbook(customId, buf);
        if (wb.entries.length === 0) {
          setExamError(
            "No seating records found in uploaded file. Check headers.",
          );
          return;
        }
        cache.current.set(customId, wb);
        setExams((prev) => [
          { id: customId, label: `Custom: ${customLabel}`, file: "" },
          ...prev,
        ]);
        setExamId(customId);
        setParsed(wb);
        toast.success(
          `Loaded ${wb.entries.length.toLocaleString()} seating entries!`,
        );
      })
      .catch(() => {
        setExamError("Could not parse the uploaded Excel file.");
      })
      .finally(() => {
        setLoadingExam(false);
      });
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (
        (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) &&
        tag !== "INPUT" &&
        tag !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (e.key === "Escape") {
        setShowContributeModal(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Reset selected student on query change
  useEffect(() => setSelectedKey(null), [query, examId]);

  // Compute matched entries
  const results = useMemo(() => {
    if (!parsed) return [];
    const matched = searchEntries(query, parsed.entries);
    if (shiftFilter === "ALL") return matched;
    return matched.filter((e) => shiftNumber(e.shiftLabel) === shiftFilter);
  }, [parsed, query, shiftFilter]);

  const groups = useMemo(() => groupByStudent(results), [results]);

  const activeExam = exams.find((e) => e.id === examId);
  const active = query.trim().length >= 2;
  const activeGroup = selectedKey
    ? groups.find((g) => g.key === selectedKey)
    : undefined;
  const group = groups.length === 1 ? groups[0] : activeGroup;
  const showTable = active && groups.length > 1 && !activeGroup;

  // Detect query type helper
  const queryTypeBadge = useMemo(() => {
    const q = query.trim();
    if (!q) return null;
    if (/^\d{6,}$/.test(q))
      return { label: "Searching Roll Number", color: "bg-indigo-50 text-indigo-700 border-indigo-200" };
    if (/^\d{2}[A-Za-z]{2,}/i.test(q))
      return { label: "Searching Admission No", color: "bg-blue-50 text-blue-700 border-blue-200" };
    return { label: "Searching Candidate Name", color: "bg-zinc-100 text-zinc-700 border-zinc-200" };
  }, [query]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0F172A] selection:bg-indigo-600 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Brand & Author */}
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#0F172A] text-white font-extrabold text-xs tracking-wider">
              SF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-[#0F172A]">
                  SeatingFinder
                </span>
                <span className="rounded-md border border-[#E2E8F0] bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-mono font-bold text-[#334155]">
                  by Yashvardhan
                </span>
                <span className="hidden md:inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  <span className="size-1.5 rounded-full bg-amber-600 animate-pulse" />
                  Unofficial Student Portal
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] hidden sm:block">
                Ultra-fast exam room & desk allocation finder
              </p>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2.5">
            {/* Want to contribute button for devs */}
            <button
              type="button"
              id="contribute-header-btn"
              onClick={() => setShowContributeModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors cursor-pointer"
            >
              <GitPullRequest className="size-3.5 text-indigo-600" />
              <span>Want to contribute?</span>
              <span className="hidden sm:inline-block rounded bg-indigo-200/80 px-1 text-[9px] font-mono text-indigo-800 font-bold">
                DEV
              </span>
            </button>

            {/* Record Counter Pill */}
            {parsed && (
              <div className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs font-bold text-[#334155]">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>{parsed.entries.length.toLocaleString()} Records</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-0.5 text-xs font-bold text-indigo-700">
              <Sparkles className="size-3 text-indigo-600" />
              Mid-Term Seating Arrangements 2026–27
            </span>
            <span className="text-xs text-[#94A3B8]">·</span>
            <span className="text-xs text-[#64748B] font-semibold">
              Independent Student Utility
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#0F172A] leading-tight">
            Find your exam desk in a split second.
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[#475569] max-w-3xl leading-relaxed">
            Built by <strong className="text-[#0F172A] font-bold">Yashvardhan</strong> so you never have to pinch-to-zoom through 100-page PDF spreadsheets right outside the hall. Type your roll number, admission number, or name below.
          </p>

          {/* Quick Demo Lookups */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] mr-1">
              Quick demo:
            </span>
            {QUICK_LOOKUPS.map((item) => (
              <button
                key={item.query}
                type="button"
                onClick={() => {
                  setQuery(item.query);
                  setSelectedKey(null);
                  searchRef.current?.focus();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-bold text-[#1E293B] hover:border-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer"
              >
                <span>{item.label}</span>
                <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-mono text-[#64748B]">
                  {item.detail}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Command Search Console */}
        <div className="rounded-2xl border border-[#CBD5E1] bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search Input Box */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                id="student-search-input"
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setQuery("");
                }}
                placeholder="Type Roll No (e.g. 24131040494), Admission No, or Name…"
                autoComplete="off"
                spellCheck={false}
                className="h-12 w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] pl-10 pr-24 font-mono text-sm font-bold text-[#0F172A] outline-none placeholder:font-sans placeholder:font-normal placeholder:text-[#94A3B8] focus:border-indigo-600 focus:bg-white focus:ring-1 focus:ring-indigo-600"
              />

              <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      searchRef.current?.focus();
                    }}
                    className="rounded-md bg-[#E2E8F0] p-1 text-[#475569] hover:bg-[#CBD5E1] hover:text-[#0F172A] cursor-pointer"
                    title="Clear query (Esc)"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
                <kbd className="hidden sm:inline-block rounded border border-[#CBD5E1] bg-[#E2E8F0] px-1.5 py-0.5 text-[10px] font-mono font-bold text-[#475569]">
                  /
                </kbd>
              </div>
            </div>

            {/* Exam Catalog Selector */}
            <div className="w-full sm:w-52">
              <select
                id="exam-catalog-select"
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                className="h-12 w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-xs font-bold text-[#1E293B] outline-none focus:border-indigo-600 focus:bg-white focus:ring-1 focus:ring-indigo-600 cursor-pointer"
              >
                {exams.map((e) => (
                  <option key={e.id} value={e.id}>
                    📅 {e.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Upload Custom Excel Button */}
            <div>
              <label
                className="btn-velvet-secondary inline-flex h-12 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold whitespace-nowrap"
                title="Upload another spreadsheet (.xls / .xlsx)"
              >
                <Upload className="size-3.5 text-[#64748B]" />
                <span>Upload Custom Excel</span>
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  className="sr-only"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>

          {/* Active Query Detection Chip & Shift Filter Pills */}
          <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
            {/* Shift Tabs */}
            {parsed && parsed.shifts.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider mr-1 flex items-center gap-1">
                  <Layers className="size-3.5 text-indigo-600" />
                  Shift:
                </span>
                <button
                  type="button"
                  onClick={() => setShiftFilter("ALL")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    shiftFilter === "ALL"
                      ? "bg-[#0F172A] text-white"
                      : "bg-[#F1F5F9] text-[#334155] border border-[#E2E8F0] hover:bg-[#E2E8F0]"
                  }`}
                >
                  All Shifts ({parsed.entries.length.toLocaleString()})
                </button>
                {parsed.shifts.map((s) => {
                  const label = shiftNumber(s.label);
                  const count = parsed.entries.filter(
                    (e) => shiftNumber(e.shiftLabel) === label,
                  ).length;
                  const isSelected = shiftFilter === label;
                  return (
                    <button
                      key={s.sheet}
                      type="button"
                      onClick={() => setShiftFilter(label)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "bg-[#F1F5F9] text-[#334155] border border-[#E2E8F0] hover:bg-[#E2E8F0]"
                      }`}
                    >
                      <span>{label}</span>
                      <span className="ml-1 text-[10px] opacity-75">
                        ({count.toLocaleString()})
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* Search Type Detector */}
            {queryTypeBadge && (
              <div
                className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-bold ${queryTypeBadge.color}`}
              >
                <span>{queryTypeBadge.label}</span>
              </div>
            )}
          </div>
        </div>

        {/* Results / Seating Pass Presentation */}
        <section className="mt-8" aria-live="polite">
          {examsError ? (
            <div className="rounded-2xl border border-red-300 bg-red-50 p-5 text-red-900">
              <div className="flex items-center gap-2 font-bold text-sm text-red-800">
                <AlertCircle className="size-4 text-red-600" />
                <span>Error loading exams</span>
              </div>
              <p className="mt-1 text-xs text-red-700">{examsError}</p>
            </div>
          ) : loadingExam ? (
            <div className="rounded-2xl border border-indigo-200 bg-white p-12 text-center text-indigo-950">
              <Loader2 className="mx-auto size-8 animate-spin text-indigo-600" />
              <h3 className="mt-4 text-base font-extrabold text-[#0F172A]">
                Reading Seating Plan & Parsing Candidate Allocations…
              </h3>
              <p className="mt-1 text-xs text-[#64748B]">
                Processing 30,000+ student records in-browser. Fast & private.
              </p>
            </div>
          ) : examError ? (
            <div className="rounded-2xl border border-red-300 bg-red-50 p-5 text-red-900">
              <div className="flex items-center gap-2 font-bold text-sm text-red-800">
                <AlertCircle className="size-4 text-red-600" />
                <span>Could not load seating plan</span>
              </div>
              <p className="mt-1 text-xs text-red-700">{examError}</p>
            </div>
          ) : !parsed ? (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center text-[#64748B]">
              <Loader2 className="mx-auto size-6 animate-spin text-[#94A3B8]" />
              <p className="mt-2 text-sm font-semibold">Loading workbook data…</p>
            </div>
          ) : !active ? (
            /* Empty Search State */
            <div className="rounded-2xl border border-[#CBD5E1] bg-white p-12 sm:p-16 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Search className="size-7" />
              </div>
              <h2 className="mt-4 text-lg font-black text-[#0F172A]">
                Enter your details to reveal your exam desk
              </h2>
              <p className="mt-1.5 text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
                Type your 11-digit Roll Number, Admission Number, or Name into the search box above. Or click any of the sample quick pills.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2 text-[11px] text-[#475569]">
                <span className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1">
                  ⚡ 30,311 Total Students
                </span>
                <span className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1">
                  🏫 Blocks A, B, C & Audi
                </span>
                <span className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1">
                  🕒 4 Exam Shifts
                </span>
              </div>
            </div>
          ) : groups.length === 0 ? (
            /* No Results Found State */
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
                <AlertCircle className="size-5 text-amber-700" />
                <span>No candidate found for “{query.trim()}”</span>
              </div>
              <p className="mt-1.5 text-xs text-amber-800 leading-relaxed">
                Check for typing errors, try searching by just the Roll Number or partial Name, or ensure the shift filter is set to <strong>All Shifts</strong>.
              </p>
            </div>
          ) : (
            /* Result Found: Ticket Pass & Optional Candidate Table */
            <div className="space-y-6">
              {group && (
                <SeatingCard
                  key={group.key}
                  group={group}
                  dateLabel={activeExam?.label ?? ""}
                />
              )}

              {showTable && (
                <CandidateTable
                  groups={groups}
                  query={query.trim()}
                  onPick={setSelectedKey}
                />
              )}
            </div>
          )}
        </section>

        {/* Developer Contribution Banner */}
        <section className="mt-12 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex size-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
                  <Code2 className="size-4" />
                </span>
                <h3 className="text-base font-extrabold text-[#0F172A]">
                  Are you a developer? Help improve SeatingFinder!
                </h3>
              </div>
              <p className="mt-1.5 text-xs text-[#475569] max-w-2xl leading-relaxed">
                This project was created by <strong className="text-[#0F172A]">Yashvardhan</strong> to help fellow university students. We are adding screenshot OCR, hall directions, and offline PWA support. Everyone is welcome to contribute!
              </p>
            </div>

            <button
              type="button"
              id="contribute-banner-btn"
              onClick={() => setShowContributeModal(true)}
              className="btn-velvet-indigo inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold whitespace-nowrap cursor-pointer shrink-0"
            >
              <GitPullRequest className="size-4" />
              <span>Want to contribute?</span>
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-[#E2E8F0] bg-white py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64748B]">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#0F172A]">SeatingFinder</span>
            <span>·</span>
            <span>
              Crafted by <strong className="text-[#0F172A] font-bold">Yashvardhan</strong> for students
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowContributeModal(true)}
              className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <GitPullRequest className="size-3.5" />
              <span>Want to contribute?</span>
            </button>
            <span>·</span>
            <a
              href="https://github.com/Yashvardhan4646/screenshot-match"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#0F172A] flex items-center gap-1 transition-colors"
            >
              <Github className="size-3.5" />
              <span>GitHub</span>
            </a>
            <span>·</span>
            <span className="text-[#94A3B8]">Unofficial Portal</span>
          </div>
        </div>
      </footer>

      {/* Developer Contribution Modal */}
      {showContributeModal && (
        <ContributeModal onClose={() => setShowContributeModal(false)} />
      )}
    </div>
  );
}

/**
 * SeatingCard - Boarding Pass Style Seating Ticket
 * High contrast, zero shadows, clean velvet badges, realistic perforated divider.
 */
function SeatingCard({
  group,
  dateLabel,
}: {
  group: StudentGroup;
  dateLabel: string;
}) {
  const [idx, setIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const entry = group.entries[Math.min(idx, group.entries.length - 1)]!;
  const multi = group.entries.length > 1;

  const handleCopy = () => {
    const text = `EXAM SEATING PASS (By Yashvardhan)\n---------------------------------\nDate: ${dateLabel}\nCandidate: ${entry.name}\nRoll No: ${entry.enrollmentNo}\nAdmission No: ${entry.admissionNo}\nProgram: ${entry.program}\nRoom No: ${entry.roomNo}\nDesk / Seat No: ${entry.seatNo}\nShift: ${shiftNumber(entry.shiftLabel)} (${entry.shiftTiming})\nSubject Code: ${entry.subCode}\nSubject Name: ${entry.subjectName || "—"}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    toast.success("Seating pass copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const text = `Exam Seating Pass (By Yashvardhan)\nCandidate: ${entry.name}\nRoom: ${entry.roomNo}\nSeat: ${entry.seatNo}\nShift: ${shiftNumber(entry.shiftLabel)} (${entry.shiftTiming})\nDate: ${dateLabel}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Exam Seat: ${entry.name} · Room ${entry.roomNo}`,
          text,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="seating-pass-card rounded-2xl border-2 border-[#0F172A] bg-white overflow-hidden relative">
      {/* Top Pass Ribbon */}
      <div className="border-b-2 border-[#0F172A] bg-[#0F172A] px-5 py-3 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-2 rounded-full bg-emerald-400" />
          <span className="text-xs font-black uppercase tracking-wider text-white">
            Official Candidate Seating Pass
          </span>
          <span className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
            by Yashvardhan
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E293B] px-2.5 py-1 text-xs font-semibold text-[#E2E8F0]">
            <CalendarDays className="size-3.5 text-indigo-400" />
            <span>{dateLabel}</span>
            <span className="text-[#64748B]">·</span>
            <span className="text-white font-bold">{shiftNumber(entry.shiftLabel)}</span>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="btn-velvet-secondary inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer"
            title="Copy pass text to clipboard"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5 text-[#475569]" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="btn-velvet-secondary inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer"
            title="Share pass"
          >
            <Share2 className="size-3.5 text-[#475569]" />
            <span className="hidden sm:inline">Share</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="btn-velvet-indigo inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold cursor-pointer"
            title="Print this pass"
          >
            <Printer className="size-3.5" />
            <span>Print Pass</span>
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        {/* Hero Allocations (Room & Desk) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Room Number Hero Card */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                  <DoorOpen className="size-4 text-indigo-700" />
                  Room Number
                </span>
                <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  Exam Hall
                </span>
              </div>
              <div className="mt-3 font-mono text-5xl sm:text-6xl font-black text-indigo-800 tracking-tight">
                {entry.roomNo || "—"}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-indigo-200/80 flex items-center justify-between text-xs text-indigo-900 font-semibold">
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5 text-indigo-600" />
                {entry.roomNo.startsWith("A")
                  ? "Block A · Academic Building"
                  : entry.roomNo.startsWith("B")
                  ? "Block B · Academic Building"
                  : entry.roomNo.startsWith("C")
                  ? "Block C · Academic Building"
                  : "Examination Hall Wing"}
              </span>
              <span className="text-[11px] text-indigo-700">Check Hall Door</span>
            </div>
          </div>

          {/* Seat Number Hero Card */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  <User className="size-4 text-emerald-700" />
                  Allocated Desk / Seat
                </span>
                <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  Assigned Seat
                </span>
              </div>
              <div className="mt-3 font-mono text-5xl sm:text-6xl font-black text-emerald-800 tracking-tight">
                {entry.seatNo || "—"}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-emerald-200/80 flex items-center justify-between text-xs text-emerald-900 font-semibold">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                Desk labeled with your roll number
              </span>
              <span className="text-[11px] text-emerald-700 font-mono">
                DESK #{entry.seatNo}
              </span>
            </div>
          </div>
        </div>

        {/* Perforated Divider with Notches */}
        <div className="relative my-7 flex items-center">
          <div className="ticket-notch-left" />
          <div className="w-full border-t-2 border-dashed border-[#CBD5E1]" />
          <div className="ticket-notch-right" />
        </div>

        {/* Candidate Information Architectural Table */}
        <div className="border border-[#CBD5E1] rounded-xl overflow-hidden">
          <div className="bg-[#F1F5F9] px-4 py-2.5 border-b border-[#CBD5E1] flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-[#334155]">
              Candidate Particulars & Schedule
            </span>
            <span className="text-xs font-mono font-bold text-[#64748B]">
              {entry.sno ? `Serial Record #${entry.sno}` : "Student Verified"}
            </span>
          </div>

          <div className="grid grid-cols-2 divide-x divide-y divide-[#E2E8F0] sm:grid-cols-4 bg-white">
            <PassField
              label="Student Name"
              value={normalize(entry.name)}
              isPrimary
            />
            <PassField
              label="Roll / Enrollment No"
              value={entry.enrollmentNo || "—"}
              isMono
              badge="ROLL"
            />
            <PassField
              label="Admission Number"
              value={entry.admissionNo || "—"}
              isMono
            />
            <PassField
              label="Program / Branch"
              value={entry.program || "—"}
            />
            <PassField
              label="Semester"
              value={entry.sem ? `Sem ${entry.sem}` : "—"}
              isMono
            />
            <PassField
              label="Section"
              value={entry.sec ? `Sec ${entry.sec}` : "—"}
              isMono
            />
            <PassField
              label="Paper / Subject Code"
              value={entry.subCode || "—"}
              isMono
              isHighlight
            />
            <PassField
              label="Shift Schedule"
              value={`${shiftNumber(entry.shiftLabel)} (${entry.shiftTiming || "Regular"})`}
              isHighlight
            />
          </div>
        </div>

        {/* Multi-Shift Switcher for students with multiple exams on same day */}
        {multi && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                <Clock3 className="size-4 text-amber-700" />
                Multiple Shifts Assigned Today ({group.entries.length} Papers)
              </span>
              <span className="text-xs text-amber-800 font-semibold">
                Select shift to switch view:
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {group.entries.map((e, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIdx(i)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                    i === idx
                      ? "bg-[#0F172A] text-white"
                      : "border border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
                  }`}
                >
                  <Clock3 className="size-3.5" />
                  <span>{shiftNumber(e.shiftLabel)}</span>
                  {e.shiftTiming && (
                    <span className="text-[10px] opacity-75">
                      ({e.shiftTiming})
                    </span>
                  )}
                  {e.roomNo && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                        i === idx
                          ? "bg-indigo-600 text-white"
                          : "bg-amber-200 text-amber-950"
                      }`}
                    >
                      Room {e.roomNo} · Seat {e.seatNo}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PassField({
  label,
  value,
  isMono,
  isPrimary,
  isHighlight,
  badge,
}: {
  label: string;
  value: string;
  isMono?: boolean;
  isPrimary?: boolean;
  isHighlight?: boolean;
  badge?: string;
}) {
  return (
    <div className={`p-3.5 sm:p-4 ${isHighlight ? "bg-indigo-50/40" : "bg-white"}`}>
      <div className="flex items-center justify-between">
        <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748B]">
          {label}
        </dt>
        {badge && (
          <span className="rounded bg-[#E2E8F0] px-1 py-0.2 text-[9px] font-mono font-bold text-[#475569]">
            {badge}
          </span>
        )}
      </div>
      <dd
        className={`mt-1 truncate font-bold ${
          isPrimary
            ? "text-base font-black text-[#0F172A]"
            : isHighlight
            ? "text-sm text-indigo-950 font-black"
            : "text-xs sm:text-sm text-[#1E293B]"
        } ${isMono ? "font-mono font-bold tracking-tight" : ""}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * CandidateTable - High density matching student list
 */
function CandidateTable({
  groups,
  query,
  onPick,
}: {
  groups: StudentGroup[];
  query: string;
  onPick: (key: string) => void;
}) {
  const MAX_DISPLAY = 80;
  const displayed = groups.slice(0, MAX_DISPLAY);

  const getShiftBadge = (shiftLabel: string) => {
    const s = shiftNumber(shiftLabel);
    if (s.includes("1")) return "bg-blue-50 text-blue-800 border-blue-200";
    if (s.includes("2")) return "bg-emerald-50 text-emerald-800 border-emerald-200";
    if (s.includes("3")) return "bg-amber-50 text-amber-800 border-amber-200";
    return "bg-purple-50 text-purple-800 border-purple-200";
  };

  return (
    <div className="rounded-2xl border border-[#CBD5E1] bg-white overflow-hidden">
      <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A]">
            Matching Candidates ({groups.length.toLocaleString()})
          </h3>
          <p className="text-xs text-[#64748B]">
            Multiple students match your search. Click any row to reveal the full seating pass.
          </p>
        </div>
        <span className="text-xs font-bold text-indigo-600">
          Showing top {displayed.length} results
        </span>
      </div>

      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 border-b border-[#CBD5E1] bg-[#F1F5F9] text-[11px] font-black uppercase tracking-wider text-[#334155]">
            <tr>
              <th className="px-4 py-3">Candidate Name</th>
              <th className="px-4 py-3">Roll No</th>
              <th className="px-4 py-3">Admission No</th>
              <th className="px-4 py-3">Program</th>
              <th className="px-4 py-3">Sem</th>
              <th className="px-4 py-3">Shift</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Seat</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {displayed.map((g, i) => {
              const e = g.entries[0]!;
              const multi = g.entries.length > 1;
              return (
                <tr
                  key={g.key}
                  onClick={() => onPick(g.key)}
                  className={`group cursor-pointer transition-colors hover:bg-indigo-50/70 ${
                    i % 2 === 1 ? "bg-[#F8FAFC]/60" : "bg-white"
                  }`}
                >
                  <td className="px-4 py-3 font-bold text-[#0F172A]">
                    <div className="flex items-center gap-1.5">
                      <span>{normalize(e.name)}</span>
                      {multi && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-900 border border-amber-300">
                          {g.entries.length} shifts
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                    {e.enrollmentNo || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-[#475569]">
                    {e.admissionNo || "—"}
                  </td>
                  <td className="px-4 py-3 text-[#475569]">{e.program || "—"}</td>
                  <td className="px-4 py-3 font-mono text-[#475569]">{e.sem || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold ${getShiftBadge(
                        e.shiftLabel,
                      )}`}
                    >
                      {shiftNumber(e.shiftLabel)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-black text-indigo-700 text-sm">
                    {e.roomNo || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono font-black text-emerald-700 text-sm">
                    {e.seatNo || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center rounded-lg border border-indigo-600 bg-white px-2.5 py-1 text-[11px] font-bold text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      View Pass →
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3 text-xs text-[#64748B] flex items-center justify-between">
        <span>
          {groups.length > MAX_DISPLAY
            ? `Showing first ${MAX_DISPLAY} of ${groups.length.toLocaleString()} matches. Type more characters to narrow down.`
            : `${groups.length.toLocaleString()} candidate${
                groups.length === 1 ? "" : "s"
              } matching “${query}”.`}
        </span>
        <span className="font-bold text-indigo-600">
          Click any candidate to open ticket
        </span>
      </div>
    </div>
  );
}

/**
 * ContributeModal - Developer Contribution Hub
 */
function ContributeModal({ onClose }: { onClose: () => void }) {
  const [copiedClone, setCopiedClone] = useState(false);
  const repoUrl = "https://github.com/Yashvardhan4646/screenshot-match";
  const cloneCmd = `git clone ${repoUrl}.git`;

  const copyClone = () => {
    navigator.clipboard?.writeText(cloneCmd);
    setCopiedClone(true);
    toast.success("Clone command copied to clipboard!");
    setTimeout(() => setCopiedClone(false), 2000);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0F172A]/70 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border-2 border-[#0F172A] bg-white p-5 sm:p-6 relative max-h-[95vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg bg-[#F1F5F9] p-1.5 text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors cursor-pointer"
          title="Close modal (Esc)"
        >
          <X className="size-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-3.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-[#0F172A] text-white shrink-0">
            <Github className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-[#0F172A]">
                Want to contribute?
              </h2>
              <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                Open Source
              </span>
            </div>
            <p className="text-xs text-[#64748B]">
              Created by <strong className="text-[#0F172A]">Yashvardhan</strong> · Pull requests & feature ideas welcome!
            </p>
          </div>
        </div>

        {/* Motivation note */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-950 mb-4 leading-relaxed">
          <p>
            <strong>Why this was built:</strong> University seating arrangements are published as multi-sheet spreadsheets with tens of thousands of rows. Outside exam halls, students struggle with slow internet or cramped phones. This tool delivers instant search with zero latency.
          </p>
        </div>

        {/* Planned Roadmap & Contribution Ideas */}
        <div className="mb-4 space-y-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-[#64748B]">
            Exciting areas to contribute:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2.5">
              <span className="font-bold text-[#0F172A] flex items-center gap-1.5">
                📸 Screenshot OCR Matcher
              </span>
              <p className="mt-0.5 text-[11px] text-[#64748B] leading-tight">
                Upload or paste a screenshot of your roll number or admit card to automatically highlight your desk.
              </p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2.5">
              <span className="font-bold text-[#0F172A] flex items-center gap-1.5">
                🗺️ Campus Hall Navigator
              </span>
              <p className="mt-0.5 text-[11px] text-[#64748B] leading-tight">
                Interactive floor maps for Blocks A, B, and C with stair & elevator wayfinding.
              </p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2.5">
              <span className="font-bold text-[#0F172A] flex items-center gap-1.5">
                📱 Offline PWA & Pass
              </span>
              <p className="mt-0.5 text-[11px] text-[#64748B] leading-tight">
                Save your pass to home screen or phone lockscreen for zero-network exam hall lobbies.
              </p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2.5">
              <span className="font-bold text-[#0F172A] flex items-center gap-1.5">
                ⚡ Multi-Day Timetable
              </span>
              <p className="mt-0.5 text-[11px] text-[#64748B] leading-tight">
                Support full mid-term & end-term schedule calendar sync with live shift countdowns.
              </p>
            </div>
          </div>
        </div>

        {/* 1-Click Terminal Clone */}
        <div className="mb-4">
          <label className="block text-[11px] font-black uppercase tracking-wider text-[#64748B] mb-1">
            Clone & start coding:
          </label>
          <div className="flex items-center justify-between rounded-xl border border-[#0F172A] bg-[#0F172A] px-3 py-2 font-mono text-xs text-[#E2E8F0]">
            <span className="truncate mr-2 font-bold">{cloneCmd}</span>
            <button
              type="button"
              onClick={copyClone}
              className="inline-flex items-center gap-1 rounded-md bg-[#1E293B] px-2 py-1 text-[11px] font-bold text-white hover:bg-[#334155] transition-colors cursor-pointer shrink-0"
            >
              {copiedClone ? (
                <Check className="size-3 text-emerald-400" />
              ) : (
                <Copy className="size-3" />
              )}
              <span>{copiedClone ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>

        {/* Tech Stack Badges */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4 text-[10px] font-mono text-[#475569] font-bold">
          <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 border border-[#E2E8F0]">React 19</span>
          <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 border border-[#E2E8F0]">TanStack Start</span>
          <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 border border-[#E2E8F0]">TailwindCSS v4</span>
          <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 border border-[#E2E8F0]">TypeScript</span>
          <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 border border-[#E2E8F0]">Vite 8</span>
          <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 border border-[#E2E8F0]">Bun</span>
          <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 border border-[#E2E8F0]">xlsx</span>
          <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 border border-[#E2E8F0]">Sonner</span>
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="btn-velvet-secondary rounded-xl px-4 py-2 text-xs font-bold cursor-pointer"
          >
            Close
          </button>
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-velvet-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold cursor-pointer"
          >
            <Github className="size-4" />
            <span>Open GitHub Repository</span>
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
