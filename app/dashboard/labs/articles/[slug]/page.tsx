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
    <h1 className={cn("mt-8 mb-4 text-2xl font-bold tracking-tight text-white first:mt-0", className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        "mt-8 mb-3 border-b border-white/10 pb-2 text-xl font-bold tracking-tight text-itbd-blue",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn("mt-6 mb-2 text-lg font-semibold tracking-tight text-white", className)} {...props} />
  ),
  h4: ({ className, ...props }) => (
    <h4 className={cn("mt-4 mb-2 text-base font-semibold text-white", className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("mb-4 leading-relaxed text-white/80", className)} {...props} />
  ),
  a: ({ className, ...props }) => (
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a
      className={cn("text-itbd-blue underline underline-offset-2 hover:opacity-80", className)}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  strong: ({ className, ...props }) => (
    <strong className={cn("font-semibold text-white", className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("mb-4 list-disc space-y-1 pl-6 text-white/80", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("mb-4 list-decimal space-y-1 pl-6 text-white/80", className)} {...props} />
  ),
  li: ({ className, ...props }) => <li className={cn("leading-relaxed", className)} {...props} />,
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn("mb-4 border-l-2 border-itbd-blue pl-4 italic text-white/60", className)}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => <hr className={cn("my-8 border-white/10", className)} {...props} />,
  code: ({ className, ...props }) => (
    <code
      className={cn(
        "rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm text-white",
        className,
      )}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "mb-4 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-4 text-sm [&>code]:bg-transparent [&>code]:p-0",
        className,
      )}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="mb-4 overflow-x-auto rounded-lg border border-white/10">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  ),
  thead: ({ className, ...props }) => <thead className={cn("bg-white/5", className)} {...props} />,
  th: ({ className, ...props }) => (
    <th className={cn("border-b border-white/10 p-2 text-left font-semibold text-white", className)} {...props} />
  ),
  td: ({ className, ...props }) => (
    <td className={cn("border-b border-white/10 p-2 align-top text-white/80", className)} {...props} />
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
        <h1 className="text-3xl font-bold tracking-tight text-white">{article.title}</h1>
        {article.summary ? (
          <p className="text-lg text-white/60">{article.summary}</p>
        ) : null}
      </div>
      <div className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 p-6 backdrop-blur-md">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
        />
        <div className="relative z-10 max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {article.bodyMarkdown}
          </ReactMarkdown>
        </div>
      </div>
    </article>
  );
}
