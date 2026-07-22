import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { db } from "@/DB/drizzle";
import { labsArticles as articles } from "@/DB/labsSchema";
import { requireUser } from "@/lib/labs/auth";
import { cn } from "@/lib/utils";

/**
 * `@tailwindcss/typography` isn't installed in this project, so `prose`
 * utility classes would be no-ops — style each markdown element explicitly
 * instead, using only theme tokens (no hardcoded hex) per the brand rules.
 */
const markdownComponents: Components = {
  h1: ({ className, ...props }) => (
    <h1 className={cn("mt-8 mb-4 text-2xl font-semibold tracking-tight first:mt-0", className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        "mt-8 mb-3 border-b border-border pb-2 text-xl font-semibold tracking-tight text-primary",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn("mt-6 mb-2 text-lg font-semibold tracking-tight", className)} {...props} />
  ),
  h4: ({ className, ...props }) => (
    <h4 className={cn("mt-4 mb-2 text-base font-semibold", className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("mb-4 leading-relaxed text-foreground", className)} {...props} />
  ),
  a: ({ className, ...props }) => (
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a
      className={cn("text-primary underline underline-offset-2 hover:opacity-80", className)}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  strong: ({ className, ...props }) => (
    <strong className={cn("font-semibold text-foreground", className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("mb-4 list-disc space-y-1 pl-6 text-foreground", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("mb-4 list-decimal space-y-1 pl-6 text-foreground", className)} {...props} />
  ),
  li: ({ className, ...props }) => <li className={cn("leading-relaxed", className)} {...props} />,
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn("mb-4 border-l-2 border-primary pl-4 italic text-muted-foreground", className)}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => <hr className={cn("my-8 border-border", className)} {...props} />,
  code: ({ className, ...props }) => (
    <code
      className={cn(
        "rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground",
        className,
      )}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "mb-4 overflow-x-auto rounded-lg border border-border bg-muted p-4 text-sm [&>code]:bg-transparent [&>code]:p-0",
        className,
      )}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="mb-4 overflow-x-auto rounded-lg border border-border">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  ),
  thead: ({ className, ...props }) => <thead className={cn("bg-muted", className)} {...props} />,
  th: ({ className, ...props }) => (
    <th className={cn("border-b border-border p-2 text-left font-semibold text-foreground", className)} {...props} />
  ),
  td: ({ className, ...props }) => (
    <td className={cn("border-b border-border p-2 align-top text-foreground", className)} {...props} />
  ),
};

export default async function LabsArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireUser();

  const { slug } = await params;

  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.slug, slug))
    .limit(1);

  if (!article) {
    notFound();
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{article.title}</h1>
        {article.summary ? (
          <p className="text-lg text-muted-foreground">{article.summary}</p>
        ) : null}
      </div>
      <div className="max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {article.bodyMarkdown}
        </ReactMarkdown>
      </div>
    </article>
  );
}
