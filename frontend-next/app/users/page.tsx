"use client";

import { useState } from "react";
import DataTable, { type Column } from "@/components/data-table/DataTable";
import { Pencil, Trash2 } from "lucide-react";

/* ─── types ───────────────────────────────────────────────── */

interface UserRecord {
  id: string;
  name: string;
  surname: string;
  company: string;
  email: string;
  request_count: number;
  request_limit: number;
}

/* ─── columns ─────────────────────────────────────────────── */

const columns: Column<UserRecord>[] = [
  { key: "name", header: "Name" },
  { key: "surname", header: "Surname" },
  { key: "company", header: "Company" },
  { key: "email", header: "Email" },
  { key: "request_count", header: "Requests", render: (r) => (
    <span className="font-mono text-sm">{r.request_count.toLocaleString()} / {r.request_limit.toLocaleString()}</span>
  )},
];

/* ─── mock data ───────────────────────────────────────────── */

const MOCK_USERS: UserRecord[] = [
  { id: "1", name: "SALAMA", surname: "SALAMA", company: "SALAMA", email: "SALAMA@mail.com", request_count: 222, request_limit: 300 },
  { id: "2", name: "NGI", surname: "NGI", company: "NGI", email: "NGI@mail.com", request_count: 298, request_limit: 300 },
  { id: "3", name: "ASCANA", surname: "ASCANA", company: "ASCANA", email: "ASCANA@mail.com", request_count: 300, request_limit: 300 },
  { id: "4", name: "Autodata", surname: "Autodata", company: "Autodata", email: "Autodata@mail.com", request_count: 300, request_limit: 300 },
  { id: "5", name: "Fidelity", surname: "Fidelity", company: "Fidelity", email: "Fidelity@mail.com", request_count: 300, request_limit: 300 },
  { id: "6", name: "TMNF", surname: "TMNF", company: "TMNF", email: "TMNF@mail.com", request_count: 300, request_limit: 300 },
  { id: "7", name: "AlAin", surname: "AlAin", company: "AlAin", email: "AlAin@mail.com", request_count: 299, request_limit: 300 },
];

/* ─── page component ──────────────────────────────────────── */

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  return (
    <div className="space-y-4">
      <DataTable<UserRecord>
        title="B2B Users"
        columns={columns}
        data={MOCK_USERS}
        totalRecords={38}
        onCreate={() => console.log("Create new user")}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        rowKey={(r) => r.id}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button className="p-1 hover:bg-zinc-100 rounded" title="Edit"><Pencil className="h-3.5 w-3.5 text-zinc-500" /></button>
            <button className="p-1 hover:bg-red-50 rounded" title="Delete"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
          </div>
        )}
      />
    </div>
  );
}
