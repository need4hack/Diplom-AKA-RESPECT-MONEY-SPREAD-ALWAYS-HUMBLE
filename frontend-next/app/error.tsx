"use client"

import { useEffect } from "react"
import { AlertCircle, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global Error Boundary caught:", error)
  }, [error])

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-[500px] flex-col items-center justify-center text-center space-y-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
          <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-500" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Something went wrong!
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-[400px]">
            An unexpected error occurred in the application. We've logged the issue, but you can try refreshing the page.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 min-w-[200px]">
          <Button onClick={() => reset()} className="w-full">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/'}
            className="w-full"
          >
            Go to Dashboard
          </Button>
        </div>

        {process.env.NODE_ENV === "development" && (
          <div className="mt-8 w-full max-w-full overflow-auto rounded-md bg-zinc-950 p-4 text-left text-xs text-red-400">
            <p className="font-mono">{error.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}
