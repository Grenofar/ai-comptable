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
