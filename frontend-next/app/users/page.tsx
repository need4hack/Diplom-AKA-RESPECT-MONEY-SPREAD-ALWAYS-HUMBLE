"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, Pencil, Plus, Save, Trash2 } from "lucide-react";
import DataTable, { type Column } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  adminUsers,
  type AdminUserCreatePayload,
  type AdminUserRecord,
} from "@/lib/api";
import { isPrivilegedRole } from "@/lib/access";

const TEXT = {
  ru: {
    title: "Users",
    searchPlaceholder: "Поиск по username, email или role...",
    username: "Username",
    email: "Email",
    role: "Role",
    used: "Used",
    available: "Available",
    limit: "Limit",
    created: "Created",
    edit: "Edit",
    delete: "Delete",
    create: "Создать пользователя",
    createTitle: "Create user",
    createDescription: "Создайте нового пользователя и задайте стартовый лимит запросов.",
    password: "Password",
    apiKey: "API Key",
    regenerateApiKey: "Regenerate API key",
    regenerateTitle: "Manage API key",
    regenerateDescription:
      "Здесь можно посмотреть текущий API key пользователя и выпустить новый.",
    show: "Show",
    hide: "Hide",
    accessDenied: "Страница доступна только администраторам.",
    loadError: "Не удалось загрузить пользователей.",
    deleteConfirm: "Удалить пользователя?",
    editTitle: "Update request settings",
    editDescription:
      "Измените лимит и текущее количество запросов для пользователя.",
    requestLimit: "Request limit",
    requestCount: "Used requests",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    deleting: "Deleting...",
    empty: "Пользователи не найдены.",
  },
  en: {
    title: "Users",
    searchPlaceholder: "Search by username, email, or role...",
    username: "Username",
    email: "Email",
    role: "Role",
    used: "Used",
    available: "Available",
    limit: "Limit",
    created: "Created",
    edit: "Edit",
    delete: "Delete",
    create: "Create user",
    createTitle: "Create user",
    createDescription: "Create a new user and define the starting request limit.",
    password: "Password",
    apiKey: "API Key",
    regenerateApiKey: "Regenerate API key",
    regenerateTitle: "Manage API key",
    regenerateDescription:
      "Review the current API key and generate a new one when needed.",
    show: "Show",
    hide: "Hide",
    accessDenied: "This page is available only to administrators.",
    loadError: "Failed to load users.",
    deleteConfirm: "Delete this user?",
    editTitle: "Update request settings",
    editDescription: "Change the request limit and current used count for this user.",
    requestLimit: "Request limit",
    requestCount: "Used requests",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    deleting: "Deleting...",
    empty: "No users found.",
  },
} as const;

function formatCreatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString();
}

function formatApiKey(apiKey: string | null, isVisible: boolean) {
  if (!apiKey) {
    return "—";
  }

  if (isVisible || apiKey.length <= 10) {
    return apiKey;
  }

  return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
}

