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
