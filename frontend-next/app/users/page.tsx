"use client";

import { useMemo, useState } from "react";
import DataTable, { type Column } from "@/components/data-table/DataTable";
import { Pencil, Trash2 } from "lucide-react";
import { usePreferences } from "@/contexts/PreferencesContext";

interface UserRecord {
  id: string;
  name: string;
  surname: string;
  company: string;
  email: string;
  request_count: number;
  request_limit: number;
}

const MOCK_USERS: UserRecord[] = [
  { id: "1", name: "SALAMA", surname: "SALAMA", company: "SALAMA", email: "SALAMA@mail.com", request_count: 222, request_limit: 300 },
  { id: "2", name: "NGI", surname: "NGI", company: "NGI", email: "NGI@mail.com", request_count: 298, request_limit: 300 },
  { id: "3", name: "ASCANA", surname: "ASCANA", company: "ASCANA", email: "ASCANA@mail.com", request_count: 300, request_limit: 300 },
  { id: "4", name: "Autodata", surname: "Autodata", company: "Autodata", email: "Autodata@mail.com", request_count: 300, request_limit: 300 },
  { id: "5", name: "Fidelity", surname: "Fidelity", company: "Fidelity", email: "Fidelity@mail.com", request_count: 300, request_limit: 300 },
  { id: "6", name: "TMNF", surname: "TMNF", company: "TMNF", email: "TMNF@mail.com", request_count: 300, request_limit: 300 },
  { id: "7", name: "AlAin", surname: "AlAin", company: "AlAin", email: "AlAin@mail.com", request_count: 299, request_limit: 300 },
];

const TEXT = {
  ru: {
    title: "B2B пользователи",
    name: "Имя",
    surname: "Фамилия",
    company: "Компания",
    email: "Email",
    requests: "Запросы",
    create: "Создать пользователя",
    edit: "Редактировать",
    delete: "Удалить",
  },
  en: {
    title: "B2B Users",
    name: "Name",
    surname: "Surname",
    company: "Company",
    email: "Email",
    requests: "Requests",
    create: "Create user",
    edit: "Edit",
    delete: "Delete",
  },
} as const;

export default function UsersPage() {
  const { language } = usePreferences();
  const text = TEXT[language];

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const columns: Column<UserRecord>[] = useMemo(
    () => [
      { key: "name", header: text.name },
      { key: "surname", header: text.surname },
      { key: "company", header: text.company },
      { key: "email", header: text.email },
      {
        key: "request_count",
        header: text.requests,
        render: (row) => (
          <span className="font-mono text-sm">
            {row.request_count.toLocaleString()} / {row.request_limit.toLocaleString()}
          </span>
        ),
      },
    ],
    [text]
  );

  return (
    <div className="space-y-4">
      <DataTable<UserRecord>
        title={text.title}
        columns={columns}
        data={MOCK_USERS}
        totalRecords={38}
        onCreate={() => console.log("Create new user")}
        texts={{ createButtonLabel: text.create }}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        rowKey={(row) => row.id}
        actions={() => (
          <div className="flex items-center gap-1">
            <button className="rounded p-1 hover:bg-muted" title={text.edit}>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button className="rounded p-1 hover:bg-destructive/10" title={text.delete}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          </div>
        )}
      />
    </div>
  );
}
