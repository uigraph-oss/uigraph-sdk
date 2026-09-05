import { describe, expect, it } from 'vitest'
import {
  NODE_TYPE_REGISTRY,
  SHAPE_IDS,
  buildNodeStyleDataPatch,
  isGeometryEditableNodeType,
} from './node-types'

describe('buildNodeStyleDataPatch', () => {
  it('maps shape/default nodes to fill/stroke/shape fields, clamping ranges', () => {
    expect(
      buildNodeStyleDataPatch('shape', {
        fill: '#1E293B',
        stroke: '#38BDF8',
        strokeWidth: 99,
        strokeStyle: 'dashed',
        cornerRadius: 999,
        textColor: '#F8FAFC',
        textFontSize: 2,
        shape: 'cylinder',
      })
    ).toEqual({
      fill: '#1E293B',
      stroke: '#38BDF8',
      strokeWidth: 10,
      strokeStyle: 'dashed',
      cornerRadius: 64,
      textColor: '#F8FAFC',
      textFontSize: 8,
      shape: 'cylinder',
    })

    expect(buildNodeStyleDataPatch('default', { fill: '#000000' })).toEqual({
      fill: '#000000',
    })
  })

  it('maps group nodes to backgroundColor/borderColor', () => {
    expect(
      buildNodeStyleDataPatch('group', { fill: '#0F172A', stroke: '#334155' })
    ).toEqual({ backgroundColor: '#0F172A', borderColor: '#334155' })
  })

  it('maps text nodes to color/fontSize/borderRadius', () => {
    expect(
      buildNodeStyleDataPatch('text', {
        textColor: '#F8FAFC',
        textFontSize: 18,
        cornerRadius: 12,
      })
    ).toEqual({ color: '#F8FAFC', fontSize: 18, borderRadius: 12 })
  })

  it('maps c4 nodes to fill/stroke/fontColor', () => {
    expect(
      buildNodeStyleDataPatch('c4', { fill: '#1D4ED8', textColor: '#FFFFFF' })
    ).toEqual({ fill: '#1D4ED8', fontColor: '#FFFFFF' })
  })

  it('maps c4Boundary nodes to backgroundColor/borderColor/fontColor', () => {
    expect(
      buildNodeStyleDataPatch('c4Boundary', {
        fill: '#1D4ED8',
        stroke: '#0F172A',
        textColor: '#FFFFFF',
      })
    ).toEqual({
      backgroundColor: '#1D4ED8',
      borderColor: '#0F172A',
      fontColor: '#FFFFFF',
    })
  })

  it('maps sequenceParticipant nodes to color/textColor', () => {
    expect(
      buildNodeStyleDataPatch('sequenceParticipant', {
        stroke: '#38BDF8',
        textColor: '#F8FAFC',
      })
    ).toEqual({ color: '#38BDF8', textColor: '#F8FAFC' })
  })

  it('returns an empty patch for unknown node types', () => {
    expect(buildNodeStyleDataPatch('builder', { fill: '#1D4ED8' })).toEqual({})
    expect(buildNodeStyleDataPatch(undefined, { fill: '#1D4ED8' })).toEqual({})
  })
})

describe('isGeometryEditableNodeType', () => {
  it('matches the previous GEOMETRY_NODE_TYPES set (shape, default, cloud, text, c4)', () => {
    expect(isGeometryEditableNodeType('shape')).toBe(true)
    expect(isGeometryEditableNodeType('default')).toBe(true)
    expect(isGeometryEditableNodeType('cloud')).toBe(true)
    expect(isGeometryEditableNodeType('text')).toBe(true)
    expect(isGeometryEditableNodeType('c4')).toBe(true)
    expect(isGeometryEditableNodeType('group')).toBe(false)
    expect(isGeometryEditableNodeType('c4Boundary')).toBe(false)
    expect(isGeometryEditableNodeType('sequenceParticipant')).toBe(false)
    expect(isGeometryEditableNodeType('builder')).toBe(false)
    expect(isGeometryEditableNodeType(undefined)).toBe(false)
  })
})

describe('NODE_TYPE_REGISTRY', () => {
  it('exposes the full shape vocabulary on shape/default tags', () => {
    expect(NODE_TYPE_REGISTRY.shape.shapes).toBe(SHAPE_IDS)
    expect(NODE_TYPE_REGISTRY.default.shapes).toBe(SHAPE_IDS)
  })
})
