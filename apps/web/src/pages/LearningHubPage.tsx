import { useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Search, BookOpen, AlertCircle, Phone, Scale, CheckCircle2, XCircle,
  X, ChevronLeft, ChevronRight, Filter, Sparkles, MessageSquare
} from 'lucide-react'
import { useLearningArticles, useLearningCategories, type Article, type LearningCategory } from '@/api/learning'
import { useChatStore } from '@/store/chatStore'
import { cn } from '@/lib/utils'

// ── Skeleton ─────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3 animate-pulse">
      <div className="h-4 w-24 bg-muted rounded-full" />
      <div className="h-5 w-3/4 bg-muted rounded" />
      <div className="h-4 w-full bg-muted rounded" />
      <div className="h-4 w-2/3 bg-muted rounded" />
    </div>
  )
}

// ── Article Detail Modal ──────────────────────────────────────

function ArticleModal({ article, onClose }: { article: Article; onClose: () => void }) {
  const sections = [
    { label: "What To Do (Do's)", icon: CheckCircle2, color: 'text-emerald-500', content: article.content_dos },
    { label: "What Not To Do (Don'ts)", icon: XCircle, color: 'text-red-500', content: article.content_donts },
    { label: 'Emergency Steps', icon: AlertCircle, color: 'text-orange-500', content: article.emergency_steps },
    { label: 'Helpline Numbers', icon: Phone, color: 'text-blue-500', content: article.helpline_numbers },
    { label: 'Legal Information', icon: Scale, color: 'text-purple-500', content: article.legal_info },
  ].filter((s) => s.content)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium px-2 py-0.5 bg-primary/10 text-primary rounded-full">
              {article.category?.icon} {article.category?.name}
            </span>
          </div>
          <DialogTitle className="text-xl leading-snug">{article.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 mt-2">
          <div className="p-4 bg-muted/50 rounded-xl text-sm leading-relaxed text-foreground/80">
            {article.overview}
          </div>
          {sections.map(({ label, icon: Icon, color, content }) => (
            <div key={label} className="space-y-2">
              <div className={cn('flex items-center gap-2 font-semibold text-sm', color)}>
                <Icon className="w-4 h-4" />
                {label}
              </div>
              <div className="pl-6 space-y-1">
                {content!.split('\n').map((line, i) => (
                  <p key={i} className="text-sm text-foreground/75 leading-relaxed">{line}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Category Card ─────────────────────────────────────────────

function CategoryCard({
  category, isSelected, onClick,
}: {
  category: LearningCategory; isSelected: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group text-left w-full rounded-xl border p-4 transition-all duration-200',
        'hover:shadow-md hover:border-primary/40',
        isSelected ? 'border-primary bg-primary/5 shadow-md' : 'bg-card border-border',
      )}
    >
      <div className="text-3xl">{category.icon}</div>
      <p className={cn('font-semibold mt-2 text-sm', isSelected && 'text-primary')}>
        {category.name}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
        {category.description}
      </p>
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export function LearningHubPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [showCategories, setShowCategories] = useState(true)

  const { data: categories, isLoading: catsLoading } = useLearningCategories()
  const { data, isLoading } = useLearningArticles(page, 12, categoryId, debouncedSearch)

  const handleSearch = useCallback((val: string) => {
    setSearch(val)
    clearTimeout((handleSearch as any)._t)
    ;(handleSearch as any)._t = setTimeout(() => {
      setDebouncedSearch(val)
      setPage(1)
    }, 350)
  }, [])

  const handleCategorySelect = (id: string | undefined) => {
    setCategoryId(id)
    setPage(1)
  }

  const clearFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setCategoryId(undefined)
    setPage(1)
  }

  const hasFilters = !!search || !!categoryId
  const selectedCategory = categories?.find((c) => c.id === categoryId)

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Safety Learning Hub</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Guides, best practices, emergency procedures, and legal information.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => useChatStore.getState().openChat()}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:shadow"
            size="sm"
          >
            <Sparkles className="w-4 h-4 mr-1.5 text-amber-300" />
            Ask SafeCity AI
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCategories((v) => !v)} className="shrink-0">
            <Filter className="w-4 h-4 mr-2" />
            {showCategories ? 'Hide' : 'Show'} Categories
          </Button>
        </div>
      </div>

      {/* ── Interactive Gemini AI Safety Assistant Banner ────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 p-6 text-white shadow-xl border border-indigo-900/40">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold tracking-wide border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Gemini AI-Powered Learning Hub Integration
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Have Questions About Safety Protocols or Laws?
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              SafeCity AI is grounded directly in verified Learning Hub content, emergency procedures,
              and Indian legal frameworks (POSH Act, POCSO Act, IT Act). Ask questions in real time.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto flex-shrink-0">
            <Button
              onClick={() => useChatStore.getState().openChat()}
              size="lg"
              className="bg-white hover:bg-slate-100 text-slate-950 font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              <MessageSquare className="w-4 h-4 mr-2 text-indigo-600" />
              Chat with SafeCity AI
            </Button>
          </div>
        </div>

        {/* Quick Prompt Pills */}
        <div className="relative z-10 mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Quick Prompts:</span>
          {[
            "How does SafeCity Emergency SOS work?",
            "What to do during a fire outbreak?",
            "What are my rights under POSH Act 2013?",
            "What to do if scammed by financial cyber fraud?",
            "Night travel personal safety tips",
          ].map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => useChatStore.getState().openChat(prompt)}
              className="bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 px-3 py-1 rounded-full transition-colors flex items-center gap-1.5"
            >
              <span>👉</span>
              <span>{prompt}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Category cards */}
      {showCategories && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Browse by Category</h2>
            {categoryId && (
              <button onClick={() => handleCategorySelect(undefined)} className="text-xs text-primary hover:underline flex items-center gap-1">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          {catsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {[...Array(8)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {categories?.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  isSelected={categoryId === cat.id}
                  onClick={() => handleCategorySelect(categoryId === cat.id ? undefined : cat.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="learning-search"
            placeholder="Search articles..."
            className="pl-9"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
            <X className="w-4 h-4 mr-1" /> Clear filters
          </Button>
        )}
        {selectedCategory && (
          <Badge variant="secondary" className="shrink-0">
            {selectedCategory.icon} {selectedCategory.name}
          </Badge>
        )}
      </div>

      {/* Articles grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : data?.items?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-2xl border border-dashed">
          <BookOpen className="w-14 h-14 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-semibold text-foreground/60">No articles found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {hasFilters ? 'Try adjusting your search or clearing the category filter.' : 'No articles have been published yet.'}
          </p>
          {hasFilters && (
            <Button variant="outline" className="mt-4" size="sm" onClick={clearFilters}>Clear all filters</Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {data?.items?.map((article) => (
              <Card
                key={article.id}
                className="group hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-primary/30 hover:-translate-y-0.5"
                onClick={() => setSelectedArticle(article)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                      {article.category?.icon} {article.category?.name}
                    </span>
                  </div>
                  <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors line-clamp-2">
                    {article.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-3 text-xs leading-relaxed">
                    {article.overview}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {article.emergency_steps && (
                      <span className="flex items-center gap-1 text-orange-500 font-medium">
                        <AlertCircle className="w-3 h-3" /> Emergency steps
                      </span>
                    )}
                    {article.helpline_numbers && (
                      <span className="flex items-center gap-1 text-blue-500">
                        <Phone className="w-3 h-3" /> Helplines
                      </span>
                    )}
                    {article.legal_info && (
                      <span className="flex items-center gap-1 text-purple-500">
                        <Scale className="w-3 h-3" /> Legal info
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-1 text-primary font-medium">
                      <BookOpen className="w-3 h-3" /> Read more
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data.page} of {data.pages} &middot; {data.total} articles
              </span>
              <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Article detail modal */}
      {selectedArticle && (
        <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
      )}
    </div>
  )
}
