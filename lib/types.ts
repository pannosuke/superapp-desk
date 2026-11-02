export const FEED_TYPES = [
  "decision",
  "guild_output",
  "change_request",
  "eod_prep",
  "status",
] as const;

export type FeedType = (typeof FEED_TYPES)[number];
export type FeedPriority = "low" | "normal" | "high" | "urgent";
export type DecisionChoice = "approve" | "decline" | "changes";

export type FeedItem = {
  id: string;
  idempotencyKey: string;
  type: FeedType;
  title: string;
  body: string;
  source: string;
  link?: string;
  priority: FeedPriority;
  needsDecision: boolean;
  createdAt: string;
  done: boolean;
  handledNote?: string;
  choice?: DecisionChoice;
  choiceNote?: string;
  choiceSentAt?: string;
};

export type Disconnected = {
  connected: false;
  missing: string[];
};

export type DraftSummary = {
  id: string;
  subject: string;
  to: string[];
  cc: string[];
  lastModifiedDateTime: string;
  conversationId: string | null;
  hasAttachments: boolean;
};

export type DraftDetail = DraftSummary & {
  bodyHtml: string;
};

export type ThreadMessage = {
  id: string;
  from: string;
  receivedDateTime: string;
  subject: string;
  bodyHtml: string;
  isDraft: boolean;
};

export type AgendaEvent = {
  id: string;
  subject: string;
  start: string;
  end: string;
  location: string;
  clientMeeting: boolean;
  clientName: string | null;
  gccHigh: boolean;
  onlineMeetingUrl: string | null;
  prepUrl: string | null;
};

export type TaskItem = {
  id: string;
  content: string;
  code: string | null;
  title: string;
  priority: number;
  priorityLabel: string;
  due: string | null;
  overdue: boolean;
  duration: string | null;
  url: string;
};

export type TicketItem = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  type: string;
  organization: string;
  changeRequest: boolean;
  approval: string | null;
  link: string | null;
};
