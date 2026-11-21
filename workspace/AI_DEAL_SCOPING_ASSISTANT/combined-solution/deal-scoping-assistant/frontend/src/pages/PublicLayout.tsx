import { Outlet } from "react-router"
import { useSystemInfo } from "@/api/hooks/system"
import { AiModeNotice } from "@/components/layout/AiModeNotice"
import { AppShell } from "@/components/layout/AppShell"
import { HomeNav } from "@/components/layout/HomeNav"

/** The sessions home and the not-found page share the same shell as a session. */
export default function PublicLayout() {
  const { data: system } = useSystemInfo()

  return (
    <AppShell
      sidebar={<HomeNav />}
      system={system}
      notice={system ? <AiModeNotice system={system} /> : null}
    >
      <Outlet />
    </AppShell>
  )
}
