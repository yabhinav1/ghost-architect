import { z } from "zod";
import { ASSISTANT_PAGES, type AssistantPage } from "./assistant-pages.ts";

const path = z.string().min(1).max(500);
const count = z.number().int().nonnegative();

export const assistantRequestSchema = z.object({
  page: z.enum(Object.keys(ASSISTANT_PAGES) as [AssistantPage, ...AssistantPage[]]).optional(),
  repoUrl: z.string().min(1).max(2048).optional(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(8000),
  })).min(1).max(16).refine((messages) => messages.at(-1)?.role === "user", "The last message must be a user question"),
  context: z.object({
    mode: z.enum(["layoffs", "notice"]).optional(),
    selectedFile: path.nullable().optional(),
    departed: z.array(z.string().max(320)).max(500).optional(),
    stats: z.object({ files: count, authors: count, redCount: count, orphanPct: z.number().min(0).max(100) }).optional(),
    topFiles: z.array(z.object({ path, score: z.number().min(0).max(100), orphanShare: z.number().min(0).max(1), commits12m: count, inbound: count })).max(10).optional(),
    knownFiles: z.array(path).max(300).optional(),
  }).default({}),
});
