import {
  getNotionToken,
  requireRecipePage,
  trashRecipePage,
} from "../lib/notion_recipes.js";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

export default defineTool({
  description:
    "Mueve una receta del Recetario de Notion a la papelera. Usa primero list_recipes para obtener su pageId.",
  inputSchema: z.object({ pageId: z.uuid() }),
  approval: always(),
  async execute({ pageId }, ctx) {
    try {
      const token = getNotionToken();
      const recipe = await requireRecipePage(pageId, token, ctx.abortSignal);
      await trashRecipePage(pageId, token, ctx.abortSignal);

      return { success: true, pageId, title: recipe.title, movedToTrash: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "No se pudo eliminar la receta.",
      };
    }
  },
});
