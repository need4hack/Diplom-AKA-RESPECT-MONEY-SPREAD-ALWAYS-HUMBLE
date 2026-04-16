"use client";

import { useEffect, useState } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type LanguageCode = "ru" | "en";

const TEXT = {
  ru: {
    title: "Что-то пошло не так",
    description:
      "В приложении произошла непредвиденная ошибка. Мы зафиксировали проблему, но вы можете попробовать обновить страницу.",
    retry: "Попробовать снова",
    goHome: "Перейти на панель",
  },
  en: {
    title: "Something went wrong",
    description:
      "An unexpected error occurred in the application. We've logged the issue, but you can try refreshing the page.",
    retry: "Try again",
    goHome: "Go to Dashboard",
  },
} as const;

function getInitialLanguage(): LanguageCode {
  if (typeof window === "undefined") {
    return "ru";
  }

  return window.localStorage.getItem("app-language") === "en" ? "en" : "ru";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [language] = useState<LanguageCode>(getInitialLanguage);
  const text = TEXT[language];

  useEffect(() => {
    console.error("Global Error Boundary caught:", error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background px-4">
      <div className="mx-auto flex max-w-[500px] flex-col items-center justify-center space-y-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {text.title}
          </h2>
          <p className="max-w-[400px] text-sm text-muted-foreground">
            {text.description}
          </p>
        </div>

        <div className="flex min-w-[200px] flex-col gap-2 sm:flex-row">
          <Button onClick={() => reset()} className="w-full">
            <RefreshCcw className="mr-2 h-4 w-4" />
            {text.retry}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = "/";
            }}
            className="w-full"
          >
            {text.goHome}
          </Button>
        </div>

        {process.env.NODE_ENV === "development" && (
          <div className="mt-8 w-full max-w-full overflow-auto rounded-md bg-muted p-4 text-left text-xs text-destructive">
            <p className="font-mono">{error.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
