import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <EmptyState
        icon="search"
        title="We couldn't find that page"
        description="It may have moved, or you may not have access to it."
        action={
          <ButtonLink href="/" variant="secondary" icon="arrow-left">
            Back to Nexife
          </ButtonLink>
        }
      />
    </div>
  );
}
