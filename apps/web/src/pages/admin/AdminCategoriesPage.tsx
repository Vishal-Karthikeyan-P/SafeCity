import { useState } from 'react'
import { Plus, Edit2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from '@/components/ui/dialog'
import { useAdminCategories } from '@/api/user'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

export function AdminCategoriesPage() {
  const { data: categories = [], isLoading } = useAdminCategories()
  const qc = useQueryClient()
  
  const [isOpen, setIsOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<any>(null)
  const [formData, setFormData] = useState({ name: '', slug: '', icon: '', color: '#1d7eeb' })
  const [submitting, setSubmitting] = useState(false)

  const openModal = (cat?: any) => {
    if (cat) {
      setEditingCat(cat)
      setFormData({ name: cat.name, slug: cat.slug, icon: cat.icon, color: cat.color })
    } else {
      setEditingCat(null)
      setFormData({ name: '', slug: '', icon: '📋', color: '#1d7eeb' })
    }
    setIsOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editingCat) {
        await api.patch(`/admin/categories/${editingCat.id}`, formData)
        toast.success('Category updated')
      } else {
        await api.post('/admin/categories', formData)
        toast.success('Category created')
      }
      qc.invalidateQueries({ queryKey: ['admin-categories'] })
      qc.invalidateQueries({ queryKey: ['categories'] }) // invalidate public too
      setIsOpen(false)
    } catch (err) {
      // handled
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-muted-foreground text-sm">Manage incident categories available to users.</p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading ? (
          [...Array(8)].map((_, i) => <div key={i} className="skeleton h-24 w-full" />)
        ) : (
          categories.map((cat: any) => (
            <Card key={cat.id} className="hover:shadow-md transition-shadow group">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-inner"
                    style={{ backgroundColor: `${cat.color}20` }}
                  >
                    {cat.icon}
                  </div>
                  <div>
                    <p className="font-semibold">{cat.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-xs text-muted-foreground font-mono">{cat.slug}</span>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => openModal(cat)}
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Edit' : 'Add'} Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Name</label>
              <Input 
                required 
                value={formData.name} 
                onChange={(e) => {
                  const val = e.target.value
                  setFormData(p => ({
                    ...p, 
                    name: val,
                    // auto generate slug if new
                    slug: !editingCat ? val.toLowerCase().replace(/[^a-z0-9]/g, '_') : p.slug
                  }))
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Slug (Internal ID)</label>
              <Input required value={formData.slug} onChange={(e) => setFormData(p => ({ ...p, slug: e.target.value }))} disabled={!!editingCat} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Emoji Icon</label>
                <Input required value={formData.icon} onChange={(e) => setFormData(p => ({ ...p, icon: e.target.value }))} className="text-2xl" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Theme Color</label>
                <div className="flex items-center gap-2">
                  <Input type="color" required value={formData.color} onChange={(e) => setFormData(p => ({ ...p, color: e.target.value }))} className="w-12 h-10 p-1" />
                  <Input required value={formData.color} onChange={(e) => setFormData(p => ({ ...p, color: e.target.value }))} className="font-mono text-xs uppercase" />
                </div>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" loading={submitting}>Save Category</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
