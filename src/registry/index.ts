export {
  NODE_TYPE_REGISTRY,
  SHAPE_IDS,
  STROKE_STYLES,
  buildNodeStyleDataPatch,
  getNodeTypeSpec,
  isGeometryEditableNodeType,
} from './node-types'
export type {
  DiagramTypeId,
  NodeStylePatchInput,
  NodeTypeSpec,
  ShapeId,
  StrokeStyleId,
} from './node-types'

export {
  DEFAULT_THEME_ID,
  THEME_REGISTRY,
  THEME_ROLES,
  buildThemeCatalogPromptContext,
  getTheme,
} from './themes'
export type { ThemeColorPair, ThemeRole, ThemeSpec } from './themes'
