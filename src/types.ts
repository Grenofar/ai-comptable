export type DocType = "quote" | "invoice";
export type DocStatus = "draft" | "sent" | "accepted" | "rejected" | "paid" | "cancelled";

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  vat_number: string | null;
  notes: string | null;
}

export interface DocumentLine {
  id?: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  vat_rate: number;
}

export interface IssuerSnapshot {
  legal_name?: string;
  legal_form?: string | null;
  address?: string | null;
  siret?: string | null;
  vat_number?: string | null;
  email?: string | null;
  phone?: string | null;
  iban?: string | null;
  payment_terms?: string | null;
  legal_notice?: string | null;
}

export interface IssuerProfile extends IssuerSnapshot {
  legal_name: string;
}

export interface Doc {
  id: string;
  organization_id: string;
  client_id: string;
  type: DocType;
  status: DocStatus;
  number: string | null;
  issue_date: string;
  due_date: string | null;
  notes: string | null;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
  source_document_id?: string | null;
  issuer_snapshot?: IssuerSnapshot | null;
  clients?: { name: string } | null;
}

export interface Expense {
  id: string;
  label: string;
  category: string | null;
  amount_cents: number;
  vat_cents: number;
  spent_on: string;
}

export type OrgRole = "owner" | "admin" | "member";

export interface Organization {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface OrgMembership {
  organization_id: string;
  role: OrgRole;
  organizations: { name: string } | null;
}

export interface OrgMember {
  user_id: string;
  role: OrgRole;
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

export interface Profile {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
}

export type ConversationKind = "group" | "dm";

export interface Conversation {
  id: string;
  organization_id: string;
  kind: ConversationKind;
  name: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  profiles?: { display_name: string; avatar_url: string | null } | null;
}

export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assigned_by: string;
  status: TaskStatus;
  due_date: string | null;
  created_at: string;
  assignee?: { display_name: string } | null;
  assigner?: { display_name: string } | null;
}
