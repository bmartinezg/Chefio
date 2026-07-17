import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { Resend } from "resend";
import { z } from "zod";

const escapeHtml = (text: string) =>
  text.replace(/[&<>'"]/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!,
  );

const formatInlineText = (text: string) =>
  escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>");

const formatRecipeHtml = (recipe: string) => {
  const lines = recipe.replace(/\\n/g, "\n").replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listType) html.push(`</${listType}>`);
    listType = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length === 1 ? "h2" : "h3";
      html.push(
        `<${level} style="margin:28px 0 12px;color:#234f3e;font-size:${level === "h2" ? "24px" : "19px"};line-height:1.3">${formatInlineText(heading[2])}</${level}>`,
      );
      continue;
    }

    const unorderedItem = line.match(/^[-*•]\s+(.+)$/);
    const orderedItem = line.match(/^\d+[.)]\s+(.+)$/);
    const nextListType = unorderedItem ? "ul" : orderedItem ? "ol" : null;

    if (nextListType) {
      if (listType !== nextListType) {
        closeList();
        listType = nextListType;
        html.push(
          `<${listType} style="margin:10px 0 22px;padding-left:24px;color:#333;line-height:1.65">`,
        );
      }
      html.push(
        `<li style="margin:0 0 9px;padding-left:4px">${formatInlineText((unorderedItem ?? orderedItem)![1])}</li>`,
      );
      continue;
    }

    closeList();
    html.push(
      `<p style="margin:0 0 16px;color:#333;font-size:16px;line-height:1.7">${formatInlineText(line)}</p>`,
    );
  }

  closeList();
  return html.join("\n");
};

export default defineTool({
  description: "Envía una receta por email después de recibir la confirmación del usuario.",
  inputSchema: z.object({
    email: z.email(),
    recipe: z.string().min(1),
  }),
  approval: always(),
  async execute({ email, recipe }) {
    if (!process.env.RESEND_API_KEY) {
      return { success: false, error: "RESEND_API_KEY no está configurada." };
    }

    const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "Chefio <ia@brunomg.com>",
      to: email,
      subject: "Tu receta de Chefio",
      text: recipe,
      html: `
        <!doctype html>
        <html lang="es">
          <body style="margin:0;padding:0;background:#f4f1e8;font-family:Arial,Helvetica,sans-serif;color:#333">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f1e8">
              <tr>
                <td align="center" style="padding:32px 16px">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:650px;background:#fff;border-radius:18px;overflow:hidden">
                    <tr>
                      <td align="center" style="background:#234f3e;padding:30px;color:#fff">
                        <h1 style="margin:0;font-size:30px;line-height:1.2">Chefio</h1>
                        <p style="margin:8px 0 0;color:#dce9e3;font-size:15px;line-height:1.4">Tu ayudante de cocina</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:32px 36px">
                        ${formatRecipeHtml(recipe)}
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="background:#234f3e;padding:20px;color:#fff;font-size:16px;line-height:1.4">¡Buen provecho!</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>`,
    });

    return error
      ? { success: false, error: error.message }
      : { success: true, emailId: data?.id, recipient: email };
  },
});
