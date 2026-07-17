import { defineMcpClientConnection } from "eve/connections";

const getTavilyApiKey = () => {
  const token = process.env.TAVILY_API_KEY;
  if (!token) throw new Error("TAVILY_API_KEY no está configurada.");
  return token;
};

/* MCP External connections for third party interactions */
export default defineMcpClientConnection({
  url: "https://mcp.tavily.com/mcp/",
  description: "Tavily - Herramienta de busquedas en internet",
  auth: {
    getToken: async () => ({ token: getTavilyApiKey() }),
  },
});
