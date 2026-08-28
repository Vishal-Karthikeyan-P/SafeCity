import { useState } from 'react'
import { Plus, Edit2, Trash2, BookOpen, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  useAdminArticles, useCreateArticle, useUpdateArticle, useDeleteArticle,
  useLearningCategories, type Article, type ArticleCreateInput,
} from '@/api/learning'
import { toast } from 'sonner'

// ── Empty form ────────────────────────────────────────────────

const EMPTY_FORM: ArticleCreateInput = {
  title: '',
  overview: '',
  content_dos: '',
  content_donts: '',
  emergency_steps: '',
  helpline_numbers: '',
  legal_info: '',
  category_id: '',
  is_published: true,
}

// ── Main Page ─────────────────────────────────────────────────

export function AdminLearningPage() {
  const [page, setPage] = useState(1)
  const [isOpen, setIsOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null)
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)
  const [form, setForm] = useState<ArticleCreateInput>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const { data, isLoading } = useAdminArticles(page, 15)
  const { data: categories } = useLearningCategories()
  const createArticle = useCreateArticle()
  const updateArticle = useUpdateArticle()
  const deleteArticle = useDeleteArticle()

  const openCreate = () => {
    setEditingArticle(null)
    setForm(EMPTY_FORM)
    setIsOpen(true)
  }

  const openEdit = (article: Article) => {
    setEditingArticle(article)
    setForm({
      title: article.title,
      overview: article.overview,
      content_dos: article.content_dos ?? '',
      content_donts: article.content_donts ?? '',
      emergency_steps: article.emergency_steps ?? '',
      helpline_numbers: article.helpline_numbers ?? '',
      legal_info: article.legal_info ?? '',
      category_id: article.category_id,
      is_published: article.is_published,
    })
    setIsOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.overview.trim() || !form.category_id) {
      toast.error('Title, overview, and category are required.')
      return
    }
    setSubmitting(true)
    try {
      const payload: ArticleCreateInput = {
        ...form,
        content_dos: form.content_dos || undefined,
        content_donts: form.content_donts || undefined,
        emergency_steps: form.emergency_steps || undefined,
        helpline_numbers: form.helpline_numbers || undefined,
        legal_info: form.legal_info || undefined,
      }
      if (editingArticle) {
        await updateArticle.mutateAsync({ id: editingArticle.id, data: payload })
        toast.success('Article updated')
      } else {
        await createArticle.mutateAsync(payload)
        toast.success('Article created')
      }
      setIsOpen(false)
    } catch {
      toast.error('Failed to save article')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteArticle.mutateAsync(deleteTarget.id)
      toast.success('Article deleted')
      setDeleteTarget(null)
    } catch {
      toast.error('Failed to delete article')
    }
  }

  const field = (key: keyof ArticleCreateInput) => ({
    value: (form[key] as string) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value })),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Learning Articles</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage safety guides and educational content.
          </p>
        </div>
        <Button id="create-article-btn" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> New Article
        </Button>
      </div>

      {/* Stats */}
      {data && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="w-4 h-4" />
          {data.total} article{data.total !== 1 ? 's' : ''} total
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Title</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Category</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Updated</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b">
                      {[...Array(5)].map((__, j) => (
                        <td key={j} className="px-5 py-3">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data?.items?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16 text-muted-foreground">
                      <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p>No articles yet. Click &ldquo;New Article&rdquo; to create one.</p>
                    </td>
                  </tr>
                ) : (
                  data?.items?.map((article) => (
                    <tr key={article.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 max-w-xs">
                        <p className="font-medium truncate">{article.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {article.overview}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                          {article.category?.icon} {article.category?.name ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={article.is_published ? 'default' : 'secondary'}>
                          {article.is_published ? (
                            <><Eye className="w-3 h-3 mr-1" /> Published</>
                          ) : (
                            <><EyeOff className="w-3 h-3 mr-1" /> Draft</>
                          )}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">
                        {new Date(article.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(article)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(article)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {data.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingArticle ? 'Edit Article' : 'New Article'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">Title *</label>
              <Input required placeholder="Article title" {...field('title')} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Category *</label>
              <Select
                value={form.category_id}
                onValueChange={(v) => setForm((p) => ({ ...p, category_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Overview *</label>
              <Textarea
                required
                placeholder="Brief overview of the article"
                rows={3}
                {...field('overview')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Do's</label>
                <Textarea placeholder="What people should do (one per line)" rows={4} {...field('content_dos')} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Don'ts</label>
                <Textarea placeholder="What people should avoid (one per line)" rows={4} {...field('content_donts')} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Emergency Steps</label>
              <Textarea placeholder="Numbered emergency steps (one per line)" rows={4} {...field('emergency_steps')} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Helpline Numbers</label>
              <Input placeholder="e.g. Emergency: 112 | Police: 100" {...field('helpline_numbers')} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Legal Information</label>
              <Textarea placeholder="Relevant laws, acts, and legal information" rows={3} {...field('legal_info')} />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_published"
                checked={form.is_published ?? true}
                onChange={(e) => setForm((p) => ({ ...p, is_published: e.target.checked }))}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="is_published" className="text-sm font-medium">
                Published (visible to all users)
              </label>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : editingArticle ? 'Update Article' : 'Create Article'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Article</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-foreground">&ldquo;{deleteTarget?.title}&rdquo;</span>?
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
