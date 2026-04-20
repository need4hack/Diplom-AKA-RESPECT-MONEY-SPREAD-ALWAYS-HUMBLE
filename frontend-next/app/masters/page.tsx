"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DataTable, { type Column } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  vehicles,
  type MasterFieldRecord,
  type MasterRecordPayload,
  type MasterValueRecord,
} from "@/lib/api";
import { isPrivilegedRole } from "@/lib/access";
import { isFeatureEnabled } from "@/lib/features";

const MASTER_RECORD_FIELDS = [
  "region",
  "year",
  "logo",
  "make",
  "model",
  "trim",
  "body",
  "engine",
  "transmission",
  "cylinder",
  "doors",
  "seats",
  "axle",
  "mileage",
  "depreciation",
  "category",
  "fuel",
  "drivetrain",
  "new_price",
  "today_price",
  "is_active",
] as const;

const REQUIRED_RECORD_FIELDS = [
  "region",
  "year",
  "make",
  "model",
  "trim",
  "body",
  "engine",
  "transmission",
] as const;
const REQUIRED_RECORD_FIELD_SET = new Set<string>(REQUIRED_RECORD_FIELDS);

const NUMBER_FIELDS = new Set([
  "year",
  "cylinder",
  "doors",
  "seats",
  "axle",
  "new_price",
  "today_price",
]);

const DEFAULT_RECORD_FORM: Record<(typeof MASTER_RECORD_FIELDS)[number], string> = {
  region: "",
  year: "",
  logo: "",
  make: "",
  model: "",
  trim: "",
  body: "",
  engine: "",
  transmission: "",
  cylinder: "",
  doors: "",
  seats: "",
  axle: "",
  mileage: "",
  depreciation: "",
  category: "",
  fuel: "",
  drivetrain: "",
  new_price: "",
  today_price: "",
  is_active: "true",
};

const TEXT = {
  ru: {
    title: "ModelDB Masters",
    subtitle:
      "Конструктор model_db: управляйте уникальными значениями по столбцам и собирайте полноценные записи автомобилей.",
    fields: "Поля model_db",
    values: "Уникальные значения",
    valuesHint:
      "Справа показаны уникальные значения выбранного столбца и количество строк, где они уже используются.",
    fieldSearchPlaceholder: "Поиск по названиям столбцов...",
    valueSearchPlaceholder: "Поиск по значениям...",
    name: "Поле",
    type: "Тип",
    value: "Значение",
    occurrences: "Строк",
    create: "Добавить значение",
    createTitle: "Добавить новое значение",
    createDescription:
      "Создает placeholder-строку в model_db с новым значением, чтобы потом использовать его при сборке полной модели.",
    createLabel: "Новое значение",
    save: "Сохранить",
    created: "Новое значение добавлено в model_db.",
    fieldCount: "полей",
    selectedField: "Выбранное поле",
    dataType: "Тип данных",
    addAllowed: "Добавление вручную",
    yes: "Да",
    no: "Нет",
    accessDenied: "Эта страница доступна только администраторам.",
    loadFieldsFailed: "Не удалось загрузить поля model_db.",
    loadValuesFailed: "Не удалось загрузить уникальные значения.",
    createFailed: "Не удалось добавить новое значение.",
    noFieldSelected: "Поле не выбрано.",
    addDisabledHint: "Для этого столбца ручное добавление значений отключено.",
    assembleTitle: "Собрать полную модель",
    assembleDescription:
      "Создайте полноценную запись model_db, используя уже существующие master-значения по столбцам.",
    assembleButton: "Собрать запись",
    assembleDialogTitle: "Новая запись model_db",
    assembleDialogDescription:
      "Заполните ключевые характеристики автомобиля. Поля с подсказками берут уникальные значения из текущей базы.",
    assembleHint:
      "Обязательные поля: region, year, make, model, trim, body, engine, transmission.",
    assembleLoadFailed: "Не удалось загрузить master-значения для сборки записи.",
    assembleCreateFailed: "Не удалось создать запись model_db.",
    assembled: "Полная запись model_db успешно создана.",
    optionsLoaded: "Загружено вариантов",
    pickOrType: "Выберите или введите значение",
    activeStatus: "Статус записи",
    active: "Активна",
    inactive: "Неактивна",
    required: "Обязательно",
  },
  en: {
    title: "ModelDB Masters",
    subtitle:
      "A model_db constructor for managing unique values by column and assembling complete vehicle records.",
    fields: "ModelDB fields",
    values: "Unique values",
    valuesHint:
      "The table shows unique values for the selected column and how many rows already use each value.",
    fieldSearchPlaceholder: "Search field names...",
    valueSearchPlaceholder: "Search values...",
    name: "Field",
    type: "Type",
    value: "Value",
    occurrences: "Rows",
    create: "Add value",
    createTitle: "Add new value",
    createDescription:
      "Creates a placeholder row in model_db so the new value can later be used while assembling a full vehicle.",
    createLabel: "New value",
    save: "Save",
    created: "New value was added to model_db.",
    fieldCount: "fields",
    selectedField: "Selected field",
    dataType: "Data type",
    addAllowed: "Manual add",
    yes: "Yes",
    no: "No",
    accessDenied: "This page is available only to administrators.",
    loadFieldsFailed: "Failed to load model_db fields.",
    loadValuesFailed: "Failed to load unique values.",
    createFailed: "Failed to create a new value.",
    noFieldSelected: "No field selected.",
    addDisabledHint: "Manual value creation is disabled for this field.",
    assembleTitle: "Assemble full record",
    assembleDescription:
      "Create a complete model_db row from the master values that already exist in the catalog.",
    assembleButton: "Assemble record",
    assembleDialogTitle: "New model_db record",
    assembleDialogDescription:
      "Fill the vehicle characteristics. Suggested values are pulled from current unique values in the database.",
    assembleHint:
      "Required fields: region, year, make, model, trim, body, engine, transmission.",
    assembleLoadFailed: "Failed to load master values for record assembly.",
    assembleCreateFailed: "Failed to create model_db record.",
    assembled: "Full model_db record was created successfully.",
    optionsLoaded: "Loaded options",
    pickOrType: "Pick or type a value",
    activeStatus: "Record status",
    active: "Active",
    inactive: "Inactive",
    required: "Required",
  },
} as const;

