# 🪑 SeatingFinder

> **Instant University Exam Room & Desk Allocation Finder**  
> *Crafted with precision by [Yashvardhan](https://github.com/Yashvardhan4646) for university students.*

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](#)
[![React 19](https://img.shields.io/badge/React-19-61dafb)](#)
[![TanStack Start](https://img.shields.io/badge/TanStack-Start-ff4154)](#)
[![TailwindCSS v4](https://img.shields.io/badge/TailwindCSS-v4-38bdf8)](#)

---

## 🚀 Overview

**SeatingFinder** is an ultra-fast, client-side examination seating directory. Instead of making thousands of students scroll and zoom through chaotic 100-page spreadsheet PDFs outside exam hall doors, SeatingFinder parses tens of thousands of candidate records in milliseconds with zero server latency.

- **⚡ Instant Search:** Search across 30,000+ seat allocations by **Roll Number**, **Admission Number**, or **Student Name** in < 5ms.
- **🎫 Boarding Pass Seating Ticket:** High-contrast room & desk vouchers with print and 1-click clipboard copy.
- **🕒 Multi-Shift Management:** Automatic detection and tabbed switching for students appearing in multiple exam shifts on the same day.
- **📁 Dynamic Excel Support:** Drag-and-drop or upload custom university `.xls` and `.xlsx` seating plans on the fly.
- **🔗 Shareable Pass Links:** Deep-linking (`/?q=24131040494`) allows students to send seating tickets directly over messaging apps.

---

## 🛠️ Tech Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) & [React 19](https://react.dev)
- **Language:** TypeScript
- **Styling:** Vanilla CSS & [Tailwind CSS v4](https://tailwindcss.com) (Flat, velvet tactile, zero shadows, no gradients)
- **Workbook Parser:** [xlsx (SheetJS)](https://sheetjs.com)
- **Bundler & Server:** [Vite 8](https://vitejs.dev), [Nitro](https://nitro.unjs.io), [Bun](https://bun.sh)
- **Notifications:** [Sonner](https://sonner.emilkowal.ski)

---

## 💻 Getting Started Locally

### Prerequisites

- [Bun](https://bun.sh) (Recommended) or [Node.js](https://nodejs.org) (v20+)

### Installation

```bash
# Clone the repository
git clone https://github.com/Yashvardhan4646/screenshot-match.git
cd screenshot-match

# Install dependencies
bun install

# Start local development server
bun run dev
```

Visit `http://localhost:8080` in your browser.

---

## 🧪 Testing & Production Build

```bash
# Run test suite
bun test

# Build production bundle (Client + SSR + Nitro)
bun run build

# Preview production build locally
bun run preview
```

---

## 🤝 Want to Contribute?

Contributions and feature requests from fellow developers are always welcome!

- **📸 Screenshot OCR Matcher:** Upload admit card / roll list screenshots to auto-highlight exam desk.
- **🗺️ Campus Navigator:** Interactive block and floor maps for exam halls.
- **📱 Offline PWA:** Caching passes for offline use when network is congested.

Submit a pull request or open an issue on [GitHub](https://github.com/Yashvardhan4646/screenshot-match).

---

## ⚖️ License & Disclaimer

Built as an independent student open-source project by **Yashvardhan**. Not an official portal of any university administration.
