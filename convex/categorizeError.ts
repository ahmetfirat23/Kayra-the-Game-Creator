/**
 * Categorizes error types for user-friendly messages
 */
export function categorizeError(errorMessage: string): {
    userMessage: string;
    shouldRethrow: boolean;
} {
    const isToolOutputError = errorMessage.includes("No tool output found for function call");
    const isToolCallError = errorMessage.includes("tool call") ||
        errorMessage.includes("Tool call") ||
        errorMessage.includes("function call") ||
        errorMessage.includes("Invalid tool");
    const isToolExecutionError = errorMessage.includes("Error calling tool") ||
        errorMessage.includes("Tool execution failed") ||
        errorMessage.includes("callTool");
    const isToolValidationError = errorMessage.includes("Invalid tool arguments") ||
        errorMessage.includes("schema") ||
        errorMessage.includes("validation");
    const isStreamInterrupted = errorMessage.includes("stream") && (
        errorMessage.includes("interrupted") ||
        errorMessage.includes("closed") ||
        errorMessage.includes("aborted")
    );
    const isMcpTimeout = errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT");
    const isConnectionError = errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("ECONNRESET") ||
        errorMessage.includes("network");

    if (isToolOutputError || isToolCallError || isToolExecutionError) {
        return {
            userMessage: "Connection interrupted: The AI's response was interrupted while executing an action. This can happen due to temporary connection issues. Please try sending your message again, or check the current state of your game to see what was completed.",
            shouldRethrow: false,
        };
    }

    if (isToolValidationError) {
        return {
            userMessage: "Tool validation error: The AI tried to use a tool incorrectly. Please try rephrasing your request or try again.",
            shouldRethrow: false,
        };
    }

    if (isStreamInterrupted) {
        return {
            userMessage: "Stream interrupted: The response was interrupted unexpectedly. Please try again.",
            shouldRethrow: false,
        };
    }

    if (isMcpTimeout) {
        return {
            userMessage: "Request timed out: The operation took too long to complete. This might happen with complex changes. Please try a simpler request or try again.",
            shouldRethrow: false,
        };
    }

    if (isConnectionError) {
        return {
            userMessage: "Connection error: Lost connection to the development server. Please try again in a moment.",
            shouldRethrow: false,
        };
    }

    return { userMessage: "", shouldRethrow: true };
}
