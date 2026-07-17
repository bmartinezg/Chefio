import { getNotionToken, listRecipePages } from "../lib/notion_recipes.js";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Lista todas las recetas guardadas en el Recetario de Notion con su título, ID y enlace.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    try {
      const recipes = await listRecipePages(getNotionToken(), ctx.abortSignal);
      return { success: true, count: recipes.length, recipes };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "No se pudieron listar las recetas.",
      };
    }
  },
});
