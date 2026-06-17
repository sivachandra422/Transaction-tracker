import { z } from "zod";

export const searchPagesSchema = z.object({});

export const createDatabaseSchema = z.object({
  parentPageId: z.string({ error: "parentPageId is required." }).min(1),
  title: z.string().optional(),
});

export const verifySchema = z.object({
  notionDatabaseId: z
    .string({ error: "notionDatabaseId is required." })
    .min(1, "notionDatabaseId cannot be empty."),
});

const transactionSchema = z.object({
  amount: z.number({ error: "amount is required." }).positive("amount must be positive."),
  description: z.string().default(""),
  merchant: z.string().default(""),
  category: z.string().default("Other"),
  type: z.enum(["expense", "income"]).default("expense"),
  date: z.string().default(""),
  labels: z.array(z.string()).default([]),
  notionPageId: z.string().optional(),
});

export const syncSchema = z.object({
  notionDatabaseId: z
    .string({ error: "notionDatabaseId is required." })
    .min(1),
  transaction: transactionSchema,
});

export type SyncInput = z.infer<typeof syncSchema>;
export type VerifyInput = z.infer<typeof verifySchema>;
export type CreateDatabaseInput = z.infer<typeof createDatabaseSchema>;
export type SearchPagesInput = z.infer<typeof searchPagesSchema>;
