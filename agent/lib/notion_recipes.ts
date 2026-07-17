const NOTION_API_URL = "https://api.notion.com/v1";
const NOTION_API_VERSION = "2026-03-11";
const DEFAULT_PARENT_PAGE_TITLE = "Recetario";
const MAX_RICH_TEXT_LENGTH = 2_000;
const MAX_BLOCKS_PER_REQUEST = 100;

type NotionBlockType =
  | "paragraph"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "bulleted_list_item"
  | "numbered_list_item"
  | "quote";

export type NotionBlock = {
  object: "block";
  type: NotionBlockType;
} & Partial<
  Record<NotionBlockType, { rich_text: Array<{ type: "text"; text: { content: string } }> }>
>;

type NotionError = {
  message?: string;
};

export type NotionPage = {
  object: "page";
  id: string;
  url?: string;
  properties?: Record<string, { type?: string; title?: Array<{ plain_text?: string }> }>;
};

type NotionChildPage = {
  object: "block";
  id: string;
  type: "child_page";
  child_page: { title: string };
  created_time?: string;
  last_edited_time?: string;
};

type NotionBlockList = {
  results: Array<NotionChildPage | { object: "block"; id: string; type: string }>;
  has_more: boolean;
  next_cursor: string | null;
};

export type RecipeSummary = {
  pageId: string;
  title: string;
  url: string;
  createdTime?: string;
  lastEditedTime?: string;
};

export const getNotionToken = () => {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN no está configurado.");
  return token;
};

export const notionRequest = async <T>(
  path: string,
  token: string,
  abortSignal: AbortSignal,
  init: RequestInit = {},
): Promise<T> => {
  const response = await fetch(`${NOTION_API_URL}${path}`, {
    ...init,
    signal: abortSignal,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_API_VERSION,
      ...init.headers,
    },
  });

  const body = (await response.json()) as T & NotionError;
  if (!response.ok) {
    throw new Error(body.message ?? `Notion respondió con HTTP ${response.status}.`);
  }

  return body;
};

const getPageTitle = (page: NotionPage) => {
  const titleProperty = Object.values(page.properties ?? {}).find(
    (property) => property.type === "title",
  );

  return (titleProperty?.title ?? []).map((part) => part.plain_text ?? "").join("");
};

export const resolveParentPageId = async (token: string, abortSignal: AbortSignal) => {
  if (process.env.NOTION_PARENT_PAGE_ID) return process.env.NOTION_PARENT_PAGE_ID;

  const targetTitle = process.env.NOTION_PARENT_PAGE_TITLE ?? DEFAULT_PARENT_PAGE_TITLE;
  const search = await notionRequest<{ results: NotionPage[] }>(
    "/search",
    token,
    abortSignal,
    {
      method: "POST",
      body: JSON.stringify({
        query: targetTitle,
        filter: { property: "object", value: "page" },
        page_size: 100,
      }),
    },
  );

  const matches = search.results.filter(
    (page) => page.object === "page" && getPageTitle(page) === targetTitle,
  );

  if (matches.length === 0) {
    throw new Error(
      `No se encontró la página "${targetTitle}" compartida con la integración de Notion.`,
    );
  }

  if (matches.length > 1) {
    throw new Error(
      `Hay varias páginas llamadas "${targetTitle}". Configura NOTION_PARENT_PAGE_ID para elegir una.`,
    );
  }

  return matches[0].id;
};

const splitText = (text: string) => {
  const characters = Array.from(text);
  const chunks: string[] = [];

  for (let index = 0; index < characters.length; index += MAX_RICH_TEXT_LENGTH) {
    chunks.push(characters.slice(index, index + MAX_RICH_TEXT_LENGTH).join(""));
  }

  return chunks;
};

const createBlocks = (type: NotionBlockType, text: string): NotionBlock[] =>
  splitText(text).map((content) => ({
    object: "block",
    type,
    [type]: {
      rich_text: [{ type: "text", text: { content } }],
    },
  }));

