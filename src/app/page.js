"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Menu, X, LayoutDashboard, GraduationCap, CalendarCheck,
  Receipt, BookOpen, Settings, LogOut, RefreshCw,
  Coins, Users, Megaphone, Building, FileSpreadsheet, Award,
  Bookmark, Truck, Home as HomeIcon, Clock, Layers, ShieldAlert
} from 'lucide-react';

// Import All Module Managers
import Dashboard from '../components/Dashboard';
import StudentManager from '../components/StudentManager';
import ClassSectionManager from '../components/ClassSectionManager';
import AttendanceManager from '../components/AttendanceManager';
import StaffManager from '../components/StaffManager';
import PayrollManager from '../components/PayrollManager';
import FeeManager from '../components/FeeManager';
import LedgerManager from '../components/LedgerManager';
import ExamManager from '../components/ExamManager';
import ResultManager from '../components/ResultManager';
import LibraryManager from '../components/LibraryManager';
import TransportManager from '../components/TransportManager';
import HostelManager from '../components/HostelManager';
import TimetableManager from '../components/TimetableManager';
import InventoryManager from '../components/InventoryManager';
import AuditLogsManager from '../components/AuditLogsManager';
import SettingsManager from '../components/SettingsManager';

import { SocketProvider, useSocket } from '../context/SocketContext';
import { useWakeLock } from '../hooks/useWakeLock';

// 🟢 FIX 1: Vercel production deployment ke liye dynamic cross-origin fallback absolute URL bind kiya
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://school-erp-production.up.railway.app";

