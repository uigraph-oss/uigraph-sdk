import z from 'zod'
import { ComponentInputType } from '../../components/component-type'

export const contextSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  nodes: z
    .record(
      z.string(),
      z.object({
        type: z.string().optional(),
        name: z.string().optional(),

        text: z.string().optional(),
        cloud: z.string().optional(),
        service: z.string().optional(),

        src: z.string().optional(),
        animatedIcon: z.string().optional(),

        data: z
          .record(
            z.string(),
            z.object({
              type: z.enum(Object.values(ComponentInputType)),
              options: z.array(z.string()).optional(),
              value: z.unknown(),
            })
          )
          .optional(),

        style: z
          .object({
            fill: z.string().optional(),
            stroke: z.string().optional(),
            strokeWidth: z.number().optional(),
            borderRadius: z.number().optional(),
            strokeStyle: z.string().optional(),
            borderAnimationEnabled: z.boolean().optional(),
          })
          .optional(),

        dbConfig: z
          .object({ name: z.string(), tableName: z.string() })
          .optional(),
      })
    )
    .optional(),

  groups: z
    .record(
      z.string(),
      z.object({
        name: z.string().optional(),
        nodes: z.string().array().optional(),
      })
    )
    .optional(),
})