function resolveRequestError(requestError: unknown, fallback: string) {
  if (
    typeof requestError === "object" &&
    requestError !== null &&
    "detail" in requestError &&
    typeof requestError.detail === "string"
  ) {
    return requestError.detail;
  }

  return fallback;
}

export default function MastersPage() {
  const router = useRouter();
  const { language } = usePreferences();
  const { user } = useAuth();
  const text = TEXT[language];
  const hasAdminAccess = isPrivilegedRole(user?.role);
  const mastersEnabled = isFeatureEnabled("masters");

  const [fields, setFields] = useState<MasterFieldRecord[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [fieldSearch, setFieldSearch] = useState("");
  const [selectedField, setSelectedField] = useState<MasterFieldRecord | null>(null);

  const [values, setValues] = useState<MasterValueRecord[]>([]);
  const [valuesLoading, setValuesLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [valueSearch, setValueSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [assemblyDialogOpen, setAssemblyDialogOpen] = useState(false);
  const [assemblyForm, setAssemblyForm] = useState(DEFAULT_RECORD_FORM);
  const [assemblyOptions, setAssemblyOptions] = useState<
    Partial<Record<(typeof MASTER_RECORD_FIELDS)[number], MasterValueRecord[]>>
  >({});
  const [assemblyLoading, setAssemblyLoading] = useState(false);
  const [assemblySubmitting, setAssemblySubmitting] = useState(false);
  const [assemblyError, setAssemblyError] = useState<string | null>(null);

  const assemblyFields = useMemo(() => {
    const fieldMap = new Map(fields.map((field) => [field.name, field]));
    return MASTER_RECORD_FIELDS.map((fieldName) => fieldMap.get(fieldName)).filter(
      (field): field is MasterFieldRecord => Boolean(field),
    );
  }, [fields]);

  async function loadFieldValues(
    fieldName: string,
    nextPage: number,
    nextPageSize: number,
    nextSearch: string,
  ) {
    setValuesLoading(true);
    setError(null);

    try {
      const payload = await vehicles.masterValues(
        fieldName,
        nextPage,
        nextPageSize,
        nextSearch,
      );
      setValues(payload.results);
      setTotalRecords(payload.count);
    } catch {
      setError(text.loadValuesFailed);
    } finally {
      setValuesLoading(false);
    }
  }

  useEffect(() => {
    if (!mastersEnabled) {
      router.replace("/");
    }
  }, [mastersEnabled, router]);

  useEffect(() => {
    if (!hasAdminAccess) {
      setFieldsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadFields() {
      try {
        setFieldsLoading(true);
        setError(null);
        const records = await vehicles.masterFields();

        if (!isMounted) {
          return;
        }

        setFields(records);
        setSelectedField(records[0] ?? null);
      } catch {
        if (isMounted) {
          setError(text.loadFieldsFailed);
        }
      } finally {
        if (isMounted) {
          setFieldsLoading(false);
        }
      }
    }

    void loadFields();

    return () => {
      isMounted = false;
    };
  }, [hasAdminAccess, text.loadFieldsFailed]);

  useEffect(() => {
    if (!selectedField) {
      setValues([]);
      setTotalRecords(0);
      return;
    }

    void loadFieldValues(selectedField.name, page, pageSize, valueSearch);
  }, [selectedField, page, pageSize, valueSearch]);

  const filteredFields = useMemo(() => {
    if (!fieldSearch.trim()) {
      return fields;
    }

    const needle = fieldSearch.trim().toLowerCase();
    return fields.filter(
      (field) =>
        field.name.toLowerCase().includes(needle) ||
        field.label.toLowerCase().includes(needle),
    );
  }, [fieldSearch, fields]);

  const columns: Column<MasterValueRecord>[] = useMemo(
    () => [
      {
        key: "display_value",
        header: text.value,
        className: "font-medium",
      },
      {
        key: "occurrences",
        header: text.occurrences,
        className: "font-mono text-sm",
      },
    ],
    [text.occurrences, text.value],
  );

  function updateAssemblyField(fieldName: (typeof MASTER_RECORD_FIELDS)[number], value: string) {
    setAssemblyForm((current) => ({
      ...current,
      [fieldName]: value,
    }));
  }

  async function handleCreateValue() {
    if (!selectedField) {
      setCreateError(text.noFieldSelected);
      return;
    }

    try {
      setIsCreating(true);
      setCreateError(null);
      await vehicles.createMasterValue(selectedField.name, newValue);
      toast.success(text.created);
      setDialogOpen(false);
      setNewValue("");
      setPage(1);
      await loadFieldValues(selectedField.name, 1, pageSize, valueSearch);
    } catch (requestError) {
      setCreateError(resolveRequestError(requestError, text.createFailed));
    } finally {
      setIsCreating(false);
    }
  }

  async function openAssemblyDialog() {
    setAssemblyDialogOpen(true);
    setAssemblyError(null);
    setAssemblyLoading(true);

    try {
      const results = await Promise.allSettled(
        MASTER_RECORD_FIELDS.filter((fieldName) => fieldName !== "is_active").map(
          async (fieldName) => {
            const payload = await vehicles.masterValues(fieldName, 1, 1000);
            return [fieldName, payload.results] as const;
          },
        ),
      );

      const nextOptions: Partial<
        Record<(typeof MASTER_RECORD_FIELDS)[number], MasterValueRecord[]>
      > = {};

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          const [fieldName, records] = result.value;
          nextOptions[fieldName] = records;
        }
      });

      setAssemblyOptions(nextOptions);

      const hasFailure = results.some((result) => result.status === "rejected");
      if (hasFailure) {
        setAssemblyError(text.assembleLoadFailed);
      }
    } catch {
      setAssemblyError(text.assembleLoadFailed);
    } finally {
      setAssemblyLoading(false);
    }
  }

  async function handleCreateRecord() {
    try {
      setAssemblySubmitting(true);
      setAssemblyError(null);

      const payload: Partial<
        Record<(typeof MASTER_RECORD_FIELDS)[number], string | number | boolean | null>
      > = {};

      MASTER_RECORD_FIELDS.forEach((fieldName) => {
        const rawValue = assemblyForm[fieldName];

        if (fieldName === "is_active") {
          payload.is_active = rawValue !== "false";
          return;
        }

        const cleanedValue = rawValue.trim();
        if (!cleanedValue) {
          return;
        }

        if (NUMBER_FIELDS.has(fieldName)) {
          payload[fieldName] = Number(cleanedValue);
          return;
        }

        payload[fieldName] = cleanedValue;
      });

      await vehicles.createMasterRecord(payload as MasterRecordPayload);

      toast.success(text.assembled);
      setAssemblyDialogOpen(false);
      setAssemblyForm(DEFAULT_RECORD_FORM);

      if (selectedField) {
        await loadFieldValues(selectedField.name, page, pageSize, valueSearch);
      }
    } catch (requestError) {
      setAssemblyError(resolveRequestError(requestError, text.assembleCreateFailed));
    } finally {
      setAssemblySubmitting(false);
    }
  }

  if (!hasAdminAccess) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {text.accessDenied}
      </div>
    );
  }

  if (!mastersEnabled) {
    return null;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card className="border-border/80 bg-card">
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>{text.title}</CardTitle>
            <CardDescription>{text.subtitle}</CardDescription>
          </div>
          <Button onClick={() => void openAssemblyDialog()}>
            <Wrench className="mr-2 h-4 w-4" />
            {text.assembleButton}
          </Button>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{text.fields}</CardTitle>
            <CardDescription>
              {fields.length} {text.fieldCount}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={fieldSearch}
              onChange={(event) => setFieldSearch(event.target.value)}
              placeholder={text.fieldSearchPlaceholder}
            />

            <div className="max-h-[540px] space-y-1 overflow-y-auto pr-1">
              {filteredFields.map((field) => {
                const isActive = selectedField?.name === field.name;

                return (
                  <button
                    key={field.name}
                    type="button"
                    onClick={() => {
                      setSelectedField(field);
                      setPage(1);
                      setValueSearch("");
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                      isActive
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    <p className="text-sm font-medium">{field.name}</p>
                    <p className="text-xs text-muted-foreground">{field.data_type}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{text.values}</CardTitle>
              <CardDescription>{text.valuesHint}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {text.selectedField}
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {selectedField?.name ?? "-"}
                </p>
              </div>
              <div className="rounded-xl border border-border px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {text.dataType}
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {selectedField?.data_type ?? "-"}
                </p>
              </div>
              <div className="rounded-xl border border-border px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {text.addAllowed}
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {selectedField?.editable ? text.yes : text.no}
                </p>
              </div>
            </CardContent>
          </Card>

          <DataTable<MasterValueRecord>
            title={selectedField?.label ?? text.values}
            columns={columns}
            data={values}
            totalRecords={totalRecords}
            searchPlaceholder={text.valueSearchPlaceholder}
            onSearch={(query) => {
              setValueSearch(query);
              setPage(1);
            }}
            onCreate={
              selectedField?.editable
                ? () => {
                    setCreateError(null);
                    setNewValue("");
                    setDialogOpen(true);
                  }
                : undefined
            }
            texts={{
              createButtonLabel: text.create,
            }}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
            rowKey={(row) => `${selectedField?.name ?? "field"}:${row.display_value}`}
            isLoading={fieldsLoading || valuesLoading}
            toolbarActions={
              <div className="flex items-center gap-2">
                {selectedField && !selectedField.editable ? (
                  <span className="text-xs text-muted-foreground">
                    {text.addDisabledHint}
                  </span>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void openAssemblyDialog()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {text.assembleButton}
                </Button>
              </div>
            }
          />
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
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
              <label className="text-sm text-muted-foreground">{text.name}</label>
              <Input value={selectedField?.name ?? ""} readOnly />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{text.createLabel}</label>
              <Input value={newValue} onChange={(event) => setNewValue(event.target.value)} />
            </div>

            <Button className="w-full" onClick={() => void handleCreateValue()} disabled={isCreating}>
              <Save className="mr-2 h-4 w-4" />
              {text.save}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={assemblyDialogOpen}
        onOpenChange={(open) => {
          setAssemblyDialogOpen(open);
          if (!open) {
            setAssemblyError(null);
            setAssemblyForm(DEFAULT_RECORD_FORM);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{text.assembleDialogTitle}</DialogTitle>
            <DialogDescription>{text.assembleDialogDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {text.assembleHint}
            </div>

            {assemblyError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {assemblyError}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              {assemblyFields.map((field) => {
                const fieldName = field.name as (typeof MASTER_RECORD_FIELDS)[number];
                const options = assemblyOptions[fieldName] ?? [];
                const datalistId = `master-options-${field.name}`;
                const isRequired = REQUIRED_RECORD_FIELD_SET.has(fieldName);
                const isBoolean = fieldName === "is_active";
                const isNumeric = NUMBER_FIELDS.has(fieldName);

                return (
                  <div key={field.name} className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm font-medium text-foreground">{field.label}</label>
                      <span className="text-xs text-muted-foreground">
                        {isRequired ? text.required : `${text.optionsLoaded}: ${options.length}`}
                      </span>
                    </div>

                    {isBoolean ? (
                      <Select
                        value={assemblyForm[fieldName]}
                        onValueChange={(value) => updateAssemblyField(fieldName, value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={text.activeStatus} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">{text.active}</SelectItem>
                          <SelectItem value="false">{text.inactive}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <>
                        <Input
                          type={isNumeric ? "number" : "text"}
                          list={options.length > 0 ? datalistId : undefined}
                          value={assemblyForm[fieldName]}
                          onChange={(event) => updateAssemblyField(fieldName, event.target.value)}
                          placeholder={text.pickOrType}
                        />
                        {options.length > 0 ? (
                          <datalist id={datalistId}>
                            {options.map((option) => (
                              <option
                                key={`${field.name}:${option.display_value}`}
                                value={String(option.value ?? "")}
                              >
                                {option.display_value}
                              </option>
                            ))}
                          </datalist>
                        ) : null}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <Button
              className="w-full"
              onClick={() => void handleCreateRecord()}
              disabled={assemblyLoading || assemblySubmitting}
            >
              <Save className="mr-2 h-4 w-4" />
              {text.assembleButton}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
