"use server";

import { freestyle } from "./freestyle";

/**
 * Server action to request a Freestyle Dev Server for a repository.
 * This starts the dev server if it's not running and returns its status.
 * 
 * Used by the FreestyleDevServer React component to maintain the dev server
 * and provide live preview URLs.
 */
export async function requestDevServer({ repoId }: { repoId: string }) {
  const {
    ephemeralUrl,
    devCommandRunning,
    installCommandRunning,
    mcpEphemeralUrl,
  } = await freestyle.requestDevServer({ repoId });

  return {
    ephemeralUrl,
    devCommandRunning,
    installCommandRunning,
    mcpEphemeralUrl,
  };
}

/**
 * Server action to download a repository as a tar.gz file.
 * Creates a tarball on the dev server and reads it via the filesystem API.
 */
export async function downloadRepoAsZip({ repoId }: { repoId: string }): Promise<{ 
  success: boolean; 
  data?: string; 
  filename?: string;
  error?: string;
}> {
  try {
    // Get the dev server for this repo - this gives us direct filesystem access
    const devServer = await freestyle.requestDevServer({ repoId });
    
    // Use the MCP client to create the tarball
    const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    
    const mcpClient = new Client(
      { name: "download", version: "1.0.0" },
      { capabilities: {} }
    );
    
    await mcpClient.connect(new StreamableHTTPClientTransport(new URL(devServer.mcpEphemeralUrl)));
    
    try {
      // Create a tar.gz file and base64 encode it directly on the server
      // This avoids any binary data transfer issues
      const tarResult = await mcpClient.callTool({
        name: "exec",
        arguments: { 
          command: "cd /template && rm -f /tmp/project.tar.gz /tmp/project.b64 && tar --exclude='node_modules' --exclude='.git' --exclude='.expo' --exclude='.cache' --exclude='*.log' -czf /tmp/project.tar.gz . 2>&1 && base64 /tmp/project.tar.gz > /tmp/project.b64 && echo 'TAR_DONE' && ls -la /tmp/project.tar.gz /tmp/project.b64" 
        },
      });
      
      let tarInfo = "";
      if (Array.isArray(tarResult.content) && tarResult.content.length > 0) {
        const firstContent = tarResult.content[0];
        if (firstContent && 'text' in firstContent) {
          tarInfo = firstContent.text || "";
        }
      }
      
      console.log("Tar command output:", tarInfo);
      
      if (!tarInfo.includes("TAR_DONE")) {
        throw new Error("Failed to create tar.gz file: " + tarInfo);
      }
      
      // Read the base64-encoded file as text (not binary)
      const base64Content = await devServer.fs.readFile("/tmp/project.b64", "utf-8");
      
      if (!base64Content || base64Content.length < 100) {
        throw new Error(`Base64 file read failed or too small (${base64Content?.length || 0} chars)`);
      }
      
      console.log("Read base64 file via fs API, length:", base64Content.length);
      
      // Clean the base64 string (remove newlines added by base64 command)
      const cleanBase64 = base64Content.replace(/[\s\r\n]+/g, '');
      
      // Close MCP client
      await mcpClient.close().catch(() => {});
      
      // Clean up temp files in background (don't wait, don't fail if it errors)
      devServer.process.exec("rm -f /tmp/project.tar.gz /tmp/project.b64").catch(() => {});
      
      return {
        success: true,
        data: cleanBase64,
        filename: `game-project-${repoId.slice(0, 8)}.tar.gz`,
      };
    } catch (innerError) {
      await mcpClient.close().catch(() => {});
      throw innerError;
    }
  } catch (error) {
    console.error("Error downloading repo:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to download project",
    };
  }
}

