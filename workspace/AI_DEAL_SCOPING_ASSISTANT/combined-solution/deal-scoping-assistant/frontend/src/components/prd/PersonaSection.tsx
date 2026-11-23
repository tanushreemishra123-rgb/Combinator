import { GroundedItem } from "@/components/prd/GroundedItem"
import type { Persona, UserJourney } from "@/api/types"

interface PersonaSectionProps {
  personas: readonly Persona[]
  onSelectId?: (id: string) => void
}

export function PersonaSection({ personas, onSelectId }: PersonaSectionProps) {
  if (personas.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-heading text-sm font-medium tracking-tight">Target users and personas</h3>
      <ul className="flex flex-col gap-2">
        {personas.map((persona) => (
          <GroundedItem
            key={persona.name}
            title={persona.name}
            text={persona.description}
            element={persona}
            onSelectId={onSelectId}
          >
            {persona.needs.length > 0 ? (
              <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm text-muted-foreground">
                {persona.needs.map((need) => (
                  <li key={need}>{need}</li>
                ))}
              </ul>
            ) : null}
          </GroundedItem>
        ))}
      </ul>
    </section>
  )
}

interface JourneySectionProps {
  journeys: readonly UserJourney[]
  onSelectId?: (id: string) => void
}

export function JourneySection({ journeys, onSelectId }: JourneySectionProps) {
  if (journeys.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-heading text-sm font-medium tracking-tight">User journeys</h3>
      <ul className="flex flex-col gap-2">
        {journeys.map((journey) => (
          <GroundedItem
            key={journey.name}
            title={journey.name}
            text={`Actor: ${journey.actor}`}
            element={journey}
            onSelectId={onSelectId}
          >
            <ol className="flex list-decimal flex-col gap-0.5 pl-5 text-sm text-muted-foreground">
              {journey.steps.map((step, index) => (
                <li key={`${step}-${index}`}>{step}</li>
              ))}
            </ol>
          </GroundedItem>
        ))}
      </ul>
    </section>
  )
}
