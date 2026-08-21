import { Button } from "@multi-courier-integration-platform/ui/components/button";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type CopyValueButtonProps = {
	value: string;
	/** Spoken / toast label, e.g. "order id" or "AWB". */
	label: string;
	className?: string;
};

export function CopyValueButton({
	value,
	label,
	className,
}: CopyValueButtonProps) {
	const [copied, setCopied] = useState(false);

	const onCopy = async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			toast.success(`Copied ${label}`);
			window.setTimeout(() => setCopied(false), 1_500);
		} catch {
			toast.error("Could not copy to clipboard");
		}
	};

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-xs"
			className={className}
			aria-label={`Copy ${label}`}
			onClick={(event) => {
				event.stopPropagation();
				void onCopy();
			}}
		>
			{copied ? <CheckIcon /> : <CopyIcon />}
		</Button>
	);
}