export const recipeToBlocks = (recipe: string): NotionBlock[] =>
  recipe.replaceAll("\r\n", "\n").split("\n").flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed) return [];

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      return createBlocks(`heading_${heading[1].length}` as NotionBlockType, heading[2]);
    }

    const bullet = /^[-*+]\s+(.+)$/.exec(trimmed);
    if (bullet) return createBlocks("bulleted_list_item", bullet[1]);

    const numbered = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (numbered) return createBlocks("numbered_list_item", numbered[1]);

    const quote = /^>\s?(.+)$/.exec(trimmed);
    if (quote) return createBlocks("quote", quote[1]);

    return createBlocks("paragraph", trimmed);
  });

export const appendRecipeBlocks = async (
  pageId: string,
  blocks: NotionBlock[],
  token: string,
  abortSignal: AbortSignal,
  startIndex = 0,
) => {
  for (let index = startIndex; index < blocks.length; index += MAX_BLOCKS_PER_REQUEST) {
    await notionRequest(`/blocks/${pageId}/children`, token, abortSignal, {
      method: "PATCH",
      body: JSON.stringify({
        children: blocks.slice(index, index + MAX_BLOCKS_PER_REQUEST),
        position: { type: "end" },
      }),
    });
  }
};

export const createRecipePage = async (
  title: string,
  recipe: string,
  token: string,
  abortSignal: AbortSignal,
) => {
  const parentPageId = await resolveParentPageId(token, abortSignal);
  const blocks = recipeToBlocks(recipe);
  const page = await notionRequest<NotionPage>("/pages", token, abortSignal, {
    method: "POST",
    body: JSON.stringify({
      parent: { type: "page_id", page_id: parentPageId },
      icon: { type: "emoji", emoji: "🍳" },
      properties: {
        title: {
          type: "title",
          title: [{ type: "text", text: { content: title } }],
        },
      },
      children: blocks.slice(0, MAX_BLOCKS_PER_REQUEST),
    }),
  });

  await appendRecipeBlocks(page.id, blocks, token, abortSignal, MAX_BLOCKS_PER_REQUEST);
  return page;
};

const notionPageUrl = (pageId: string) => `https://www.notion.so/${pageId.replaceAll("-", "")}`;

export const listRecipePages = async (
  token: string,
  abortSignal: AbortSignal,
): Promise<RecipeSummary[]> => {
  const parentPageId = await resolveParentPageId(token, abortSignal);
  const recipes: RecipeSummary[] = [];
  let cursor: string | null = null;

  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (cursor) query.set("start_cursor", cursor);

    const response: NotionBlockList = await notionRequest(
      `/blocks/${parentPageId}/children?${query}`,
      token,
      abortSignal,
    );

    for (const block of response.results) {
      if (block.type !== "child_page") continue;
      const childPage = block as NotionChildPage;
      recipes.push({
        pageId: childPage.id,
        title: childPage.child_page.title,
        url: notionPageUrl(childPage.id),
        createdTime: childPage.created_time,
        lastEditedTime: childPage.last_edited_time,
      });
    }

    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);

  return recipes;
};

export const requireRecipePage = async (
  pageId: string,
  token: string,
  abortSignal: AbortSignal,
) => {
  const recipes = await listRecipePages(token, abortSignal);
  const recipe = recipes.find((item) => item.pageId === pageId);

  if (!recipe) {
    throw new Error("La receta indicada no pertenece al Recetario de Notion.");
  }

  return recipe;
};

export const updateRecipePage = async (
  pageId: string,
  changes: { title?: string; recipe?: string },
  token: string,
  abortSignal: AbortSignal,
) => {
  const properties = changes.title
    ? {
        title: {
          type: "title",
          title: [{ type: "text", text: { content: changes.title } }],
        },
      }
    : undefined;

  const page = await notionRequest<NotionPage>(`/pages/${pageId}`, token, abortSignal, {
    method: "PATCH",
    body: JSON.stringify({
      ...(properties ? { properties } : {}),
      ...(changes.recipe ? { erase_content: true } : {}),
    }),
  });

  if (changes.recipe) {
    await appendRecipeBlocks(pageId, recipeToBlocks(changes.recipe), token, abortSignal);
  }

  return page;
};

export const trashRecipePage = async (
  pageId: string,
  token: string,
  abortSignal: AbortSignal,
) =>
  notionRequest<NotionPage>(`/pages/${pageId}`, token, abortSignal, {
    method: "PATCH",
    body: JSON.stringify({ in_trash: true }),
  });
