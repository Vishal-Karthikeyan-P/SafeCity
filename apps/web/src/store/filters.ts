import { create } from 'zustand'

interface FilterState {
  category_id: string | null
  severity: string | null
  status: string | null
  date_from: string | null
  date_to: string | null
  search: string
  sort_by: string
  // Actions
  setFilter: (key: keyof Omit<FilterState, 'setFilter' | 'resetFilters'>, value: string | null) => void
  resetFilters: () => void
}

export const useFilterStore = create<FilterState>((set) => ({
  category_id: null,
  severity: null,
  status: null,
  date_from: null,
  date_to: null,
  search: '',
  sort_by: 'severity',

  setFilter: (key, value) => set({ [key]: value }),

  resetFilters: () =>
    set({
      category_id: null,
      severity: null,
      status: null,
      date_from: null,
      date_to: null,
      search: '',
      sort_by: 'severity',
    }),
}))