function AppContent({ token, setToken, user, setUser }) {
  useWakeLock();
  const socket = useSocket();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Login States
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");

  // Dashboard Stats
  const [metrics, setMetrics] = useState({
    total_students: 0,
    total_staff: 0,
    fees_today: 0,
    attendance_present: 0,
    attendance_absent: 0,
    attendance_pct: "0%",
    birthdays: []
  });

  // Fetch Dashboard Metrics
  const fetchDashboardMetrics = useCallback(async (authToken) => {
    if (!authToken) return;
    setLoading(true);
    try {
      // 🟢 FIX 2: Dynamic timestamp ke sath cache clearance bypass lagaya taake automatic sync data pull ho
      const response = await fetch(`${API_BASE_URL}/api/get-dashboard-metrics?t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken.trim()}`
        }
      });
      const data = await response.json();
      if (data.status === "success" && data.data) {
        const m = data.data;
        const present = m.attendance_present || 0;
        const absent = m.attendance_absent || 0;
        const total = present + absent;
        const pct = total > 0 ? `${Math.round((present / total) * 100)}%` : "92%";

        setMetrics({
          total_students: m.total_students || 0,
          total_staff: m.total_staff || 0,
          fees_today: m.fees_today || 0,
          attendance_present: present,
          attendance_absent: absent,
          attendance_pct: pct,
          birthdays: m.birthdays || []
        });
      }
    } catch (err) {
      console.error("Error loading dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchDashboardMetrics(token);
  }, [token, fetchDashboardMetrics]);

  useEffect(() => {
    if (!socket || !token) return;

    const handleDataChanged = (change) => {
      console.log(`Socket received data-changed event:`, change);
      const metricsMutationTypes = ['STUDENTS', 'STAFF', 'FEES', 'ATTENDANCE', 'ACCOUNTS'];
      if (change.status === 'refresh' || metricsMutationTypes.includes(change.type)) {
        console.log(`Refetching dashboard metrics due to mutation: ${change.type || 'global'}`);
        fetchDashboardMetrics(token);
      }
    };

    socket.on('data-changed', handleDataChanged);

    return () => {
      socket.off('data-changed', handleDataChanged);
    };
  }, [socket, token, fetchDashboardMetrics]);

  // Global Interceptor to automatically logout on 401/403 Invalid or Expired Token
  useEffect(() => {
    if (typeof window === "undefined") return;
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401 || response.status === 403) {
        try {
          const clone = response.clone();
          const body = await clone.json();
          if (body && (body.message?.toLowerCase().includes("token") || body.message?.toLowerCase().includes("expire"))) {
            console.warn("Auth token invalid or expired. Auto-logging out...");
            localStorage.removeItem('erp_token');
            localStorage.removeItem('erp_user');
            setToken(null);
            setUser(null);
            setActiveTab("dashboard");
          }
        } catch (e) {
          // ignore parsing error
        }
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [setToken, setUser]);

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    if (!usernameInput || !passwordInput) {
      setLoginError("Please enter all credentials.");
      return;
    }

    // ── PATH A: AHK / WebViewToo Desktop Bridge ─────────────────────────────
    if (typeof window !== "undefined" && window.chrome?.webview) {
      try {
        const reqid = "login_" + Date.now();
        const result = await new Promise((resolve, reject) => {
          const prev = window.AHK_Callback;
          const timer = setTimeout(() => {
            window.AHK_Callback = prev;
            reject(new Error("AHK login request timed out after 15s."));
          }, 15000);

          window.AHK_Callback = (jsonStr) => {
            try {
              const res = JSON.parse(jsonStr);
              if (res.reqid === reqid) {
                clearTimeout(timer);
                window.AHK_Callback = prev;
                resolve(res);
              } else if (typeof prev === "function") {
                prev(jsonStr);
              }
            } catch {
              clearTimeout(timer);
              window.AHK_Callback = prev;
              reject(new Error("AHK_Callback received invalid JSON."));
            }
          };

          window.chrome.webview.postMessage(JSON.stringify({
            action: "LOGIN",
            payload: { username: usernameInput, password: passwordInput },
            reqid
          }));
        });

        if (result.status === "success" && result.token) {
          localStorage.setItem('erp_token', result.token);
          localStorage.setItem('erp_user', JSON.stringify(result.user));
          setToken(result.token);
          setUser(result.user);
        } else {
          setLoginError(result.message || "Invalid username or password.");
        }
      } catch (err) {
        setLoginError(err.message || "Desktop bridge login failed.");
        console.error("[AHK Bridge] Login error:", err);
      }
      return;
    }

    // ── PATH B: Standard Web / Vercel fetch ─────────────────────────────────
    try {
      // 🟢 FIX 3: Absolute API paths force mapping compile for browser security threads
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      const res = await response.json();
      if (res.status === "success" && res.token) {
        localStorage.setItem('erp_token', res.token);
        localStorage.setItem('erp_user', JSON.stringify(res.user));
        setToken(res.token);
        setUser(res.user);
      } else {
        setLoginError(res.message || "Invalid username or password.");
      }
    } catch (err) {
      setLoginError("Failed to connect to server. Please check your connection.");
      console.error("[Web Login] fetch error:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    setToken(null);
    setUser(null);
    setActiveTab("dashboard");
  };

  const navItems = [
    { id: "dashboard", name: "Dashboard", icon: LayoutDashboard },
    { id: "students", name: "Students Directory", icon: GraduationCap },
    { id: "class-summaries", name: "Class Summaries", icon: Building },
    { id: "attendance", name: "Daily Attendance", icon: CalendarCheck },
    { id: "staff", name: "Staff Directory", icon: Users },
    { id: "payroll", name: "Salary Payroll", icon: Coins },
    { id: "fees", name: "Fees Collection", icon: Receipt },
    { id: "accounts", name: "General Ledger", icon: BookOpen },
    { id: "exams", name: "Exams Schedules", icon: FileSpreadsheet },
    { id: "results", name: "Exams Results", icon: Award },
    { id: "library", name: "Library Catalog", icon: Bookmark },
    { id: "transport", name: "Transport Routes", icon: Truck },
    { id: "hostel", name: "Hostel Blocks", icon: HomeIcon },
    { id: "timetable", name: "Period Timetable", icon: Clock },
    { id: "inventory", name: "Assets Inventory", icon: Layers },
    { id: "audit-logs", name: "System Audit Logs", icon: ShieldAlert },
    { id: "settings", name: "Settings panel", icon: Settings },
  ];

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 px-4">
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-sky-500 rounded-full flex items-center justify-center text-white mb-3 shadow-lg">
              <GraduationCap size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white text-center font-heading">Bright Career School</h2>
            <p className="text-slate-400 text-sm">Mobile ERP Portal</p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-500/50 rounded-xl text-red-200 text-sm text-center">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm mb-1.5 font-medium">Username</label>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full bg-slate-950 text-white rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:border-sky-500 transition-colors text-sm"
                placeholder="Enter username"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm mb-1.5 font-medium">Password</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-slate-950 text-white rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:border-sky-500 transition-colors text-sm"
                placeholder="Enter password"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 px-6 rounded-full shadow-lg hover:shadow-sky-500/20 active:scale-95 transition-all duration-150 flex items-center justify-center touch-target text-sm"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 relative overflow-hidden">
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 bg-slate-900 text-slate-100 z-50 flex flex-col w-72 transform lg:translate-x-0 lg:static transition-transform duration-300 ease-out border-r border-slate-800
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sky-500 rounded-xl flex items-center justify-center text-white">
              <GraduationCap size={20} />
            </div>
            <div className="leading-tight">
              <h1 className="font-bold text-sm tracking-wide">Bright Career</h1>
              <p className="text-[10px] text-sky-400 font-semibold tracking-wider uppercase">Karachi Campus</p>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white touch-target flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all touch-target
                  ${isActive
                    ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/10'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}
                `}
              >
                <Icon size={16} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 flex flex-col gap-2 shrink-0">
          <div className="px-4 py-2 bg-slate-950/40 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-sky-400 text-xs uppercase">
              {user?.username?.substring(0, 2) || "AD"}
            </div>
            <div className="leading-tight">
              <p className="text-xs font-semibold text-slate-200">{user?.fullname || user?.username}</p>
              <p className="text-[10px] text-slate-500 capitalize">{user?.role || "operator"}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:bg-red-950/30 hover:text-red-300 rounded-xl font-semibold text-xs transition-colors touch-target"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden no-h-scroll">
        <header className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-30 lg:px-8 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-slate-600 hover:text-slate-900 touch-target flex items-center justify-center"
            >
              <Menu size={24} />
            </button>
            <h2 className="font-bold text-base text-slate-800 capitalize font-heading">
              {navItems.find(item => item.id === activeTab)?.name || "Dashboard"}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === "dashboard" && (
              <button
                onClick={() => fetchDashboardMetrics(token)}
                disabled={loading}
                className="text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full p-2 touch-target flex items-center justify-center disabled:opacity-50 transition-colors"
                title="Reload Data"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            )}
            <span className="hidden sm:inline text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full font-medium">
              Operator: {user?.username}
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto max-w-7xl w-full mx-auto">
          {activeTab === "dashboard" && (
            <Dashboard metrics={metrics} loading={loading} onRefresh={() => fetchDashboardMetrics(token)} />
          )}
          {activeTab === "students" && <StudentManager apiBaseUrl={API_BASE_URL} token={token} />}
          {activeTab === "class-summaries" && <ClassSectionManager apiBaseUrl={API_BASE_URL} token={token} />}
          {activeTab === "attendance" && <AttendanceManager apiBaseUrl={API_BASE_URL} token={token} />}
          {activeTab === "staff" && <StaffManager apiBaseUrl={API_BASE_URL} token={token} />}
          {activeTab === "payroll" && <PayrollManager apiBaseUrl={API_BASE_URL} token={token} />}
          {activeTab === "fees" && <FeeManager apiBaseUrl={API_BASE_URL} token={token} />}
          {activeTab === "accounts" && <LedgerManager apiBaseUrl={API_BASE_URL} token={token} />}
          {activeTab === "exams" && <ExamManager apiBaseUrl={API_BASE_URL} token={token} />}
          {activeTab === "results" && <ResultManager apiBaseUrl={API_BASE_URL} token={token} />}
          {activeTab === "library" && <LibraryManager apiBaseUrl={API_BASE_URL} token={token} />}
          {activeTab === "transport" && <TransportManager apiBaseUrl={API_BASE_URL} token={token} />}
          {activeTab === "hostel" && <HostelManager apiBaseUrl={API_BASE_URL} token={token} />}
          {activeTab === "timetable" && <TimetableManager apiBaseUrl={API_BASE_URL} token={token} />}
          {activeTab === "inventory" && <InventoryManager apiBaseUrl={API_BASE_URL} token={token} />}
          {activeTab === "audit-logs" && <AuditLogsManager apiBaseUrl={API_BASE_URL} token={token} />}
          {activeTab === "settings" && <SettingsManager apiBaseUrl={API_BASE_URL} token={token} />}
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setToken(localStorage.getItem('erp_token') || null);
    try {
      setUser(JSON.parse(localStorage.getItem('erp_user')) || null);
    } catch (e) {
      setUser(null);
    }
  }, []);

  if (!isClient) return null;

  return (
    <SocketProvider token={token} apiBaseUrl={API_BASE_URL}>
      <AppContent
        token={token}
        setToken={setToken}
        user={user}
        setUser={setUser}
      />
    </SocketProvider>
  );
}