import z from 'zod'
import { contextSchema } from '../../headless'
import { buildContextEdges } from './edge-context'
import { buildContextGroups } from './group-context'
import { buildContextNodes } from './node-context'

export function buildValidatedContext(
  graphNodes: Parameters<typeof buildContextNodes>[0],
  edges: Parameters<typeof buildContextEdges>[0],
  groupNodes: Parameters<typeof buildContextGroups>[0],
  nodeIdMap: Map<string, string>
): z.infer<typeof contextSchema> {
  const contextNodes = buildContextNodes(graphNodes, nodeIdMap)
  const contextEdges = buildContextEdges(edges, nodeIdMap)
  const contextGroups = buildContextGroups(groupNodes, nodeIdMap)

  const context: z.infer<typeof contextSchema> = {}
  if (Object.keys(contextNodes).length > 0) context.nodes = contextNodes
  if (Object.keys(contextEdges).length > 0) context.edges = contextEdges
  if (Object.keys(contextGroups).length > 0) context.groups = contextGroups

  return contextSchema.parse(context)
}
