import type { VercelRequest, VercelResponse } from '@vercel/node';

interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

/**
 * Extract SOAP note sections from a medical/therapy transcript.
 *
 * Since Ollama is not available on Vercel, this function parses the
 * transcript by speaker role and keyword matching to produce a
 * structured SOAP note.
 */
function generateSOAPFromTranscript(
  transcript: string,
  patientContext?: { name?: string; age?: number; gender?: string; chiefComplaint?: string },
): SOAPNote {
  // Split transcript into turns
  const lines = transcript.split(/(?=(?:Therapist|Doctor|Physician|Provider|Clinician|Client|Patient):)/i);

  const clientLines: string[] = [];
  const providerLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^(Client|Patient):/i.test(trimmed)) {
      clientLines.push(trimmed.replace(/^(Client|Patient):\s*/i, ''));
    } else if (/^(Therapist|Doctor|Physician|Provider|Clinician):/i.test(trimmed)) {
      providerLines.push(trimmed.replace(/^(Therapist|Doctor|Physician|Provider|Clinician):\s*/i, ''));
    }
  }

  // --- Subjective: patient-reported symptoms & concerns ---
  const symptoms: string[] = [];
  const symptomKeywords = /sad|depress|anxious|anxiety|pain|tired|fatigue|exhaust|insomnia|sleep|appetite|weight|stress|mood|energy|motivat|headache|nausea|dizz|breath|chest|cough|fever|swell/i;
  const denialKeywords = /no,?\s*nothing|don't want to hurt|no thoughts of|not suicidal/i;

  for (const line of clientLines) {
    if (symptomKeywords.test(line)) {
      symptoms.push(line);
    }
  }

  let subjective = '';
  if (patientContext?.chiefComplaint) {
    subjective += `Chief Complaint: ${patientContext.chiefComplaint}. `;
  }
  subjective += 'History of Present Illness: ';
  if (symptoms.length > 0) {
    subjective += symptoms.join(' ');
  } else {
    subjective += clientLines.slice(0, 3).join(' ');
  }

  // Check for safety screening
  const safetyDenials = clientLines.filter(l => denialKeywords.test(l));
  if (safetyDenials.length > 0) {
    subjective += ' Patient denies suicidal ideation or intent to self-harm.';
  }

  // --- Objective: provider observations ---
  const observations: string[] = [];
  const objectiveKeywords = /notice|observe|appear|present|posture|speech|affect|eye contact|grooming|psychomotor|vital|BP|heart rate|weight|BMI|temp/i;

  for (const line of providerLines) {
    if (objectiveKeywords.test(line)) {
      observations.push(line);
    }
  }

  let objective = '';
  if (observations.length > 0) {
    objective = 'Mental Status Exam / Clinical Observations: ' + observations.join(' ');
  } else {
    objective = 'Patient attended session as scheduled. Appeared cooperative and engaged in therapeutic dialogue.';
  }

  // --- Assessment: clinical interpretation ---
  const assessmentIndicators: string[] = [];
  const assessmentKeywords = /diagnos|assess|signific|concern|improv|worsen|recurr|episode|symptom|criteria|functionin|sever|moderat|mild/i;

  for (const line of providerLines) {
    if (assessmentKeywords.test(line)) {
      assessmentIndicators.push(line);
    }
  }

  let assessment = '';
  // Detect condition types from transcript
  const depIndicators = /depress|sad|low mood|hopeless|anhedonia|sleep.*too much|hypersomnia|fatigue|unmotivat/i;
  const anxIndicators = /anxi|worry|panic|nervous|restless|racing thoughts/i;
  const isDepression = depIndicators.test(transcript);
  const isAnxiety = anxIndicators.test(transcript);

  if (isDepression && isAnxiety) {
    assessment = 'Patient presents with symptoms consistent with comorbid Major Depressive Disorder and Generalized Anxiety Disorder. ';
  } else if (isDepression) {
    assessment = 'Patient presents with symptoms consistent with Major Depressive Disorder, current episode. ';
  } else if (isAnxiety) {
    assessment = 'Patient presents with symptoms consistent with Generalized Anxiety Disorder. ';
  } else {
    assessment = 'Clinical presentation reviewed. ';
  }

  if (assessmentIndicators.length > 0) {
    assessment += assessmentIndicators.join(' ');
  }

  const hasHypersomnia = /sleep.*too much|10.*11.*hour|hypersomnia|sleeping.*more/i.test(transcript);
  const hasAnhedonia = /stop.*going|couldn't.*bring.*myself|lost interest|don't enjoy/i.test(transcript);
  const hasFatigue = /exhaust|tired|fatigue|low energy|no energy/i.test(transcript);

  const featuresNoted: string[] = [];
  if (hasHypersomnia) featuresNoted.push('hypersomnia');
  if (hasAnhedonia) featuresNoted.push('anhedonia / social withdrawal');
  if (hasFatigue) featuresNoted.push('significant fatigue');
  if (featuresNoted.length > 0) {
    assessment += `Key features: ${featuresNoted.join(', ')}. `;
  }

  if (safetyDenials.length > 0) {
    assessment += 'Safety screening negative for suicidal ideation or self-harm.';
  }

  // --- Plan: treatment & follow-up ---
  const planItems: string[] = [];
  const planKeywords = /let's|we will|aim for|try|recommend|prescrib|refer|follow.?up|schedule|goal|homework|assign|next session|medic|dose|therapy|continu|increas|decreas|monitor/i;

  for (const line of providerLines) {
    if (planKeywords.test(line)) {
      planItems.push(line);
    }
  }

  let plan = '';
  if (planItems.length > 0) {
    plan = planItems.join(' ');
  } else {
    plan = 'Continue current treatment plan. Follow up at next scheduled session.';
  }

  return {
    subjective: subjective.trim(),
    objective: objective.trim(),
    assessment: assessment.trim(),
    plan: plan.trim(),
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

  const { transcript, patientContext } = req.body || {};

  if (!transcript || typeof transcript !== 'string') {
    return res.status(400).json({ message: 'transcript is required' });
  }

  const soapNote = generateSOAPFromTranscript(transcript, patientContext);
  return res.status(200).json(soapNote);
}
