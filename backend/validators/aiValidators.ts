import { z } from "zod";

export const aiParseSchema = z.object({
  text: z.string().optional(),
  image: z
    .string()
    .optional()
    .refine(
      (v) => !v || v.length < 10_000_000,
      "Image payload is too large (max ~7.5 MB base64)."
    ),
  imageType: z.string().optional(),
  provider: z.enum(["gemini", "openrouter", "openai"]).default("gemini"),
  apiKey: z.string().optional().default(""),
  model: z.string().optional().default("gemini-3.5-flash"),
}).refine(
  (data) => !!(data.text?.trim() || data.image),
  { message: "Either text or image must be provided.", path: ["text"] }
);

export type AiParseInput = z.infer<typeof aiParseSchema>;
