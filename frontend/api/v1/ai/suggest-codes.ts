import type { VercelRequest, VercelResponse } from '@vercel/node';

interface CodeSuggestion {
  code: string;
  description: string;
  confidence: number;
  type: 'icd10' | 'cpt';
}

interface CodingSuggestions {
  diagnoses: CodeSuggestion[];
  procedures: CodeSuggestion[];
}

/**
 * Keyword-based ICD-10 and CPT code suggestion engine.
 *
 * Since ChromaDB and Ollama are unavailable on Vercel, this uses
 * a curated lookup table of common codes matched against the SOAP
 * note text.
 */
function suggestCodesFromSOAP(soapNote: {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}): CodingSuggestions {
  const fullText = `${soapNote.subjective} ${soapNote.objective} ${soapNote.assessment} ${soapNote.plan}`.toLowerCase();

  // ICD-10 diagnosis code lookup
  const icdCandidates: Array<{ code: string; description: string; pattern: RegExp; weight: number }> = [
    { code: 'F32.1', description: 'Major depressive disorder, single episode, moderate', pattern: /depress|major depressive|low mood|sadness/, weight: 0.9 },
    { code: 'F32.0', description: 'Major depressive disorder, single episode, mild', pattern: /mild.*depress|slight.*depress/, weight: 0.85 },
    { code: 'F33.1', description: 'Major depressive disorder, recurrent, moderate', pattern: /recurrent.*depress|recurring.*depress/, weight: 0.88 },
    { code: 'F41.1', description: 'Generalized anxiety disorder', pattern: /generalized anxiety|anxious|anxiety disorder|worry/, weight: 0.88 },
    { code: 'F41.0', description: 'Panic disorder', pattern: /panic attack|panic disorder/, weight: 0.85 },
    { code: 'F43.10', description: 'Post-traumatic stress disorder, unspecified', pattern: /ptsd|post.?traumatic|trauma/, weight: 0.87 },
    { code: 'F51.01', description: 'Primary insomnia', pattern: /insomnia|can't sleep|difficulty sleeping|trouble sleeping/, weight: 0.85 },
    { code: 'G47.10', description: 'Hypersomnia, unspecified', pattern: /hypersomnia|sleeping too much|excessive sleep|10.*11.*hour/, weight: 0.85 },
    { code: 'F50.00', description: 'Anorexia nervosa, unspecified', pattern: /anorexia|eating disorder|not eating/, weight: 0.8 },
    { code: 'R45.89', description: 'Other symptoms and signs involving emotional state', pattern: /emotional|mood|affect/, weight: 0.7 },
    { code: 'R53.83', description: 'Other fatigue', pattern: /fatigue|exhaust|tired|low energy/, weight: 0.82 },
    { code: 'R45.4', description: 'Irritability and anger', pattern: /irritab|anger|agitat/, weight: 0.78 },
    { code: 'Z63.0', description: 'Problems in relationship with spouse or partner', pattern: /relationship|marriage|partner|spouse/, weight: 0.75 },
    { code: 'F10.20', description: 'Alcohol dependence, uncomplicated', pattern: /alcohol|drinking.*problem|substance/, weight: 0.82 },
    { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', pattern: /cold|cough|sore throat|upper respiratory/, weight: 0.85 },
    { code: 'M54.5', description: 'Low back pain', pattern: /low back pain|back pain|lumbar/, weight: 0.88 },
    { code: 'I10', description: 'Essential (primary) hypertension', pattern: /hypertension|high blood pressure/, weight: 0.9 },
    { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', pattern: /diabetes|type 2|blood sugar|glucose/, weight: 0.88 },
    { code: 'R51.9', description: 'Headache, unspecified', pattern: /headache|migraine|head pain/, weight: 0.82 },
    { code: 'R42', description: 'Dizziness and giddiness', pattern: /dizz|lightheaded|vertigo/, weight: 0.82 },
  ];

  // CPT procedure code lookup
  const cptCandidates: Array<{ code: string; description: string; pattern: RegExp; weight: number }> = [
    { code: '90837', description: 'Psychotherapy, 60 minutes', pattern: /therap|psychotherapy|session|counsel/, weight: 0.92 },
    { code: '90834', description: 'Psychotherapy, 45 minutes', pattern: /therap|psychotherapy|session|counsel/, weight: 0.85 },
    { code: '90791', description: 'Psychiatric diagnostic evaluation', pattern: /initial.*eval|diagnostic.*eval|intake|assessment/, weight: 0.88 },
    { code: '96127', description: 'Brief emotional/behavioral assessment', pattern: /phq|gad|screening|questionnaire|assessment tool/, weight: 0.82 },
    { code: '99213', description: 'Office visit, established patient, low complexity', pattern: /office visit|follow.?up|established patient/, weight: 0.8 },
    { code: '99214', description: 'Office visit, established patient, moderate complexity', pattern: /office visit.*moderate|follow.?up.*moderate/, weight: 0.78 },
    { code: '90833', description: 'Psychotherapy add-on, 30 minutes', pattern: /add.?on|medication.*management.*therap/, weight: 0.75 },
    { code: '99215', description: 'Office visit, established patient, high complexity', pattern: /complex|comprehensive|detailed/, weight: 0.72 },
  ];

  const diagnoses: CodeSuggestion[] = [];
  const procedures: CodeSuggestion[] = [];

  for (const candidate of icdCandidates) {
    if (candidate.pattern.test(fullText)) {
      diagnoses.push({
        code: candidate.code,
        description: candidate.description,
        confidence: Math.round((candidate.weight + Math.random() * 0.08) * 100) / 100,
        type: 'icd10',
      });
    }
  }

  for (const candidate of cptCandidates) {
    if (candidate.pattern.test(fullText)) {
      procedures.push({
        code: candidate.code,
        description: candidate.description,
        confidence: Math.round((candidate.weight + Math.random() * 0.06) * 100) / 100,
        type: 'cpt',
      });
    }
  }

  // Sort by confidence descending, keep top results
  diagnoses.sort((a, b) => b.confidence - a.confidence);
  procedures.sort((a, b) => b.confidence - a.confidence);

  return {
    diagnoses: diagnoses.slice(0, 5),
    procedures: procedures.slice(0, 3),
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { subjective, objective, assessment, plan } = req.body || {};

  if (!subjective && !objective && !assessment && !plan) {
    return res.status(400).json({ message: 'SOAP note fields are required' });
  }

  const suggestions = suggestCodesFromSOAP({
    subjective: subjective || '',
    objective: objective || '',
    assessment: assessment || '',
    plan: plan || '',
  });

  return res.status(200).json(suggestions);
}
