const LABEL_TYPE_PREFIX = /^\s*type:(\w+)\s*[:|-]\s*/i

type PortalNodeType =
  | 'shape'
  | 'image'
  | 'default'
  | 'builder'
  | 'code'
  | 'text'
  | 'table'
  | 'cloud'
  | 'comment'

const TAG_TO_NODE_TYPE: Record<string, PortalNodeType> = {
  builder: 'builder',
  code: 'code',
  text: 'text',
  table: 'table',
  image: 'image',
  cloud: 'cloud',
  comment: 'comment',
  default: 'default',
}

export function parseLabelTag(label: string): {
  tag: string | null
  displayLabel: string
} {
  const match = label.match(LABEL_TYPE_PREFIX)
  if (match) {
    return {
      tag: match[1].toLowerCase(),
      displayLabel: label.slice(match[0].length).trim(),
    }
  }
  return { tag: null, displayLabel: label }
}

export function resolvePortalNodeType(
  hasImageUrl: boolean,
  tag: string | null
): PortalNodeType {
  if (hasImageUrl || tag === 'image') return 'image'
  if (tag && TAG_TO_NODE_TYPE[tag]) return TAG_TO_NODE_TYPE[tag]
  return 'shape'
}
