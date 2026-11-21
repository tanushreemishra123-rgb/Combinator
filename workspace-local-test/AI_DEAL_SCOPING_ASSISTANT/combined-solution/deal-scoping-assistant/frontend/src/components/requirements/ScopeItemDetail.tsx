import type { ReactNode } from "react"
import { ItemTypeDetails } from "@/components/requirements/ItemTypeDetails"
import { SourceRefCard } from "@/components/requirements/SourceRefCard"
import { traceabilityLinks } from "@/components/requirements/traceability"
import { IdBadge } from "@/components/shared/IdBadge"
import { IdList } from "@/components/shared/IdList"
import { OriginBadge } from "@/components/shared/OriginBadge"
import { PriorityBadge } from "@/components/shared/PriorityBadge"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatDateTime } from "@/lib/format"
import { label } from "@/lib/labels"
import { statusTone, toneBadgeVariant } from "@/lib/status"
import type { ScopeItem, ScopeView } from "@/api/types"
import { ArrowRightIcon } from "lucide-react"

interface ScopeItemDetailProps {
  sessionId: string
  item: ScopeItem
  scope: ScopeView | undefined
  onSelectId?: (id: string) => void
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  )
}

export function ScopeItemDetail({ sessionId, item, scope, onSelectId }: ScopeItemDetailProps) {
  const chain = item.origin === "assumed" ? traceabilityLinks(scope, item) : []
  const sourceRefs = item.source_refs ?? []

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{label(item.type)}</Badge>
        <PriorityBadge priority={item.priority} />
        <OriginBadge origin={item.origin} />
        <Badge variant={toneBadgeVariant(statusTone(item.status))}>{label(item.status)}</Badge>
      </div>

      {item.description ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.description}</p>
      ) : null}

      <ItemTypeDetails item={item} onSelectId={onSelectId} />

      {item.tags?.length ? (
        <Block title="Tags">
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <Badge key={tag} variant="ghost">
                {label(tag)}
              </Badge>
            ))}
          </div>
        </Block>
      ) : null}

      {item.related_ids?.length ? (
        <Block title="Related items">
          <IdList ids={item.related_ids} label="Related items" onSelect={onSelectId} />
        </Block>
      ) : null}

      <Separator />

      <Block title="Source references">
        {sourceRefs.length > 0 ? (
          <div className="flex flex-col gap-3">
            {sourceRefs.map((sourceRef, index) => (
              <SourceRefCard
                key={`${sourceRef.segment_id}-${index}`}
                sessionId={sessionId}
                sourceRef={sourceRef}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {item.absence_note || "Not stated in the customer input."}
          </p>
        )}
      </Block>

      {item.origin === "assumed" ? (
        <Block title="Why this assumption is traceable">
          {chain.length > 0 ? (
            <ol className="flex flex-col gap-2">
              {chain.map((link) => (
                <li key={link.id} className="flex flex-col gap-1 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <IdBadge id={item.id} />
                    <ArrowRightIcon aria-hidden className="size-4 text-muted-foreground" />
                    <IdBadge id={link.id} onSelect={onSelectId} />
                  </div>
                  <span className="text-sm">{link.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {link.source_refs?.length
                      ? `Traced to ${link.source_refs.map((ref) => ref.segment_id).join(", ")}`
                      : link.absence_note || "Not stated in the customer input."}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              No gap or question is linked to this assumption yet.
            </p>
          )}
        </Block>
      ) : null}

      {item.notes ? (
        <Block title="Reviewer notes">
          <p className="text-sm whitespace-pre-wrap">{item.notes}</p>
        </Block>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Version {item.version} · last changed by {label(item.updated_by)} ·{" "}
        {formatDateTime(item.updated_at)}
      </p>
    </div>
  )
}
