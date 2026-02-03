import z from 'zod'
import { ComponentInputType } from '../components/component-type'

export const contextSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  nodes: z
    .record(
      z.string(),
      z.object({
        type: z.string().optional(),

        cloud: z.string().optional(),

        name: z.string().optional(),

        data: z.record(z.string(), z.unknown()).optional(),

        meta: z
          .record(
            z.string(),
            z.object({
              type: z.enum(Object.values(ComponentInputType)),
              value: z.unknown(),
            })
          )
          .optional(),
      })
    )
    .default({}),
})
