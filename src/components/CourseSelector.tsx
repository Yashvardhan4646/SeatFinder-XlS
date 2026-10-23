import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, GraduationCap, RotateCcw, Search, X } from "lucide-react";

export interface CourseOption {
  name: string;
  count: number;
}

interface CourseSelectorProps {
  courses: CourseOption[];
  selectedCourse: string;
  onSelectCourse: (course: string) => void;
  disabled?: boolean;
}

interface CategoryFilter {
  id: string;
  label: string;
  pattern?: RegExp;
}

const CATEGORIES: CategoryFilter[] = [
  { id: "all", label: "All" },
  { id: "btech", label: "B.Tech", pattern: /b\.?\s*tech/i },
  { id: "bca", label: "BCA", pattern: /\bbca\b/i },
  { id: "bba", label: "BBA", pattern: /\bbba\b/i },
  { id: "bsc", label: "B.Sc", pattern: /\bb\.?\s*sc\b/i },
  { id: "pg", label: "Masters / PG", pattern: /\b(m\.?\s*tech|mca|mba|m\.?\s*sc|pg)\b/i },
  { id: "med", label: "Medical / Health", pattern: /\b(bpt|pharma|opt|mrit)\b/i },
];

export function CourseSelector({
  courses,
  selectedCourse,
  onSelectCourse,
  disabled = false,
}: CourseSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      // Focus search input when popover opens
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Filter courses based on search text and active category
  const filteredCourses = useMemo(() => {
    let list = courses;

    // 1. Filter by category
    if (activeCategory !== "all") {
      const cat = CATEGORIES.find((c) => c.id === activeCategory);
      if (cat?.pattern) {
        list = list.filter((c) => cat.pattern!.test(c.name));
      }
    }

    // 2. Filter by search query
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }

    return list;
  }, [courses, search, activeCategory]);

  const totalStudents = useMemo(() => {
    return courses.reduce((acc, c) => acc + c.count, 0);
  }, [courses]);

  const isFiltered = selectedCourse !== "ALL";

  return (
    <div ref={containerRef} className="relative w-full sm:w-64 lg:w-72">
      {/* Hidden native select for accessibility & automation */}
      <select
        id="course-selector-select"
        aria-label="Filter by course"
        value={selectedCourse}
        onChange={(e) => onSelectCourse(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      >
        <option value="ALL">All Courses ({courses.length})</option>
        {courses.map((c) => (
          <option key={c.name} value={c.name}>
            {c.name} ({c.count})
          </option>
        ))}
      </select>

      {/* Main Trigger Button */}
      <button
        id="course-selector-btn"
        type="button"
        disabled={disabled || courses.length === 0}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={isFiltered ? `Active filter: ${selectedCourse}` : "Filter search by course"}
        className={`h-12 w-full rounded-xl border text-left px-3 text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-[#F1F5F9] border-[#CBD5E1] text-[#94A3B8]"
            : isFiltered
            ? "border-indigo-600 bg-indigo-50/60 text-indigo-950 ring-1 ring-indigo-600/30"
            : "border-[#CBD5E1] bg-[#F8FAFC] text-[#1E293B] hover:border-[#94A3B8] hover:bg-white"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GraduationCap
            className={`size-4 shrink-0 ${
              isFiltered ? "text-indigo-600" : "text-[#64748B]"
            }`}
          />
          <div className="truncate">
            {isFiltered ? (
              <span className="font-extrabold text-indigo-900">{selectedCourse}</span>
            ) : (
              <span className="text-[#334155]">
                {courses.length > 0
                  ? `All Courses (${courses.length})`
                  : "No courses"}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isFiltered && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onSelectCourse("ALL");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onSelectCourse("ALL");
                }
              }}
              className="rounded p-1 text-indigo-600 hover:bg-indigo-200/80 hover:text-indigo-900 cursor-pointer transition-colors"
              title="Reset to all courses"
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronDown
            className={`size-4 text-[#64748B] transition-transform duration-150 ${
              open ? "rotate-180 text-indigo-600" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Popover */}
      {open && (
        <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-full sm:w-[380px] z-50 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-xl overflow-hidden shadow-xl shadow-slate-900/10">
          {/* Popover Header */}
          <div className="border-b border-slate-100 bg-slate-50/80 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <GraduationCap className="size-4 text-indigo-600" />
                <span className="text-xs font-black uppercase tracking-wider text-[#0F172A]">
                  Select Course / Program
                </span>
              </div>
              {isFiltered && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectCourse("ALL");
                    setOpen(false);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  <RotateCcw className="size-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Quick Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#94A3B8]" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code, branch (e.g. CSE, BCA)..."
                className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white pl-8 pr-8 text-xs font-bold text-[#0F172A] outline-none placeholder:font-normal placeholder:text-[#94A3B8] focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#64748B] hover:text-[#0F172A]"
                  title="Clear search"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="mt-2.5 flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#0F172A] text-white"
                        : "bg-[#E2E8F0] text-[#475569] hover:bg-[#CBD5E1] hover:text-[#0F172A]"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Courses List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-[#F1F5F9] p-1">
            {/* "All Courses" Option */}
            <button
              type="button"
              onClick={() => {
                onSelectCourse("ALL");
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                selectedCourse === "ALL"
                  ? "bg-indigo-50 text-indigo-900 font-extrabold"
                  : "hover:bg-[#F8FAFC] text-[#1E293B]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="flex size-2 rounded-full bg-slate-400" />
                <span>All Courses & Programs</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-mono font-bold text-[#64748B]">
                  {totalStudents.toLocaleString()} stds
                </span>
                {selectedCourse === "ALL" && (
                  <Check className="size-4 text-indigo-600 shrink-0" />
                )}
              </div>
            </button>

            {/* Filtered Courses */}
            {filteredCourses.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#64748B]">
                <p className="font-semibold text-[#0F172A]">No courses found</p>
                <p className="mt-1 text-[11px]">
                  No programs match “{search}” in this category.
                </p>
              </div>
            ) : (
              filteredCourses.map((c) => {
                const isSelected = selectedCourse === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      onSelectCourse(c.name);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer group ${
                      isSelected
                        ? "bg-indigo-50 text-indigo-950 font-black"
                        : "hover:bg-[#F8FAFC] text-[#334155]"
                    }`}
                  >
                    <div className="truncate flex-1">
                      <span className={isSelected ? "text-indigo-900 font-extrabold" : ""}>
                        {c.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                          isSelected
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-[#F1F5F9] text-[#64748B] group-hover:bg-[#E2E8F0]"
                        }`}
                      >
                        {c.count.toLocaleString()}
                      </span>
                      {isSelected && (
                        <Check className="size-3.5 text-indigo-600" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Popover Footer */}
          <div className="border-t border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2 text-[11px] text-[#64748B] flex items-center justify-between">
            <span>
              Showing {filteredCourses.length} of {courses.length} courses
            </span>
            {isFiltered && (
              <span className="font-bold text-indigo-700">Filter Active</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
