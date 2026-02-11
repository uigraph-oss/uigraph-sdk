import { EdgeMarker, EdgeMarkerType, MarkerType } from '@xyflow/react'
import { Prettify } from 'daily-code'

export type TEdgeMarkerType = keyof typeof CUSTOM_MARKER_TYPES

export type TCustomEdgeMarkerType = Prettify<
  Omit<EdgeMarker, 'type'> & {
    type: MarkerType | TEdgeMarkerType
  }
>

export const CUSTOM_MARKER_TYPES = {
  erdOne: 'ERD One',
  erdMany: 'ERD Many',
  erdOnlyOne: 'ERD Only One',
  erdZeroOrOne: 'ERD Zero or One',
  erdOneToMany: 'ERD One to Many',
  erdOneOrMany: 'ERD One or Many',
  erdZeroOrMany: 'ERD Zero or Many',
}

export function createEdgeMarker(
  marker: Partial<TCustomEdgeMarkerType> | undefined
): EdgeMarkerType | undefined {
  if (!marker?.type || (marker.type as string) === 'none') return undefined

  if (
    marker.type === MarkerType.Arrow ||
    marker.type === MarkerType.ArrowClosed
  ) {
    return {
      color: 'context-stroke',
      strokeWidth: 1.5,
      ...marker,
    } as EdgeMarker
  }

  return marker.type
}

export function parseEdgeMarker(
  marker: string | EdgeMarkerType | EdgeMarker | undefined
): TCustomEdgeMarkerType | undefined {
  if (!marker) return

  if (typeof marker === 'string') {
    return { type: marker as MarkerType }
  }

  return marker as TCustomEdgeMarkerType
}
