import { memo } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

/**
 * Normalise AI output before react-markdown processes it:
 * - Windows line endings → Unix
 * - Unicode bullet chars (•, ●, ▪, ‣, –) → markdown list syntax
 * - Collapse 3+ blank lines → max 2
 * - Trim surrounding whitespace
 */
function normalize(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^[ \t]*[•●▪‣–]\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Allow only safe URL schemes – blocks javascript: and data: URIs
const urlTransform = (url: string) =>
  /^(https?:|mailto:|tel:|\/|#)/i.test(url) ? url : ''

// ── Typed renderers using standard React HTML element props ──────────────────
// react-markdown v10 uses internal hast ExtraProps generics that conflict with
// strict TypeScript. ComponentPropsWithoutRef<tag> is the idiomatic escape hatch.

type H = ComponentPropsWithoutRef<'h4'>
type P = ComponentPropsWithoutRef<'p'>
type UL = ComponentPropsWithoutRef<'ul'>
type OL = ComponentPropsWithoutRef<'ol'>
type LI = ComponentPropsWithoutRef<'li'>
type Strong = ComponentPropsWithoutRef<'strong'>
type Em = ComponentPropsWithoutRef<'em'>
type Del = ComponentPropsWithoutRef<'del'>
type Blockquote = ComponentPropsWithoutRef<'blockquote'>
type A = ComponentPropsWithoutRef<'a'>
type Code = ComponentPropsWithoutRef<'code'>
type Pre = ComponentPropsWithoutRef<'pre'>
type Table = ComponentPropsWithoutRef<'table'>
type THead = ComponentPropsWithoutRef<'thead'>
type TH = ComponentPropsWithoutRef<'th'>
type TD = ComponentPropsWithoutRef<'td'>

/* eslint-disable @typescript-eslint/no-explicit-any */
const mdComponents: Record<string, React.ComponentType<any>> = {
  // Downgrade headings to fit chat-bubble proportions
  h1: ({ children }: H) => <h4 className="mt-3 mb-1 text-sm font-bold first:mt-0">{children}</h4>,
  h2: ({ children }: H) => <h4 className="mt-3 mb-1 text-sm font-bold first:mt-0">{children}</h4>,
  h3: ({ children }: H) => <h5 className="mt-2.5 mb-1 text-[13px] font-bold tracking-wide first:mt-0">{children}</h5>,
  h4: ({ children }: H) => <h5 className="mt-2.5 mb-1 text-[13px] font-semibold first:mt-0">{children}</h5>,

  p: ({ children }: P) => (
    <p className="my-1.5 first:mt-0 last:mb-0 leading-relaxed">{children}</p>
  ),

  ul: ({ children }: UL) => (
    <ul className="my-1.5 list-disc space-y-0.5 pl-5 marker:text-primary/70">{children}</ul>
  ),
  ol: ({ children }: OL) => (
    <ol className="my-1.5 list-decimal space-y-0.5 pl-5 marker:font-semibold">{children}</ol>
  ),
  li: ({ children }: LI) => <li className="pl-0.5 leading-snug">{children}</li>,

  strong: ({ children }: Strong) => <strong className="font-semibold">{children}</strong>,
  em:     ({ children }: Em)     => <em className="italic opacity-90">{children}</em>,
  del:    ({ children }: Del)    => <del className="line-through opacity-60">{children}</del>,

  hr: () => <hr className="my-3 border-border/60" />,

  blockquote: ({ children }: Blockquote) => (
    <blockquote className="my-2 border-l-2 border-primary/40 pl-3 italic text-muted-foreground">
      {children}
    </blockquote>
  ),

  a: ({ href, children }: A) =>
    href ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
      >
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),

  code: ({ children, className }: Code) => {
    // className is set for fenced code blocks (e.g. ```js)
    const isBlock = Boolean(className)
    if (isBlock) {
      return <code className="font-mono text-[12px] break-all">{children}</code>
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] break-all">
        {children}
      </code>
    )
  },

  pre: ({ children }: Pre) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-muted p-3 text-[12px] font-mono leading-relaxed max-w-full">
      {children}
    </pre>
  ),

  // GFM table support
  table: ({ children }: Table) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }: THead) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children }: TH) => (
    <th className="border-b border-border px-3 py-1.5 text-left font-semibold whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }: TD) => <td className="border-b border-border/50 px-3 py-1.5">{children}</td>,
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const MarkdownMessage = memo(function MarkdownMessage({
  content,
}: {
  content: string
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      urlTransform={urlTransform}
      // react-markdown v10 uses hast ExtraProps internally; cast to never to
      // bridge the type gap — runtime behaviour is unaffected.
      components={mdComponents as never}
    >
      {normalize(content)}
    </ReactMarkdown>
  )
})
