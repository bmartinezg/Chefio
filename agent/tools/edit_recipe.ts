import { getNotionToken, requireRecipePage, updateRecipePage } from "../lib/notion_recipes.js";
import { defineTool } from "eve/tools";
import { z } from "zod";

const inputSchema = z
  .object({
    pageId: z.uuid(),
    title: z.string().trim().min(1).max(200).optional(),
    recipe: z.string().trim().min(1).max(100_000).optional(),
  })
  .refine(({ title, recipe }) => title !== undefined || recipe !== undefined, {
    message: "Indica un título o el contenido actualizado de la receta.",
  });

export default defineTool({
  description:
    "Edita el título, el contenido completo o ambos de una receta del Recetario de Notion. Usa primero list_recipes para obtener su pageId.",
  inputSchema,
  async execute({ pageId, title, recipe }, ctx) {
    try {
      const token = getNotionToken();
      const currentRecipe = await requireRecipePage(pageId, token, ctx.abortSignal);
      const page = await updateRecipePage(
        pageId,
        { ...(title ? { title } : {}), ...(recipe ? { recipe } : {}) },
        token,
        ctx.abortSignal,
      );

      return {
        success: true,
        pageId: page.id,
        url: page.url ?? currentRecipe.url,
        title: title ?? currentRecipe.title,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "No se pudo editar la receta.",
      };
    }
  },
});
