import { createRecipePage, getNotionToken } from "../lib/notion_recipes.js";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Guarda una receta completa en una página nueva dentro del Recetario de Notion, después de recibir la confirmación del usuario.",
  inputSchema: z.object({
    title: z.string().trim().min(1).max(200),
    recipe: z.string().trim().min(1).max(100_000),
  }),
  async execute({ title, recipe }, ctx) {
    try {
      const page = await createRecipePage(title, recipe, getNotionToken(), ctx.abortSignal);
      return { success: true, pageId: page.id, url: page.url, title };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "No se pudo guardar la receta en Notion.",
      };
    }
  },
});
