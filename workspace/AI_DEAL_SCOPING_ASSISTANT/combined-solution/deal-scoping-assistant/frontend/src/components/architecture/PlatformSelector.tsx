import { Link } from "react-router"
import { useUpdateSession } from "@/api/hooks/sessions"
import { PLATFORMS, platformSelectorState } from "@/components/architecture/platformRules"
import type { PlatformChoice } from "@/components/architecture/platformRules"
import { ErrorState } from "@/components/shared/ErrorState"
import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldTitle } from "@/components/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { label } from "@/lib/labels"
import type { Session } from "@/api/types"

interface PlatformSelectorProps {
  session: Session
  choice: PlatformChoice | null
  onChoose: (choice: PlatformChoice) => void
}

/** AWS, Azure, Google Cloud or a recommendation; what it does depends on the scope state. */
export function PlatformSelector({ session, choice, onChoose }: PlatformSelectorProps) {
  const state = platformSelectorState(session)
  const update = useUpdateSession(session.id)

  const choose = (next: PlatformChoice) => {
    onChoose(next)
    // Before approval the choice is part of the session; afterwards the backend refuses it.
    if (state.mode !== "session") return
    update.mutate(
      next === "recommend"
        ? { cloud_platform: null, platform_mode: "recommended" }
        : { cloud_platform: next, platform_mode: "selected" },
    )
  }

  return (
    <SectionCard title="Cloud platform" description="Pick one, or let the assistant recommend one.">
      <div className="flex flex-col gap-3">
        <Field orientation="horizontal">
          <FieldTitle id="platform-label">Design for</FieldTitle>
          <ToggleGroup
            type="single"
            aria-labelledby="platform-label"
            spacing={2}
            value={choice ?? ""}
            onValueChange={(value) => {
              if (value) choose(value as PlatformChoice)
            }}
          >
            {PLATFORMS.map((platform) => (
              <ToggleGroupItem
                key={platform}
                value={platform}
                disabled={state.mode === "change_request"}
              >
                {label(platform)}
              </ToggleGroupItem>
            ))}
            <ToggleGroupItem value="recommend" disabled={state.mode === "change_request"}>
              Recommend for me
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>
        {state.note ? <FieldDescription>{state.note}</FieldDescription> : null}
        {state.mode === "change_request" ? (
          <div>
            <Button asChild variant="outline" size="sm">
              <Link to={`/sessions/${session.id}/package`}>Change the platform</Link>
            </Button>
          </div>
        ) : null}
        {update.isError ? <ErrorState error={update.error} /> : null}
      </div>
    </SectionCard>
  )
}
