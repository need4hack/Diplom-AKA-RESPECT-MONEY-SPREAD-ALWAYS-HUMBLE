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
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background px-4">
      <div className="mx-auto flex max-w-[500px] flex-col items-center justify-center text-center space-y-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Something went wrong!
          </h2>
          <p className="max-w-[400px] text-sm text-muted-foreground">
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
          <div className="mt-8 w-full max-w-full overflow-auto rounded-md bg-muted p-4 text-left text-xs text-destructive">
            <p className="font-mono">{error.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}
