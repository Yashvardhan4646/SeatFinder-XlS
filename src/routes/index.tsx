import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
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
  RotateCcw,
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
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { Spotlight } from "@/components/ui/spotlight";
import { CardSpotlight } from "@/components/ui/card-spotlight";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { CourseSelector, type CourseOption } from "@/components/CourseSelector";
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
  const [courseFilter, setCourseFilter] = useState<string>("ALL");
  const [shiftFilter, setShiftFilter] = useState<string>("ALL");
  const [showContributeModal, setShowContributeModal] = useState(false);

  const cache = useRef(new Map<string, ParsedWorkbook>());
  const searchRef = useRef<HTMLInputElement>(null);

  // Extract unique available courses from the loaded workbook
  const availableCourses = useMemo<CourseOption[]>(() => {
    if (!parsed) return [];
    const map = new Map<string, number>();
    for (const e of parsed.entries) {
      const p = normalize(e.program);
      if (!p) continue;
      map.set(p, (map.get(p) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [parsed]);

  // Reset course filter if not available in newly selected exam
  useEffect(() => {
    if (courseFilter !== "ALL" && availableCourses.length > 0) {
      const exists = availableCourses.some((c) => c.name === courseFilter);
      if (!exists) setCourseFilter("ALL");
    }
  }, [availableCourses, courseFilter]);

  // URL parameter sync (?q=... and ?course=... and ?contribute=1)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlQ = params.get("q");
      if (urlQ) {
        setQuery(urlQ);
      }
      const urlCourse = params.get("course");
      if (urlCourse) {
        setCourseFilter(urlCourse);
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
      if (courseFilter && courseFilter !== "ALL") {
        url.searchParams.set("course", courseFilter);
      } else {
        url.searchParams.delete("course");
      }
      window.history.replaceState(null, "", url.toString());
    }
  }, [query, courseFilter]);

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

  // Reset selected student on query, exam, course, or shift change
  useEffect(() => setSelectedKey(null), [query, examId, courseFilter, shiftFilter]);

  // Compute matched entries narrowed down by course, query, and shift
  const results = useMemo(() => {
    if (!parsed) return [];

    // 1. Course filter
    const inCourse =
      courseFilter === "ALL"
        ? parsed.entries
        : parsed.entries.filter((e) => normalize(e.program) === courseFilter);

    // 2. Query search
    let matched: SeatEntry[];
    const q = query.trim();
    if (q.length >= 2) {
      matched = searchEntries(q, inCourse);
    } else if (courseFilter !== "ALL") {
      // When course is chosen and query is empty/short, display all students in that course
      matched = inCourse;
    } else {
      matched = [];
    }

    // 3. Shift filter
    if (shiftFilter === "ALL") return matched;
    return matched.filter((e) => shiftNumber(e.shiftLabel) === shiftFilter);
  }, [parsed, query, courseFilter, shiftFilter]);

  const groups = useMemo(() => groupByStudent(results), [results]);

  const activeExam = exams.find((e) => e.id === examId);
  const active = query.trim().length >= 2 || courseFilter !== "ALL";
  const activeGroup = selectedKey
    ? groups.find((g) => g.key === selectedKey)
    : undefined;
  const group = groups.length === 1 ? groups[0] : activeGroup;
  const showTable = active && groups.length > 1 && !activeGroup;

  // Detect query type helper with futuristic radar telemetry
  const queryTypeBadge = useMemo(() => {
    const q = query.trim();
    if (q) {
      if (/^\d{6,}$/.test(q))
        return {
          label: "RADAR LOCK: ROLL NUMBER",
          sub: `${q.length} DIGITS · DIRECT DESK MATCH`,
          color: "bg-indigo-50 text-indigo-700 border-indigo-200/90 shadow-[0_0_12px_rgba(99,102,241,0.15)]",
          dotColor: "bg-indigo-500",
        };
      if (/^\d{2}[A-Za-z]{2,}/i.test(q))
        return {
          label: "SCANNER: ADMISSION ID",
          sub: "STUDENT REGISTRATION ID",
          color: "bg-cyan-50 text-cyan-800 border-cyan-200/90 shadow-[0_0_12px_rgba(6,182,212,0.15)]",
          dotColor: "bg-cyan-500",
        };
      return {
        label: "MATRIX: CANDIDATE NAME",
        sub: "FUZZY ROSTER SEARCH",
        color: "bg-purple-50 text-purple-700 border-purple-200/90 shadow-[0_0_12px_rgba(168,85,247,0.15)]",
        dotColor: "bg-purple-500",
      };
    }
    if (courseFilter !== "ALL") {
      return {
        label: `COURSE FILTER: ${courseFilter}`,
        sub: "ENROLLED BATCH",
        color: "bg-indigo-50 text-indigo-900 border-indigo-300 font-extrabold shadow-[0_0_12px_rgba(99,102,241,0.15)]",
        dotColor: "bg-indigo-600",
      };
    }
    return null;
  }, [query, courseFilter]);

  return (
    <div className="relative min-h-screen bg-[#F8F9FA] text-[#0F172A] selection:bg-indigo-600 selection:text-white overflow-x-hidden">
      {/* Aceternity UI Spotlight Beam */}
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="#6366F1"
      />

      {/* Aceternity UI Grid Background Pattern */}
      <div className="pointer-events-none fixed inset-0 bg-grid-aceternity [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] opacity-40 -z-10" />

      {/* Modern Top Navbar */}
      <header className="glass-header sticky top-0 z-40 transition-all">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Brand & Status */}
          <div className="flex items-center gap-2.5">
            <span className="font-display text-lg font-black tracking-tight text-slate-900">
              SeatFinder<span className="text-indigo-600">.</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Fall '26
            </span>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Seat Records Counter */}
            {parsed && (
              <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-1 text-xs font-semibold text-slate-700">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>{parsed.entries.length.toLocaleString()} Seats</span>
              </div>
            )}

            {/* Keyboard shortcut hint */}
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
              Press
              <kbd className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 font-bold">
                /
              </kbd>
            </span>

            {/* Aceternity UI HoverBorderGradient Contribute Button */}
            <HoverBorderGradient
              as="button"
              id="contribute-header-btn"
              onClick={() => setShowContributeModal(true)}
              containerClassName="rounded-xl border-slate-200/90"
              className="bg-white hover:bg-slate-50 text-slate-700 hover:text-indigo-600 px-3 py-1.5 text-xs font-semibold"
            >
              <GitPullRequest className="size-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Contribute</span>
            </HoverBorderGradient>

            {/* GitHub Link */}
            <a
              href="https://github.com/Yashvardhan4646/seatfinder-xls"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub Repository"
              className="flex size-8 sm:size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-950 hover:border-slate-300 transition-colors shadow-xs"
            >
              <Github className="size-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Streamlined Hero Section */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50/80 px-3 py-0.5 text-xs font-semibold text-indigo-700 mb-2">
            <Sparkles className="size-3 text-indigo-600" />
            <span>Mid-Term Exam Seating 2026–27</span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-950 leading-tight">
            Find your exam desk in seconds.
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-slate-600 max-w-2xl">
            Instant room and desk allocations. Search by Roll Number, Name, or filter by Course.
          </p>

          {/* Quick Demo Lookups */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-mono font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Zap className="size-3 text-cyan-500" /> QUICK_TARGET:
            </span>
            {QUICK_LOOKUPS.map((item) => (
              <button
                key={item.query}
                type="button"
                onClick={() => {
                  setQuery(item.query);
                  setSelectedKey(null);
                  setCourseFilter("ALL");
                  searchRef.current?.focus();
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/90 backdrop-blur-xs px-3 py-1 text-xs font-medium text-slate-700 hover:border-cyan-400 hover:text-cyan-700 hover:shadow-[0_0_15px_rgba(6,182,212,0.25)] transition-all cursor-pointer shadow-2xs"
              >
                <span className="font-semibold text-slate-900">{item.label}</span>
                <span className="text-[10px] text-slate-400 font-mono">({item.type})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Aceternity UI CardSpotlight Command Console */}
        <CardSpotlight
          radius={450}
          color="rgba(99, 102, 241, 0.09)"
          className="rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-xl p-4 sm:p-6 shadow-xl shadow-indigo-500/5 hover:border-indigo-300/80 transition-colors"
        >
          {/* Futuristic HUD Telemetry Bar */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 text-[10px] font-mono uppercase tracking-wider text-slate-400">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="radar-ping absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
                <Terminal className="size-3 text-indigo-600" />
                MATRIX QUERY ENGINE // v2.6
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-indigo-600 font-semibold">
                SYSTEM: READY · {parsed ? `${parsed.entries.length.toLocaleString()} SEATS INDEXED` : "INITIALIZING"}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-3 text-slate-400">
              <span className="flex items-center gap-1 text-slate-500">
                <Activity className="size-3 text-cyan-600 animate-pulse" />
                <span>IN-MEMORY RADAR</span>
              </span>
              <span className="text-slate-300">·</span>
              <span className="font-semibold text-emerald-600">ZERO LATENCY</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Futuristic Glowing Input HUD */}
            <div className="futuristic-glow-frame p-[1.5px] rounded-2xl flex-1 group/input shadow-sm">
              <div className="futuristic-input-hud relative flex h-13 w-full items-center rounded-[14.5px] bg-white pl-3.5 pr-3">
                {/* Futuristic Laser Reticle Icon */}
                <div className="mr-3 flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-cyan-400 shadow-xs shadow-cyan-500/20 group-focus-within/input:bg-indigo-600 group-focus-within/input:text-white group-focus-within/input:shadow-[0_0_20px_rgba(99,102,241,0.6)] transition-all">
                  <Search className="size-4 group-focus-within/input:scale-110 transition-transform" />
                </div>

                {/* Cyber Prompt Cursor */}
                <span className="hidden sm:inline font-mono text-sm font-bold text-indigo-600 mr-2 select-none group-focus-within/input:animate-pulse">
                  ❯
                </span>

                <input
                  id="student-search-input"
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setQuery("");
                  }}
                  placeholder={
                    courseFilter !== "ALL"
                      ? `[ ${courseFilter} ] Search Roll No, Admission ID, or Name…`
                      : "ENTER QUERY [ ROLL NO · ADMISSION ID · CANDIDATE NAME ]…"
                  }
                  autoComplete="off"
                  spellCheck={false}
                  className="h-full w-full bg-transparent font-mono text-sm sm:text-base font-bold text-slate-900 outline-none placeholder:font-sans placeholder:text-xs sm:placeholder:text-sm placeholder:font-medium placeholder:text-slate-400"
                />

                {/* Right Action Icons & Futuristic Keycaps */}
                <div className="flex shrink-0 items-center gap-2">
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        searchRef.current?.focus();
                      }}
                      className="rounded-lg bg-slate-100 hover:bg-slate-200 p-1.5 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                      title="Clear query (Esc)"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}

                  {/* 3D Cyber HUD Keycap */}
                  <div className="hidden sm:flex items-center gap-1 rounded-lg border border-slate-200/90 bg-slate-50 px-2 py-1 text-[11px] font-mono font-bold text-slate-600 shadow-2xs">
                    <kbd className="text-[10px] text-slate-400">⌘</kbd>
                    <span>K</span>
                    <span className="text-slate-300">/</span>
                    <span>/</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Course Selector Dropdown */}
            <CourseSelector
              courses={availableCourses}
              selectedCourse={courseFilter}
              onSelectCourse={(course) => {
                setCourseFilter(course);
                setSelectedKey(null);
              }}
              disabled={!parsed || availableCourses.length === 0}
            />

            {/* Exam Catalog Selector */}
            <div className="w-full sm:w-48 shrink-0">
              <select
                id="exam-catalog-select"
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                className="h-13 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-3 text-xs font-mono font-bold text-slate-800 outline-none hover:border-slate-300 focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 cursor-pointer transition-all shadow-xs"
              >
                {exams.map((e) => (
                  <option key={e.id} value={e.id}>
                    📅 {e.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Upload Custom Excel Button */}
            <div className="shrink-0">
              <label
                className="inline-flex h-13 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-mono font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-600 hover:shadow-xs transition-all whitespace-nowrap"
                title="Upload another spreadsheet (.xls / .xlsx)"
              >
                <Upload className="size-3.5 text-slate-500" />
                <span className="hidden lg:inline">Upload Custom Excel</span>
                <span className="lg:hidden">Upload</span>
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
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            {/* Shift Tabs */}
            {parsed && parsed.shifts.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                  <Layers className="size-3.5 text-indigo-600" />
                  SHIFT:
                </span>
                <button
                  type="button"
                  onClick={() => setShiftFilter("ALL")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-mono font-bold transition-all cursor-pointer ${
                    shiftFilter === "ALL"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100/80 text-slate-600 border border-slate-200/70 hover:bg-slate-200"
                  }`}
                >
                  ALL SHIFTS ({parsed.entries.length.toLocaleString()})
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
                      className={`rounded-xl px-3 py-1.5 text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/25"
                          : "bg-slate-100/80 text-slate-600 border border-slate-200/70 hover:bg-slate-200"
                      }`}
                    >
                      <span className={`size-1.5 rounded-full ${isSelected ? "bg-emerald-300 animate-pulse" : "bg-slate-400"}`} />
                      <span>{label}</span>
                      <span className="text-[10px] opacity-75">
                        ({count.toLocaleString()})
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* Active Filters & Search Type Detector */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Active Course Pill */}
              {courseFilter !== "ALL" && (
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-indigo-50/80 px-2.5 py-1 text-xs font-mono font-bold text-indigo-800 shadow-2xs">
                  <GraduationCap className="size-3.5 text-indigo-600" />
                  <span className="truncate max-w-[200px] sm:max-w-xs">
                    {courseFilter}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCourseFilter("ALL")}
                    className="ml-0.5 rounded p-0.5 hover:bg-indigo-200 text-indigo-700 cursor-pointer"
                    title="Clear course filter"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )}

              {/* Futuristic Radar Query Type Detector */}
              {queryTypeBadge && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-xs font-mono font-bold tracking-tight ${queryTypeBadge.color}`}
                >
                  <span className={`size-2 rounded-full ${queryTypeBadge.dotColor} animate-pulse`} />
                  <span>{queryTypeBadge.label}</span>
                  {queryTypeBadge.sub && (
                    <>
                      <span className="opacity-30">|</span>
                      <span className="text-[10px] opacity-75">{queryTypeBadge.sub}</span>
                    </>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </CardSpotlight>

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
            /* Aceternity Style Empty State & Bento Grid */
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-md p-8 sm:p-10 text-center shadow-xs">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Search className="size-5" />
                </div>
                <h2 className="font-display mt-3 text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  Ready to find your seat
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                  Type your Roll Number, Admission Number, or choose your course from the dropdown above to view your exam hall and desk assignment.
                </p>
              </div>

              {/* Bento Stat Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur-xs p-4 hover:border-indigo-300 transition-all shadow-2xs group">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-indigo-600 transition-colors">
                    Candidates Indexed
                  </div>
                  <div className="mt-1 font-display text-2xl font-black text-slate-900">
                    {parsed.entries.length.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">Verified exam records</div>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur-xs p-4 hover:border-indigo-300 transition-all shadow-2xs group">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-indigo-600 transition-colors">
                    Courses Filterable
                  </div>
                  <div className="mt-1 font-display text-2xl font-black text-indigo-600">
                    {availableCourses.length}+
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">B.Tech, BCA, MBA & more</div>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur-xs p-4 hover:border-indigo-300 transition-all shadow-2xs group">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-indigo-600 transition-colors">
                    Campus Blocks
                  </div>
                  <div className="mt-1 font-display text-2xl font-black text-slate-900">
                    A, B, C & Audi
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">40+ examination rooms</div>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur-xs p-4 hover:border-indigo-300 transition-all shadow-2xs group">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-emerald-600 transition-colors">
                    Latency
                  </div>
                  <div className="mt-1 font-display text-2xl font-black text-emerald-600 flex items-center gap-1">
                    <span>&lt; 5ms</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">Client-side instant lookup</div>
                </div>
              </div>
            </div>
          ) : groups.length === 0 ? (
            /* No Results Found State */
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
                <AlertCircle className="size-5 text-amber-700" />
                <span>
                  {courseFilter !== "ALL"
                    ? `No candidate found for “${query.trim()}” in ${courseFilter}`
                    : `No candidate found for “${query.trim()}”`}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-amber-800 leading-relaxed">
                Check for typing errors, try searching by just the Roll Number or partial Name, or ensure the shift filter is set to <strong>All Shifts</strong>.
              </p>
              {courseFilter !== "ALL" && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setCourseFilter("ALL")}
                    className="btn-velvet-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer"
                  >
                    <RotateCcw className="size-3.5 text-indigo-600" />
                    <span>Clear course filter & search across all courses</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Result Found: Ticket Pass & Optional Candidate Table */
            <div className="space-y-6">
              {group && (
                <SeatingCard
                  key={group.key}
                  group={group}
                  dateLabel={activeExam?.label ?? ""}
                  hasMultipleCandidates={groups.length > 1}
                  onBack={() => setSelectedKey(null)}
                />
              )}

              {showTable && (
                <CandidateTable
                  groups={groups}
                  query={query.trim()}
                  courseFilter={courseFilter}
                  onPick={setSelectedKey}
                />
              )}
            </div>
          )}
        </section>

      </main>

      {/* Modern Minimal Footer */}
      <footer className="mt-20 border-t border-slate-200/80 bg-white/50 backdrop-blur-xs py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-slate-900">SeatFinder.</span>
            <span>·</span>
            <span>Crafted by Yashvardhan for university students</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowContributeModal(true)}
              className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <GitPullRequest className="size-3.5" />
              <span>Want to contribute?</span>
            </button>
            <span>·</span>
            <a
              href="https://github.com/Yashvardhan4646/seatfinder-xls"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 flex items-center gap-1 transition-colors"
            >
              <Github className="size-3.5" />
              <span>GitHub</span>
            </a>
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
  hasMultipleCandidates,
  onBack,
}: {
  group: StudentGroup;
  dateLabel: string;
  hasMultipleCandidates?: boolean;
  onBack?: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const entry = group.entries[Math.min(idx, group.entries.length - 1)]!;
  const multi = group.entries.length > 1;

  // Trigger celebratory confetti on pass discovery
  useEffect(() => {
    try {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.65 },
        colors: ["#6366F1", "#8B5CF6", "#10B981", "#3B82F6"],
        disableForReducedMotion: true,
      });
    } catch {
      // safe fallback
    }
  }, [entry.roomNo, entry.seatNo]);

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
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <CardSpotlight
        radius={420}
        color="rgba(79, 70, 229, 0.08)"
        className="seating-pass-card rounded-2xl border-2 border-[#0F172A] bg-white overflow-hidden relative p-0 shadow-lg shadow-indigo-500/5"
      >
        {/* Top Pass Ribbon */}
      <div className="border-b-2 border-[#0F172A] bg-[#0F172A] px-5 py-3 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-display text-xs font-bold uppercase tracking-wider text-white">
            Official Candidate Seating Pass
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {hasMultipleCandidates && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="btn-velvet-secondary inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer"
              title="Return to matching candidate list"
            >
              <span>← Back to list</span>
            </button>
          )}

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
      </CardSpotlight>
    </motion.div>
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
  courseFilter,
  onPick,
}: {
  groups: StudentGroup[];
  query: string;
  courseFilter?: string;
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
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs"
    >
      <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A]">
              Matching Candidates ({groups.length.toLocaleString()})
            </h3>
            {courseFilter && courseFilter !== "ALL" && (
              <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                {courseFilter}
              </span>
            )}
          </div>
          <p className="text-xs text-[#64748B]">
            {query
              ? "Multiple students match your search. Click any row to reveal the full seating pass."
              : `Displaying students enrolled in ${courseFilter}. Click any row to reveal their pass.`}
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
            : query
            ? `${groups.length.toLocaleString()} candidate${
                groups.length === 1 ? "" : "s"
              } matching “${query}”.`
            : `${groups.length.toLocaleString()} candidate${
                groups.length === 1 ? "" : "s"
              } in ${courseFilter}.`}
        </span>
        <span className="font-bold text-indigo-600">
          Click any candidate to open ticket
        </span>
      </div>
    </motion.div>
  );
}

/**
 * ContributeModal - Developer Contribution Hub
 */
function ContributeModal({ onClose }: { onClose: () => void }) {
  const [copiedClone, setCopiedClone] = useState(false);
  const repoUrl = "https://github.com/Yashvardhan4646/seatfinder-xls";
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