export default function UsersPage() {
  const { language } = usePreferences();
  const { user, refreshProfile } = useAuth();
  const text = TEXT[language];
  const hasAdminAccess = isPrivilegedRole(user?.role);

  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);
  const [requestLimitInput, setRequestLimitInput] = useState("");
  const [requestCountInput, setRequestCountInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [newRequestLimit, setNewRequestLimit] = useState("1000");
  const [isCreating, setIsCreating] = useState(false);

  const [keyUser, setKeyUser] = useState<AdminUserRecord | null>(null);
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);

  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAdminAccess) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadUsers() {
      try {
        setLoading(true);
        setError(null);
        const records = await adminUsers.list();

        if (!isMounted) {
          return;
        }

        setUsers(records);
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        const detail =
          typeof requestError === "object" &&
          requestError !== null &&
          "detail" in requestError &&
          typeof requestError.detail === "string"
            ? requestError.detail
            : text.loadError;

        setError(detail);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      isMounted = false;
    };
  }, [hasAdminAccess, text.loadError]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) {
      return users;
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();

    return users.filter((record) =>
      [record.username, record.email, record.role].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [searchQuery, users]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, page, pageSize]);

  const columns: Column<AdminUserRecord>[] = useMemo(
    () => [
      { key: "username", header: text.username, className: "font-medium" },
      { key: "email", header: text.email },
      {
        key: "role",
        header: text.role,
        render: (row) => (
          <span className="uppercase text-muted-foreground">{row.role}</span>
        ),
      },
      {
        key: "request_count",
        header: text.used,
        render: (row) => row.request_count.toLocaleString(),
        className: "font-mono text-sm",
      },
      {
        key: "remaining_requests",
        header: text.available,
        render: (row) => row.remaining_requests.toLocaleString(),
        className: "font-mono text-sm",
      },
      {
        key: "request_limit",
        header: text.limit,
        render: (row) => row.request_limit.toLocaleString(),
        className: "font-mono text-sm",
      },
      {
        key: "created_at",
        header: text.created,
        render: (row) => formatCreatedAt(row.created_at),
      },
    ],
    [text],
  );

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [filteredUsers.length, page, pageSize]);

  function openEditDialog(record: AdminUserRecord) {
    setEditingUser(record);
    setRequestLimitInput(String(record.request_limit));
    setRequestCountInput(String(record.request_count));
  }

  function openKeyDialog(record: AdminUserRecord) {
    setKeyUser(record);
    setIsKeyVisible(false);
  }

  async function handleSave() {
    if (!editingUser) {
      return;
    }

    const requestLimit = Number(requestLimitInput);
    const requestCount = Number(requestCountInput);

    if (
      !Number.isInteger(requestLimit) ||
      !Number.isInteger(requestCount) ||
      requestLimit < 0 ||
      requestCount < 0
    ) {
      setError("Request values must be non-negative integers.");
      return;
    }

    if (requestCount > requestLimit) {
      setError("Used requests cannot be greater than request limit.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const updatedUser = await adminUsers.update(editingUser.id, {
        request_limit: requestLimit,
        request_count: requestCount,
      });

      setUsers((current) =>
        current.map((record) => (record.id === updatedUser.id ? updatedUser : record)),
      );

      if (user?.id === updatedUser.id) {
        await refreshProfile();
      }

      setEditingUser(null);
    } catch (requestError) {
      const detail =
        typeof requestError === "object" &&
        requestError !== null &&
        "detail" in requestError &&
        typeof requestError.detail === "string"
          ? requestError.detail
          : text.loadError;

      setError(detail);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateUser() {
    const requestLimit = Number(newRequestLimit);

    if (!Number.isInteger(requestLimit) || requestLimit < 0) {
      setCreateError("Request limit must be a non-negative integer.");
      return;
    }

    const payload: AdminUserCreatePayload = {
      username: newUsername.trim(),
      email: newEmail.trim(),
      password: newPassword,
      role: newRole.trim() || "user",
      request_limit: requestLimit,
    };

    try {
      setIsCreating(true);
      setCreateError(null);

      const createdUser = await adminUsers.create(payload);
      setUsers((current) => [createdUser, ...current]);
      setCreateDialogOpen(false);
      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("user");
      setNewRequestLimit("1000");
      setPage(1);
    } catch (requestError) {
      const detail =
        typeof requestError === "object" &&
        requestError !== null &&
        "detail" in requestError &&
        typeof requestError.detail === "string"
          ? requestError.detail
          : text.loadError;

      setCreateError(detail);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRegenerateApiKey() {
    if (!keyUser) {
      return;
    }

    try {
      setIsRegeneratingKey(true);
      setError(null);

      const updatedKey = await adminUsers.regenerateApiKey(keyUser.id);

      setUsers((current) =>
        current.map((record) =>
          record.id === updatedKey.id ? { ...record, api_key: updatedKey.api_key } : record,
        ),
      );

      setKeyUser((current) =>
        current ? { ...current, api_key: updatedKey.api_key } : current,
      );

      if (user?.id === updatedKey.id) {
        await refreshProfile();
      }
    } catch (requestError) {
      const detail =
        typeof requestError === "object" &&
        requestError !== null &&
        "detail" in requestError &&
        typeof requestError.detail === "string"
          ? requestError.detail
          : text.loadError;

      setError(detail);
    } finally {
      setIsRegeneratingKey(false);
    }
  }

  async function handleDelete(record: AdminUserRecord) {
    if (!window.confirm(text.deleteConfirm)) {
      return;
    }

    try {
      setDeletingUserId(record.id);
      setError(null);
      await adminUsers.remove(record.id);
      setUsers((current) => current.filter((item) => item.id !== record.id));
    } catch (requestError) {
      const detail =
        typeof requestError === "object" &&
        requestError !== null &&
        "detail" in requestError &&
        typeof requestError.detail === "string"
          ? requestError.detail
          : text.loadError;

      setError(detail);
    } finally {
      setDeletingUserId(null);
    }
  }

  if (!hasAdminAccess) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {text.accessDenied}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <DataTable<AdminUserRecord>
        title={text.title}
        columns={columns}
        data={paginatedUsers}
        totalRecords={filteredUsers.length}
        searchPlaceholder={text.searchPlaceholder}
        onSearch={(query) => {
          setSearchQuery(query);
          setPage(1);
        }}
        onCreate={() => setCreateDialogOpen(true)}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
        rowKey={(row) => row.id}
        isLoading={loading}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded p-1 hover:bg-muted"
              title={text.regenerateApiKey}
              onClick={() => openKeyDialog(row)}
            >
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              type="button"
              className="rounded p-1 hover:bg-muted"
              title={text.edit}
              onClick={() => openEditDialog(row)}
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              type="button"
              className="rounded p-1 hover:bg-destructive/10"
              title={text.delete}
              onClick={() => void handleDelete(row)}
              disabled={deletingUserId === row.id}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          </div>
        )}
        texts={{
          createButtonLabel: text.create,
          noRecordsDescription: text.empty,
        }}
      />

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setCreateError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text.createTitle}</DialogTitle>
            <DialogDescription>{text.createDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {createError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {createError}
              </div>
            ) : null}
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{text.username}</label>
              <Input value={newUsername} onChange={(event) => setNewUsername(event.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{text.email}</label>
              <Input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{text.password}</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{text.role}</label>
              <Input value={newRole} onChange={(event) => setNewRole(event.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{text.requestLimit}</label>
              <Input
                type="number"
                min="0"
                value={newRequestLimit}
                onChange={(event) => setNewRequestLimit(event.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={isCreating}
              >
                {text.cancel}
              </Button>
              <Button type="button" onClick={() => void handleCreateUser()} disabled={isCreating}>
                <Plus className="mr-2 h-4 w-4" />
                {isCreating ? text.saving : text.create}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingUser(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text.editTitle}</DialogTitle>
            <DialogDescription>{text.editDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              <p className="font-medium text-foreground">{editingUser?.username}</p>
              <p className="text-muted-foreground">{editingUser?.email}</p>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{text.requestLimit}</label>
              <Input
                type="number"
                min="0"
                value={requestLimitInput}
                onChange={(event) => setRequestLimitInput(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{text.requestCount}</label>
              <Input
                type="number"
                min="0"
                value={requestCountInput}
                onChange={(event) => setRequestCountInput(event.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingUser(null)}
                disabled={isSaving}
              >
                {text.cancel}
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? text.saving : text.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={keyUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setKeyUser(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text.regenerateTitle}</DialogTitle>
            <DialogDescription>{text.regenerateDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              <p className="font-medium text-foreground">{keyUser?.username}</p>
              <p className="text-muted-foreground">{keyUser?.email}</p>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {text.apiKey}
                  </p>
                  <p className="mt-2 break-all font-mono text-sm text-foreground">
                    {formatApiKey(keyUser?.api_key ?? null, isKeyVisible)}
                  </p>
                </div>
                {keyUser?.api_key ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setIsKeyVisible((current) => !current)}
                  >
                    {isKeyVisible ? (
                      <>
                        <EyeOff className="h-4 w-4" />
                        {text.hide}
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        {text.show}
                      </>
                    )}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setKeyUser(null)}
                disabled={isRegeneratingKey}
              >
                {text.cancel}
              </Button>
              <Button
                type="button"
                onClick={() => void handleRegenerateApiKey()}
                disabled={isRegeneratingKey}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                {isRegeneratingKey ? text.saving : text.regenerateApiKey}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
