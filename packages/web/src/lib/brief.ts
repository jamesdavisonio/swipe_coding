// The decision-brief reader and the Suggested next reader live in @kanban/shared, so the deck and
// the agent's decision notices read a brief the same way. Re-exported here for the web's imports.
export {
  BRIEF_SECTIONS,
  GATE_LABEL,
  LIST_MARKER,
  briefHeadline,
  latestBrief,
  parseBrief,
  suggestedNext,
  withoutReplyLine,
  withoutSuggestedNext,
  type Brief,
  type BriefParts,
  type Gate,
  type PartKey,
} from '@kanban/shared'
