export class InMemoryTokenCache {
	private accessToken: string | undefined;
	private expiresAtMs = 0;

	constructor(private readonly now: () => Date = () => new Date()) {}

	get(): string | undefined {
		if (!this.accessToken) {
			return undefined;
		}
		if (this.now().getTime() >= this.expiresAtMs) {
			this.clear();
			return undefined;
		}
		return this.accessToken;
	}

	set(accessToken: string, expiresAtMs: number): void {
		this.accessToken = accessToken;
		this.expiresAtMs = expiresAtMs;
	}

	clear(): void {
		this.accessToken = undefined;
		this.expiresAtMs = 0;
	}
}
