import type { Metadata } from "next";
import { SmartBlock } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { AssistantChat } from "@/components/views/assistant/assistant-chat";
import { getAssistantContext } from "@/server/assistant/queries";

export const metadata: Metadata = { title: "AI Style Studio" };

export default async function AssistantPage() {
  await getAssistantContext();

  return (
    <>
      <PageHeader
        eyebrow="AI"
        title="AI Style Studio"
        description="Your salon co-pilot — answers from live bookings, sales and stock."
      />
      <div className="grid gap-gutter lg:grid-cols-[1fr_20rem]">
        <AssistantChat />
        <SmartBlock className="h-fit">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <Icon name="sparkles" size={18} />
            <span className="eyebrow text-primary!">Preview</span>
          </div>
          <p className="text-body-sm text-secondary">
            The chat is wired end-to-end (UI → <code>/api/assistant/chat</code> → <code>server/assistant</code>) but no model is
            connected yet. Porting the POC engine, tools and streaming is roadmap step 11.
          </p>
        </SmartBlock>
      </div>
    </>
  );
}
