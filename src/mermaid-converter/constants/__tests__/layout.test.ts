import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LAYOUT_RANKER,
  LAYOUT_RANKERS,
  LAYOUT_SPACING,
  SEQUENCE_LAYOUT,
} from '../layout'

describe('sequence layout constants', () => {
  it('measures every distance as a positive number', () => {
    for (const value of Object.values(SEQUENCE_LAYOUT)) {
      expect(value).toBeGreaterThan(0)
    }
  })

  it('keeps a message box between its own floor and its own ceiling', () => {
    expect(SEQUENCE_LAYOUT.MESSAGE_NODE_WIDTH).toBeLessThanOrEqual(
      SEQUENCE_LAYOUT.MESSAGE_MAX_WIDTH
    )
  })

  it('leaves room for text inside a message box at either width', () => {
    expect(SEQUENCE_LAYOUT.MESSAGE_HORIZONTAL_PADDING).toBeLessThan(
      SEQUENCE_LAYOUT.MESSAGE_NODE_WIDTH
    )
    expect(
      SEQUENCE_LAYOUT.MESSAGE_MAX_WIDTH -
        SEQUENCE_LAYOUT.MESSAGE_HORIZONTAL_PADDING
    ).toBeGreaterThanOrEqual(SEQUENCE_LAYOUT.MESSAGE_CHAR_WIDTH)
  })

  it('lets a wrapped label outgrow the box height it starts at', () => {
    expect(
      SEQUENCE_LAYOUT.MESSAGE_TARGET_WRAP_LINES *
        SEQUENCE_LAYOUT.MESSAGE_LINE_HEIGHT +
        SEQUENCE_LAYOUT.MESSAGE_VERTICAL_PADDING
    ).toBeGreaterThan(SEQUENCE_LAYOUT.MESSAGE_NODE_HEIGHT)
  })

  it('wraps onto more than one line before it gives up', () => {
    expect(SEQUENCE_LAYOUT.MESSAGE_TARGET_WRAP_LINES).toBeGreaterThan(1)
  })

  it('fits a plain message and its padding into a plain row', () => {
    expect(
      SEQUENCE_LAYOUT.MESSAGE_NODE_HEIGHT + SEQUENCE_LAYOUT.ROW_VERTICAL_PADDING
    ).toBeLessThanOrEqual(SEQUENCE_LAYOUT.ROW_HEIGHT)
  })

  it('keeps a column wide enough for the widest message it can hold', () => {
    expect(SEQUENCE_LAYOUT.MESSAGE_MAX_WIDTH).toBeLessThan(
      SEQUENCE_LAYOUT.COLUMN_WIDTH
    )
    expect(SEQUENCE_LAYOUT.PARTICIPANT_NODE_WIDTH).toBeLessThan(
      SEQUENCE_LAYOUT.COLUMN_WIDTH
    )
  })

  it('keeps a self message and a note inside their own column', () => {
    expect(SEQUENCE_LAYOUT.SELF_LOOP_OFFSET).toBeLessThan(
      SEQUENCE_LAYOUT.COLUMN_WIDTH / 2
    )
    expect(SEQUENCE_LAYOUT.NOTE_OFFSET).toBeLessThan(
      SEQUENCE_LAYOUT.COLUMN_WIDTH / 2
    )
  })

  it('gives a block frame more room above its rows than below them', () => {
    expect(SEQUENCE_LAYOUT.BLOCK_TOP_PADDING).toBeGreaterThan(
      SEQUENCE_LAYOUT.BLOCK_BOTTOM_PADDING
    )
  })

  it('asks less of a section label than of the block header above it', () => {
    expect(SEQUENCE_LAYOUT.BLOCK_SECTION_PADDING).toBeLessThanOrEqual(
      SEQUENCE_LAYOUT.BLOCK_TOP_PADDING
    )
  })

  it('insets a nested frame by less than the padding it sits in', () => {
    expect(SEQUENCE_LAYOUT.BLOCK_CONTENT_INSET).toBeLessThan(
      SEQUENCE_LAYOUT.BLOCK_SIDE_PADDING
    )
    expect(SEQUENCE_LAYOUT.BLOCK_FRAME_GAP).toBeLessThan(
      SEQUENCE_LAYOUT.BLOCK_SIDE_PADDING
    )
  })
})

describe('flowchart layout constants', () => {
  it('measures every distance as a positive number', () => {
    for (const value of Object.values(LAYOUT_SPACING)) {
      expect(value).toBeGreaterThan(0)
    }
  })

  it('clears the subgraph title before any content is placed under it', () => {
    expect(LAYOUT_SPACING.SUBGRAPH_CONTENT_TOP_MARGIN).toBeLessThan(
      LAYOUT_SPACING.SUBGRAPH_HEADER_HEIGHT
    )
  })

  it('stands top-level containers further apart than sibling nodes', () => {
    expect(
      LAYOUT_SPACING.CONTAINER_SEPARATION_HORIZONTAL
    ).toBeGreaterThanOrEqual(LAYOUT_SPACING.NODE_SEPARATION_HORIZONTAL)
    expect(LAYOUT_SPACING.CONTAINER_SEPARATION_VERTICAL).toBeGreaterThanOrEqual(
      LAYOUT_SPACING.NODE_SEPARATION_VERTICAL
    )
  })

  it('stands nested subgraphs further apart than the nodes inside them', () => {
    expect(
      LAYOUT_SPACING.NESTED_SUBGRAPH_SEPARATION_HORIZONTAL
    ).toBeGreaterThanOrEqual(LAYOUT_SPACING.NODE_SEPARATION_HORIZONTAL)
    expect(
      LAYOUT_SPACING.NESTED_SUBGRAPH_SEPARATION_VERTICAL
    ).toBeGreaterThanOrEqual(LAYOUT_SPACING.NODE_SEPARATION_VERTICAL)
  })

  it('never crowds mixed content closer than plain nodes of the same rank', () => {
    expect(
      LAYOUT_SPACING.MIXED_CONTENT_HORIZONTAL_SPACING
    ).toBeGreaterThanOrEqual(LAYOUT_SPACING.NODE_SEPARATION_HORIZONTAL)
    expect(
      LAYOUT_SPACING.MIXED_CONTENT_VERTICAL_SPACING
    ).toBeGreaterThanOrEqual(LAYOUT_SPACING.NODE_SEPARATION_VERTICAL)
  })

  it('margins the whole diagram more generously than a subgraph edge', () => {
    expect(LAYOUT_SPACING.META_GRAPH_MARGIN).toBeGreaterThan(
      LAYOUT_SPACING.SUBGRAPH_PADDING
    )
    expect(LAYOUT_SPACING.NESTED_CONTENT_MARGIN).toBeGreaterThan(
      LAYOUT_SPACING.SUBGRAPH_PADDING
    )
  })
})

describe('layout rankers', () => {
  it('defaults to one of the rankers it offers', () => {
    expect(Object.values(LAYOUT_RANKERS)).toContain(DEFAULT_LAYOUT_RANKER)
  })
})
