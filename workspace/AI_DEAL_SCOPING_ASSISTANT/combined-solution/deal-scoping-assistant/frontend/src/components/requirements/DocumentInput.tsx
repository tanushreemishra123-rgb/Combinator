import { PasteDocumentForm } from "@/components/requirements/PasteDocumentForm"
import { UploadDocumentForm } from "@/components/requirements/UploadDocumentForm"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function DocumentInput({ sessionId }: { sessionId: string }) {
  return (
    <>
      <Tabs defaultValue="paste">
        <TabsList>
          <TabsTrigger value="paste">Paste text</TabsTrigger>
          <TabsTrigger value="upload">Upload a file</TabsTrigger>
        </TabsList>
        <TabsContent value="paste" className="pt-4">
          <PasteDocumentForm sessionId={sessionId} />
        </TabsContent>
        <TabsContent value="upload" className="pt-4">
          <UploadDocumentForm sessionId={sessionId} />
        </TabsContent>
      </Tabs>
    </>
  )
}
