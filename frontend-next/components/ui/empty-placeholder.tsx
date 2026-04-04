import * as React from "react"
import { cn } from "@/lib/utils"
import { AlertCircle } from "lucide-react"

interface EmptyPlaceholderProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyPlaceholder({
  className,
  icon,
  title,
  description,
  action,
  ...props
}: EmptyPlaceholderProps) {
  return (
    <div
      className={cn(
        "flex min-h-[400px] flex-col items-center justify-center rounded-md border border-dashed border-zinc-200 p-8 text-center animate-in fade-in-50 dark:border-zinc-800",
        className
      )}
      {...props}
    >
      <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
        {icon || (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <AlertCircle className="h-10 w-10 text-zinc-400" />
          </div>
        )}
        <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
        {description && (
          <p className="mb-4 mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  )
}
