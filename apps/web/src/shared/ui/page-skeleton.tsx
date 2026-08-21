import { Skeleton } from "@multi-courier-integration-platform/ui/components/skeleton";

/** Route-level pending UI — Skeleton, not a custom pulse loader. */
export function PageSkeleton() {
	return (
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
			<Skeleton className="h-8 w-48" />
			<Skeleton className="h-4 w-72" />
			<Skeleton className="h-40 w-full" />
			<Skeleton className="h-24 w-full" />
		</main>
	);
}
