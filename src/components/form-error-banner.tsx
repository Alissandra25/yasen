import { AlertCircle } from "lucide-react";

/** Spec mockup 23's post-submit error summary: a banner, not a toast — errors stay inline and
 * visible until fixed, instead of disappearing on their own like a success toast would. */
export function FormErrorBanner({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-destructive">{title}</p>
        {description && (
          <p className="text-sm text-destructive/90">{description}</p>
        )}
      </div>
    </div>
  );
}
