import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import type { Components } from 'react-markdown'

// Your fallback answers use "•" bullets; Markdown needs "-"
function normalize(text: string) {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/^[ \t]*[•●▪‣]\s+/gm, '- ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

// Only safe link types (blocks javascript: and data:)
const urlTransform = (url: string) => (/^(https?:|mailto:|tel:|\/|#)/i.test(url) ? url : '')

const components: Components = {
    h1: ({ children }) => <h4 className="mt-3 mb-1 text-sm font-bold first:mt-0">{children}</h4>,
    h2: ({ children }) => <h4 className="mt-3 mb-1 text-sm font-bold first:mt-0">{children}</h4>,
    h3: ({ children }) => <h4 className="mt-3 mb-1 text-[13px] font-bold tracking-wide first:mt-0">{children}</h4>,
    h4: ({ children }) => <h4 className="mt-3 mb-1 text-[13px] font-bold first:mt-0">{children}</h4>,
    p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5 marker:text-primary/60">{children}</ul>,
    ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5 marker:font-semibold">{children}</ol>,
    li: ({ children }) => <li className="pl-0.5">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    hr: () => <hr className="my-3 border-border/60" />,
    blockquote: ({ children }) => (
        <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground">{children}</blockquote>
    ),
    a: ({ href, children }) =>
        href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="break-words text-primary underline underline-offset-2 hover:opacity-80">
                {children}
            </a>
        ) : (
            <span>{children}</span>   // blocked / empty links render as plain text
        ),
    code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">{children}</code>,
    pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded-lg bg-muted p-2 text-xs">{children}</pre>,
    table: ({ children }) => (
        <div className="my-2 overflow-x-auto"><table className="w-full border-collapse text-xs">{children}</table></div>
    ),
    th: ({ children }) => <th className="border border-border bg-muted/50 px-2 py-1 text-left font-semibold">{children}</th>,
    td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
}

export function MarkdownMessage({ content }: { content: string }) {
    return (
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} urlTransform={urlTransform} components={components}>
            {normalize(content)}
        </ReactMarkdown>
    )
}