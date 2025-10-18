import React, { useEffect, useState } from "react";
import axios from "axios";

interface LogEntry {
  logs: string[];
  total: number;
  page: number;
  page_size: number;
}

const LOG_LEVELS = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"];

const Logs: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [level, setLevel] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: pageSize };
      if (level) params.level = level;
      if (search) params.search = search;
      const res = await axios.get<LogEntry>(`/api/logs`, { params });
      // Defensive: ensure logs is always an array
      const logsArr = Array.isArray(res.data.logs) ? res.data.logs : [];
      setLogs(logsArr);
      setTotal(typeof res.data.total === 'number' ? res.data.total : 0);
    } catch (err) {
      setLogs(["Failed to fetch logs."]);
      setTotal(0);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line
  }, [page, pageSize, level]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">API Logs</h1>
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="border rounded px-2 py-1"
          value={level}
          onChange={e => { setLevel(e.target.value); setPage(1); }}
        >
          <option value="">All Levels</option>
          {LOG_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <input
          className="border rounded px-2 py-1"
          placeholder="Search logs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") fetchLogs(); }}
        />
        <button
          className="bg-blue-500 text-white px-3 py-1 rounded"
          onClick={() => { setPage(1); fetchLogs(); }}
        >Search</button>
        <select
          className="border rounded px-2 py-1"
          value={pageSize}
          onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
        >
          {[25, 50, 100, 200, 500].map(size => (
            <option key={size} value={size}>{size} per page</option>
          ))}
        </select>
      </div>
      <div className="bg-black text-green-200 font-mono text-xs rounded p-2 h-[600px] overflow-auto border">
        {loading ? (
          <div>Loading...</div>
        ) : !Array.isArray(logs) || logs.length === 0 ? (
          <div>No logs found.</div>
        ) : (
          logs.map((log, idx) => <div key={idx}>{log}</div>)
        )}
      </div>
      <div className="flex items-center gap-2 mt-4">
        <button
          className="px-2 py-1 border rounded disabled:opacity-50"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
        >Prev</button>
        <span>Page {page} of {totalPages || 1}</span>
        <button
          className="px-2 py-1 border rounded disabled:opacity-50"
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages || totalPages === 0}
        >Next</button>
      </div>
    </div>
  );
};

export default Logs;
