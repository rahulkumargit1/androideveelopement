// Types shared between web and mobile clients (purely informational —
// each client re-declares matching interfaces near its fetch layer).

export type Verdict = "authentic" | "suspicious" | "counterfeit";
export type Role = "admin" | "inspector" | "viewer";

export interface ScanResult {
  id?: number;
  currency: string;
  denomination: string;
  authenticity_score: number;   // 0..1
  confidence: number;           // 0..1
  verdict: Verdict;
  breakdown: {
    subscores: Record<string, number>;
    comparison_of_techniques?: Record<string, number>;
    [k: string]: any;
  };
  created_at?: string;
}
