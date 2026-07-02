import { Node } from '@xyflow/react'
import z from 'zod'
import { contextSchema } from '../../headless'
import { getFieldString, toRecord } from '../utils'

export function buildContextGroups(
  groupNodes: Node[],
  nodeIdMap: Map<string, string>
): NonNullable<z.infer<typeof contextSchema>['groups']> {
  const contextGroups: NonNullable<z.infer<typeof contextSchema>['groups']> = {}

  for (const groupNode of groupNodes) {
    const groupData = toRecord(groupNode.data) ?? {}
    const childNodes = Array.isArray(groupData.childNodes)
      ? groupData.childNodes
          .map((childId) =>
            typeof childId === 'string' ? nodeIdMap.get(childId) : undefined
          )
          .filter((childId) => childId !== undefined)
      : []

    const componentFields = Array.isArray(groupData.componentFields)
      ? groupData.componentFields
          .map((field) => toRecord(field))
          .filter((field) => field !== undefined)
      : []

    const name = getFieldString(componentFields, 'Name')

    if (!name && childNodes.length === 0) continue

    contextGroups[groupNode.id] = {
      name: name ?? undefined,
      nodes: childNodes,
    }
  }

  return contextGroups
}
