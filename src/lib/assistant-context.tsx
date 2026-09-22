import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

interface AssistantState {
  open: boolean
  patientId: string | null
  openWith: (patientId?: string | null) => void
  close: () => void
  setPatientId: (id: string | null) => void
}

const Ctx = createContext<AssistantState | null>(null)

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [patientId, setPatientId] = useState<string | null>(null)

  const value = useMemo<AssistantState>(() => ({
    open, patientId,
    openWith: (id = null) => { setPatientId(id); setOpen(true) },
    close: () => setOpen(false),
    setPatientId,
  }), [open, patientId])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAssistant(): AssistantState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAssistant must be used inside <AssistantProvider>')
  return v
}
