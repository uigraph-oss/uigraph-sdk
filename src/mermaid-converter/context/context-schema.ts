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

        value: z.string().optional(),

        cloud: z.string().optional(),
        service: z.string().optional(),

        src: z.string().optional(),
        animatedIcon: z.string().optional(),

        componentId: z.string().optional(),

        shape: z
          .enum([
            'rectangle',
            'rounded-rect',
            'ellipse',
            'diamond',
            'triangle',
            'parallelogram',
            'trapezoid',
            'hexagon',
            'document',
            'cylinder',
            'delay',
            'off-page-connector',
            'display',
            'collate',
            'sort',
            'terminator',
            'or',
            'database',
            'multiple-documents',
            'subroutine',
            'manual-input',
            'summing-junction',
            'internal-storage',
          ])
          .optional(),

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
            strokeStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
            borderAnimationEnabled: z.boolean().optional(),
          })
          .optional(),

        dbConfig: z
          .object({
            service: z.string(),
            database: z.string(),
            tableName: z.string(),
          })
          .optional(),

        table: z
          .object({
            columns: z.string().array(),
            rows: z.array(z.array(z.string())),
          })
          .optional(),
      })
    )
    .optional(),

  edges: z
    .record(
      z.string(),
      z.object({
        label: z.string().optional(),
        style: z
          .object({
            stroke: z.string().optional(),
            strokeWidth: z.number().optional(),
            strokeStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
            borderAnimationEnabled: z.boolean().optional(),
          })
          .optional(),

        markerStart: z
          .object({
            type: z.string(),
            color: z.string().optional(),
          })
          .optional(),

        markerEnd: z
          .object({
            type: z.string(),
            color: z.string().optional(),
          })
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
