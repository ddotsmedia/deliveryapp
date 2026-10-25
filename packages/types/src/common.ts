import { z } from "zod";

export const Pagination = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});
export type Pagination = z.infer<typeof Pagination>;

export const ProblemDetails = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  code: z.string(),
  correlationId: z.string().optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetails>;

export const Fils = z.number().int().nonnegative();
export type Fils = z.infer<typeof Fils>;
