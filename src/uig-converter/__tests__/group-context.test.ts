import { Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { ComponentInputType } from '../../components/component-type'
import { buildContextGroups } from '../context/group-context'

const ID_MAP = new Map([['n', 'A']])

function groupNode(data: Record<string, unknown>): Node {
  return { id: 'grp', type: 'group', position: { x: 0, y: 0 }, data }
}

describe('what reaches the group context', () => {
  it('skips a group that has neither a name nor anything in it', () => {
    const contextGroups = buildContextGroups(
      [groupNode({ childNodes: [] })],
      ID_MAP
    )

    expect(contextGroups).toEqual({})
  })

  it('drops a child the diagram no longer holds', () => {
    const contextGroups = buildContextGroups(
      [groupNode({ childNodes: ['n', 'deleted'] })],
      ID_MAP
    )

    expect(contextGroups.grp.nodes).toEqual(['A'])
  })

  it('keeps a nameless group that still holds children', () => {
    const contextGroups = buildContextGroups(
      [groupNode({ childNodes: ['n'] })],
      ID_MAP
    )

    expect(contextGroups.grp.name).toBeUndefined()
  })

  it('keeps a named group that holds nothing', () => {
    const contextGroups = buildContextGroups(
      [
        groupNode({
          componentFields: [
            {
              label: 'Name',
              type: ComponentInputType.TextInput,
              data: [{ value: 'Empty Zone' }],
            },
          ],
        }),
      ],
      ID_MAP
    )

    expect(contextGroups.grp).toEqual({ name: 'Empty Zone', nodes: [] })
  })
})
