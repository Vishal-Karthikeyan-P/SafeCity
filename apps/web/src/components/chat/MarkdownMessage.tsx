import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import type { Components } from 'react-markdown'

/**
 * Normalise AI output before handing it to react-markdown:
 * • Convert Windows line endings → Unix
 * • Map bullet-point characters (•, ●, ▪, ‣, –) to markdown dashes
 * • Collapse excessive blank lines to at most two
 * • Trim surrounding whitespace
 */
function normalize(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Convert common unicode bullet chars to markdown list syntax
    .replace(/^[ \t]*[•●▪‣–]\s+/gm, '- ')
    // Collapse 3+ blank lines → 2
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Allow only safe URL schemes – blocks javascript: and data:
const urlTransform = (url: string) =>
  /^(https?:|mailto:|tel:|\/|#)/i.test(url) ? url : ''

const components: Components = {
  // Downgrade heading levels so they fit chat bubble proportions
  h1: ({ children }) => <h4 className="mt-3 mb-1 text-sm font-bold first:mt-0">{children}</h4>,
  h2: ({ children }) => <h4 className="mt-3 mb-1 text-sm font-bold first:mt-0">{children}</h4>,
  h3: ({ children }) => <h5 className="mt-2.5 mb-1 text-[13px] font-bold tracking-wide first:mt-0">{children}</h5>,
  h4: ({ children }) => <h5 className="mt-2.5 mb-1 text-[13px] font-semibold first:mt-0">{children}</h5>,

  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,

  ul: ({ children }) => (
    <ul className="my-1.5 list-disc space-y-0.5 pl-5 marker:text-primary/70">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 list-decimal space-y-0.5 pl-5 marker:font-semibold">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-0.5 leading-snug">{children}</li>,

  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic opacity-90">{children}</em>,
  del: ({ children }) => <del className="line-through opacity-60">{children}</del>,

  hr: () => <hr className="my-3 border-border/60" />,

  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/40 pl-3 italic text-muted-foreground">
      {children}
    </blockquote>
  ),

  a: ({ href, children }) =>
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

  // Inline code
  code: ({ children, className }) => {
    // If there's a language class (fenced block), render as block
    const isBlock = Boolean(className)
    if (isBlock) {
      return (
        <code className="font-mono text-[12px] break-all">{children}</code>
      )
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] break-all">
        {children}
      </code>
    )
  },

  // Fenced code block
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-muted p-3 text-[12px] font-mono leading-relaxed max-w-full">
      {children}
    </pre>
  ),

  // GFM tables
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-1.5 text-left font-semibold whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-b border-border/50 px-3 py-1.5">{children}</td>,
}

export const MarkdownMessage = memo(function MarkdownMessage({
  content,
}: {
  content: string
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      urlTransform={urlTransform}
      components={components}
    >
      {normalize(content)}
    </ReactMarkdown>
  )
})