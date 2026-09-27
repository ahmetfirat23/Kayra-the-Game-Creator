/**
 * HTTP tool client for the Kayra sandbox bridge.
 * Speaks the same callTool shape createFreestyleTools expects from the MCP client.
 */
export function createSandboxToolClient(execUrl: string, token: string) {
    return {
        async callTool({
            name,
            arguments: toolArguments,
        }: {
            name: string;
            arguments?: Record<string, unknown>;
        }): Promise<{ content: Array<{ type: "text"; text: string }> }> {
            const response = await fetch(execUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ name, arguments: toolArguments }),
                signal: AbortSignal.timeout(240_000),
            });

            if (!response.ok) {
                const body = await response.text().catch(() => "");
                throw new Error(
                    `Sandbox tool call failed (${response.status}): ${body || response.statusText}`,
                );
            }

            return (await response.json()) as {
                content: Array<{ type: "text"; text: string }>;
            };
        },
        async close() {
            // No persistent connection to tear down.
        },
    };
}
