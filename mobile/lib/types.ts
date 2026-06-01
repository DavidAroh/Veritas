// Mirrors src/lib/types.ts from the web app so results render identically.
export type VerificationStatus = 'TRUE' | 'MISLEADING' | 'FALSE' | 'UNVERIFIED'
export type CredibilityLabel =
  | 'Verified' | 'Partially Verified' | 'Misleading' | 'Unverified' | 'False'

export interface Claim {
  claim: string
  verification: VerificationStatus
  confidence: string
  reason: string
}

export interface Source {
  title: string
  url: string
}

export interface AnalysisResult {
  page_summary: string
  credibility_score: number
  credibility_label: CredibilityLabel
  claims: Claim[]
  misinformation_signals: string[]
  source_reliability: string
  final_verdict: string
  user_warning_message: string
  sources: Source[]
}

export interface Settings {
  apiBase: string
  geminiKey: string
  geminiModel: string
  autoAnalyze: boolean
}

export interface HistoryEntry {
  id: string
  url?: string
  title?: string
  result: AnalysisResult
  createdAt: number
}
