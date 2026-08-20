import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@multi-courier-integration-platform/ui/components/alert";
import { TriangleAlertIcon } from "lucide-react";

export function StaleTrackingBanner() {
	return (
		<Alert>
			<TriangleAlertIcon />
			<AlertTitle>Courier unreachable</AlertTitle>
			<AlertDescription>
				Showing the last known database state. Tracking could not reach the
				partner — try Refresh tracking again when the courier is back.
			</AlertDescription>
		</Alert>
	);
}
