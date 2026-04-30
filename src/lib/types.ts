export type VerificationStatus = 'TRUE' | 'MISLEADING' | 'FALSE' | 'UNVERIFIED'
export type CredibilityLabel = 'Verified' | 'Partially Verified' | 'Misleading' | 'Unverified' | 'False'

export interface Claim {
  claim: string
  verification: VerificationStatus
  confidence: string
  reason: string
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
}

export interface AnalysisRequest {
  url: string
  title: string
  source: string
  content: string
}
