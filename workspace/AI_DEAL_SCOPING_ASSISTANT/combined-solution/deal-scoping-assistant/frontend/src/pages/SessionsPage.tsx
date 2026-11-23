import { NewSessionDialog } from "@/components/sessions/NewSessionDialog"
import { SessionList } from "@/components/sessions/SessionList"
import { PageHeader } from "@/components/shared/PageHeader"
import { SectionCard } from "@/components/shared/SectionCard"

export default function SessionsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Scoping sessions"
        description="From customer input to a traceable scoping package."
        actions={<NewSessionDialog />}
      />
      <SectionCard title="Your sessions">
        <SessionList />
      </SectionCard>
    </div>
  )
}
