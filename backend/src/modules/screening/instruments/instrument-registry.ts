import {
  InstrumentCategory,
  QuestionType,
  InstrumentQuestion,
  ScoringRule,
  AdministrationRule,
} from '../entities/screening-instrument.entity';

export interface PredefinedInstrument {
  code: string;
  title: string;
  description: string;
  category: InstrumentCategory;
  loincCode: string;
  version: string;
  estimatedMinutes: number;
  questions: InstrumentQuestion[];
  scoringRules: ScoringRule;
  administrationRules: AdministrationRule;
}

// ── PHQ-9 (Patient Health Questionnaire-9) ─────────────────────────
const PHQ9_OPTIONS = [
  { value: '0', label: 'Not at all', score: 0, loincAnswerCode: 'LA6568-5' },
  { value: '1', label: 'Several days', score: 1, loincAnswerCode: 'LA6569-3' },
  { value: '2', label: 'More than half the days', score: 2, loincAnswerCode: 'LA6570-1' },
  { value: '3', label: 'Nearly every day', score: 3, loincAnswerCode: 'LA6571-9' },
];

const PHQ9_QUESTIONS: InstrumentQuestion[] = [
  { id: '44250-9', text: 'Little interest or pleasure in doing things', type: QuestionType.CHOICE, loincCode: '44250-9', options: PHQ9_OPTIONS, required: true },
  { id: '44255-8', text: 'Feeling down, depressed, or hopeless', type: QuestionType.CHOICE, loincCode: '44255-8', options: PHQ9_OPTIONS, required: true },
  { id: '44259-0', text: 'Trouble falling/staying asleep, or sleeping too much', type: QuestionType.CHOICE, loincCode: '44259-0', options: PHQ9_OPTIONS, required: true },
  { id: '44260-8', text: 'Feeling tired or having little energy', type: QuestionType.CHOICE, loincCode: '44260-8', options: PHQ9_OPTIONS, required: true },
  { id: '44261-6', text: 'Poor appetite or overeating', type: QuestionType.CHOICE, loincCode: '44261-6', options: PHQ9_OPTIONS, required: true },
  { id: '44262-4', text: 'Feeling bad about yourself — or that you are a failure or have let yourself or your family down', type: QuestionType.CHOICE, loincCode: '44262-4', options: PHQ9_OPTIONS, required: true },
  { id: '44263-2', text: 'Trouble concentrating on things, such as reading the newspaper or watching television', type: QuestionType.CHOICE, loincCode: '44263-2', options: PHQ9_OPTIONS, required: true },
  { id: '44264-0', text: 'Moving or speaking so slowly that other people could have noticed. Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual', type: QuestionType.CHOICE, loincCode: '44264-0', options: PHQ9_OPTIONS, required: true },
  { id: '44265-7', text: 'Thoughts that you would be better off dead, or of hurting yourself in some way', type: QuestionType.CHOICE, loincCode: '44265-7', options: PHQ9_OPTIONS, required: true },
];

// ── GAD-7 (Generalized Anxiety Disorder-7) ──────────────────────────
const GAD7_OPTIONS = [
  { value: '0', label: 'Not at all', score: 0, loincAnswerCode: 'LA6568-5' },
  { value: '1', label: 'Several days', score: 1, loincAnswerCode: 'LA6569-3' },
  { value: '2', label: 'More than half the days', score: 2, loincAnswerCode: 'LA6570-1' },
  { value: '3', label: 'Nearly every day', score: 3, loincAnswerCode: 'LA6571-9' },
];

const GAD7_QUESTIONS: InstrumentQuestion[] = [
  { id: '44255-8', text: 'Feeling nervous, anxious, or on edge', type: QuestionType.CHOICE, loincCode: '44255-8', options: GAD7_OPTIONS, required: true },
  { id: '44258-2', text: 'Not being able to stop or control worrying', type: QuestionType.CHOICE, loincCode: '44258-2', options: GAD7_OPTIONS, required: true },
  { id: '44260-8', text: 'Worrying too much about different things', type: QuestionType.CHOICE, loincCode: '44260-8', options: GAD7_OPTIONS, required: true },
  { id: '44261-6', text: 'Trouble relaxing', type: QuestionType.CHOICE, loincCode: '44261-6', options: GAD7_OPTIONS, required: true },
  { id: '44262-4', text: 'Being so restless that it is hard to sit still', type: QuestionType.CHOICE, loincCode: '44262-4', options: GAD7_OPTIONS, required: true },
  { id: '44263-2', text: 'Becoming easily annoyed or irritable', type: QuestionType.CHOICE, loincCode: '44263-2', options: GAD7_OPTIONS, required: true },
  { id: '44264-0', text: 'Feeling afraid as if something awful might happen', type: QuestionType.CHOICE, loincCode: '44264-0', options: GAD7_OPTIONS, required: true },
];

// ── AUDIT-C (Alcohol Use Disorders Identification Test-Consumption) ─
const AUDITC_QUESTIONS: InstrumentQuestion[] = [
  {
    id: '68517-2',
    text: 'How many times in the past year have you had X or more drinks in a day? (X = 5 for men, 4 for women)',
    type: QuestionType.CHOICE,
    loincCode: '68517-2',
    helpText: 'A response of ≥1 is considered positive',
    options: [
      { value: '0', label: 'Never', score: 0, loincAnswerCode: 'LA15694-5' },
      { value: '1', label: 'Monthly or less', score: 1, loincAnswerCode: 'LA15694-5' },
      { value: '2', label: '2-4 times a month', score: 2, loincAnswerCode: 'LA15695-2' },
      { value: '3', label: '2-3 times a week', score: 3, loincAnswerCode: 'LA18930-0' },
      { value: '4', label: '4 or more times a week', score: 4, loincAnswerCode: 'LA18931-8' },
    ],
    required: true,
  },
  {
    id: '68519-8',
    text: 'How many standard drinks containing alcohol do you have on a typical day?',
    type: QuestionType.CHOICE,
    loincCode: '68519-8',
    options: [
      { value: '0', label: '1 or 2', score: 0, loincAnswerCode: 'LA15694-5' },
      { value: '1', label: '3 or 4', score: 1, loincAnswerCode: 'LA15695-2' },
      { value: '2', label: '5 or 6', score: 2, loincAnswerCode: 'LA18930-0' },
      { value: '3', label: '7 to 9', score: 3, loincAnswerCode: 'LA18931-8' },
      { value: '4', label: '10 or more', score: 4, loincAnswerCode: 'LA18932-6' },
    ],
    required: true,
  },
  {
    id: '68520-6',
    text: 'How often do you have 6 or more drinks on 1 occasion?',
    type: QuestionType.CHOICE,
    loincCode: '68520-6',
    options: [
      { value: '0', label: 'Never', score: 0, loincAnswerCode: 'LA15694-5' },
      { value: '1', label: 'Less than monthly', score: 1, loincAnswerCode: 'LA15695-2' },
      { value: '2', label: 'Monthly', score: 2, loincAnswerCode: 'LA18930-0' },
      { value: '3', label: 'Weekly', score: 3, loincAnswerCode: 'LA18931-8' },
      { value: '4', label: 'Daily or almost daily', score: 4, loincAnswerCode: 'LA18932-6' },
    ],
    required: true,
  },
];

// ── C-SSRS (Columbia-Suicide Severity Rating Scale) ────────────────
const CSSRS_QUESTIONS: InstrumentQuestion[] = [
  {
    id: 'cssrs-1',
    text: 'Have you wished you were dead or wished you could go to sleep and not wake up?',
    type: QuestionType.CHOICE,
    options: [
      { value: 'no', label: 'No', score: 0 },
      { value: 'yes', label: 'Yes', score: 1 },
    ],
    required: true,
  },
  {
    id: 'cssrs-2',
    text: 'Have you actually had any thoughts of killing yourself?',
    type: QuestionType.CHOICE,
    options: [
      { value: 'no', label: 'No', score: 0 },
      { value: 'yes', label: 'Yes', score: 1 },
    ],
    required: true,
  },
  {
    id: 'cssrs-3',
    text: 'Have you been thinking about how you might do this?',
    type: QuestionType.CHOICE,
    helpText: 'If "No" to question 2, answer "No"',
    options: [
      { value: 'no', label: 'No', score: 0 },
      { value: 'yes', label: 'Yes', score: 1 },
    ],
    required: true,
  },
  {
    id: 'cssrs-4',
    text: 'Have you had these thoughts and had some intention of acting on them?',
    type: QuestionType.CHOICE,
    helpText: 'If "No" to question 3, answer "No"',
    options: [
      { value: 'no', label: 'No', score: 0 },
      { value: 'yes', label: 'Yes', score: 1 },
    ],
    required: true,
  },
  {
    id: 'cssrs-5',
    text: 'Have you started to work out or worked out the details of how to kill yourself? Do you intend to carry out this plan?',
    type: QuestionType.CHOICE,
    helpText: 'If "No" to question 4, answer "No"',
    options: [
      { value: 'no', label: 'No', score: 0 },
      { value: 'yes', label: 'Yes', score: 1 },
    ],
    required: true,
  },
  {
    id: 'cssrs-6',
    text: 'Have you ever done anything, started to do anything, or prepared to do anything to end your life?',
    type: QuestionType.CHOICE,
    options: [
      { value: 'no', label: 'No', score: 0 },
      { value: 'yes', label: 'Yes', score: 1 },
    ],
    required: true,
  },
];

// ── DAST-10 (Drug Abuse Screening Test-10) ──────────────────────────
const DAST10_OPTIONS = [
  { value: 'no', label: 'No', score: 0 },
  { value: 'yes', label: 'Yes', score: 1 },
];

const DAST10_QUESTIONS: InstrumentQuestion[] = [
  { id: 'dast-1', text: 'Have you used drugs other than those required for medical reasons?', type: QuestionType.CHOICE, options: DAST10_OPTIONS, required: true },
  { id: 'dast-2', text: 'Have you abused prescription drugs?', type: QuestionType.CHOICE, options: DAST10_OPTIONS, required: true },
  { id: 'dast-3', text: 'Do you abuse more than one drug at a time?', type: QuestionType.CHOICE, options: DAST10_OPTIONS, required: true },
  { id: 'dast-4', text: 'Are you always able to stop using drugs when you want to?', type: QuestionType.CHOICE, options: [{ value: 'no', label: 'No', score: 1 }, { value: 'yes', label: 'Yes', score: 0 }], required: true },
  { id: 'dast-5', text: 'Do you experience "blackouts" or "flashbacks" as a result of drug use?', type: QuestionType.CHOICE, options: DAST10_OPTIONS, required: true },
  { id: 'dast-6', text: 'Do you ever feel bad about your drug use?', type: QuestionType.CHOICE, options: DAST10_OPTIONS, required: true },
  { id: 'dast-7', text: 'Does your spouse/parents complain about your involvement with drugs?', type: QuestionType.CHOICE, options: DAST10_OPTIONS, required: true },
  { id: 'dast-8', text: 'Has drug abuse created problems between you and your spouse or your parents?', type: QuestionType.CHOICE, options: DAST10_OPTIONS, required: true },
  { id: 'dast-9', text: 'Have you lost friends because of your use of drugs?', type: QuestionType.CHOICE, options: DAST10_OPTIONS, required: true },
  { id: 'dast-10', text: 'Have you been in trouble at work because of drug abuse?', type: QuestionType.CHOICE, options: DAST10_OPTIONS, required: true },
];

// ── PHQ-2 (Patient Health Questionnaire-2) ──────────────────────────
const PHQ2_QUESTIONS: InstrumentQuestion[] = PHQ9_QUESTIONS.slice(0, 2).map((q) => ({
  ...q,
  id: q.id + '-phq2',
}));

// ── GAD-2 (Generalized Anxiety Disorder-2) ──────────────────────────
const GAD2_QUESTIONS: InstrumentQuestion[] = GAD7_QUESTIONS.slice(0, 2).map((q) => ({
  ...q,
  id: q.id + '-gad2',
}));

// ── PRAPARE (Protocol for Responding to & Assessing Patients' Risks) ─
const PRAPARE_QUESTIONS: InstrumentQuestion[] = [
  { id: '93025-5', text: 'Are you Hispanic or Latino?', type: QuestionType.CHOICE, loincCode: '93025-5', options: [
    { value: 'no', label: 'No', score: 0 }, { value: 'yes', label: 'Yes', score: 0 }, { value: 'refused', label: 'Patient Refused', score: 0 },
  ], required: false },
  { id: '93026-3', text: 'What is your race?', type: QuestionType.MULTI_SELECT, loincCode: '93026-3', options: [
    { value: 'asian', label: 'Asian', score: 0 }, { value: 'native', label: 'American Indian/Alaska Native', score: 0 },
    { value: 'pacific', label: 'Native Hawaiian/Other Pacific Islander', score: 0 }, { value: 'black', label: 'Black/African American', score: 0 },
    { value: 'white', label: 'White', score: 0 }, { value: 'other', label: 'Other', score: 0 }, { value: 'refused', label: 'Patient Refused', score: 0 },
  ], required: false },
  { id: '93027-1', text: 'What is your preferred language?', type: QuestionType.CHOICE, loincCode: '93027-1', options: [
    { value: 'english', label: 'English', score: 0 }, { value: 'spanish', label: 'Spanish', score: 0 }, { value: 'other', label: 'Other', score: 0 }, { value: 'refused', label: 'Patient Refused', score: 0 },
  ], required: false },
  { id: '93028-9', text: 'In the past year, have you or any family members you live with been unable to get any food or worried about running out of food?', type: QuestionType.CHOICE, loincCode: '93028-9', options: [
    { value: 'no', label: 'No', score: 0 }, { value: 'yes', label: 'Yes', score: 0 }, { value: 'refused', label: 'Patient Refused', score: 0 },
  ], required: false },
  { id: '93029-7', text: 'What is your current living situation?', type: QuestionType.CHOICE, loincCode: '93029-7', options: [
    { value: 'owned', label: 'I have housing', score: 0 }, { value: 'rented', label: 'I rent', score: 0 },
    { value: 'temporary', label: 'Temporary — I do not have housing (staying with others, in a hotel, in a shelter, living outside)', score: 0 },
    { value: 'refused', label: 'Patient Refused', score: 0 },
  ], required: false },
  { id: '93030-5', text: 'Do you have difficulty meeting basic needs (utilities, transportation, childcare)?', type: QuestionType.CHOICE, loincCode: '93030-5', options: [
    { value: 'no', label: 'No', score: 0 }, { value: 'yes', label: 'Yes', score: 0 }, { value: 'refused', label: 'Patient Refused', score: 0 },
  ], required: false },
  { id: '93031-3', text: 'In the past year, have you been afraid of your partner or ex-partner?', type: QuestionType.CHOICE, loincCode: '93031-3', options: [
    { value: 'no', label: 'No', score: 0 }, { value: 'yes', label: 'Yes', score: 0 }, { value: 'refused', label: 'Patient Refused', score: 0 },
  ], required: false },
];

// ── MDQ (Mood Disorder Questionnaire) ────────────────────────────────
const MDQ_QUESTIONS: InstrumentQuestion[] = [
  {
    id: 'mdq-1',
    text: 'Has there ever been a period of time when you were not your usual self and you felt so good or so hyper that other people thought you were not your normal self or you were so hyper that you got into trouble?',
    type: QuestionType.CHOICE,
    options: [{ value: 'no', label: 'No', score: 0 }, { value: 'yes', label: 'Yes', score: 1 }],
    required: true,
  },
  {
    id: 'mdq-2',
    text: 'Has there ever been a period of time when you were not your usual self and you were so irritable that you shouted at people or started fights or arguments?',
    type: QuestionType.CHOICE,
    options: [{ value: 'no', label: 'No', score: 0 }, { value: 'yes', label: 'Yes', score: 1 }],
    required: true,
  },
  {
    id: 'mdq-3',
    text: 'Has there ever been a period of time when you were not your usual self and you felt much more self-confident than usual?',
    type: QuestionType.CHOICE,
    options: [{ value: 'no', label: 'No', score: 0 }, { value: 'yes', label: 'Yes', score: 1 }],
    required: true,
  },
  {
    id: 'mdq-4',
    text: 'Has there ever been a period of time when you were not your usual self and you needed much less sleep than usual?',
    type: QuestionType.CHOICE,
    options: [{ value: 'no', label: 'No', score: 0 }, { value: 'yes', label: 'Yes', score: 1 }],
    required: true,
  },
  {
    id: 'mdq-5',
    text: 'Has there ever been a period of time when you were not your usual self and you were much more talkative or spoke much faster than usual?',
    type: QuestionType.CHOICE,
    options: [{ value: 'no', label: 'No', score: 0 }, { value: 'yes', label: 'Yes', score: 1 }],
    required: true,
  },
  {
    id: 'mdq-6',
    text: 'Has there ever been a period of time when you were not your usual self and your thoughts raced or you couldn\'t slow your mind down?',
    type: QuestionType.CHOICE,
    options: [{ value: 'no', label: 'No', score: 0 }, { value: 'yes', label: 'Yes', score: 1 }],
    required: true,
  },
  {
    id: 'mdq-7',
    text: 'Has there ever been a period of time when you were not your usual self and you were so easily distracted that things that don\'t usually distract you got your attention?',
    type: QuestionType.CHOICE,
    options: [{ value: 'no', label: 'No', score: 0 }, { value: 'yes', label: 'Yes', score: 1 }],
    required: true,
  },
  {
    id: 'mdq-8',
    text: 'Has there ever been a period of time when you were not your usual self and you had much more energy than usual?',
    type: QuestionType.CHOICE,
    options: [{ value: 'no', label: 'No', score: 0 }, { value: 'yes', label: 'Yes', score: 1 }],
    required: true,
  },
  {
    id: 'mdq-9',
    text: 'Has there ever been a period of time when you were not your usual self and you were much more active or did many more things than usual?',
    type: QuestionType.CHOICE,
    options: [{ value: 'no', label: 'No', score: 0 }, { value: 'yes', label: 'Yes', score: 1 }],
    required: true,
  },
  {
    id: 'mdq-10',
    text: 'Has there ever been a period of time when you were not your usual self and you were much more social or outgoing than usual?',
    type: QuestionType.CHOICE,
    options: [{ value: 'no', label: 'No', score: 0 }, { value: 'yes', label: 'Yes', score: 1 }],
    required: true,
  },
  {
    id: 'mdq-11',
    text: 'Has there ever been a period of time when you were not your usual self and your interest in sex was much greater than usual?',
    type: QuestionType.CHOICE,
    options: [{ value: 'no', label: 'No', score: 0 }, { value: 'yes', label: 'Yes', score: 1 }],
    required: true,
  },
  {
    id: 'mdq-12',
    text: 'Has there ever been a period of time when you were not your usual self and you did things that were unusual for you or other people thought were excessive, foolish, or risky?',
    type: QuestionType.CHOICE,
    options: [{ value: 'no', label: 'No', score: 0 }, { value: 'yes', label: 'Yes', score: 1 }],
    required: true,
  },
  {
    id: 'mdq-13',
    text: 'Has there ever been a period of time when you were not your usual self and you spent money that got you or your family into trouble?',
    type: QuestionType.CHOICE,
    options: [{ value: 'no', label: 'No', score: 0 }, { value: 'yes', label: 'Yes', score: 1 }],
    required: true,
  },
  {
    id: 'mdq-co-occur',
    text: 'If you checked YES to more than one of the above, have several of these ever happened during the same period of time?',
    type: QuestionType.CHOICE,
    options: [{ value: 'no', label: 'No', score: 0 }, { value: 'yes', label: 'Yes', score: 1 }],
    required: true,
  },
  {
    id: 'mdq-problem',
    text: 'How much of a problem did any of these cause you — like being unable to work, family or money problems, or arguments with family or friends?',
    type: QuestionType.CHOICE,
    options: [
      { value: 'none', label: 'No problem', score: 0 },
      { value: 'minor', label: 'Minor problem', score: 1 },
      { value: 'moderate', label: 'Moderate problem', score: 2 },
      { value: 'serious', label: 'Serious problem', score: 3 },
    ],
    required: true,
  },
];

// ── PHQ-A (PHQ-9 Modified for Adolescents) ───────────────────────────
const PHQA_QUESTIONS: InstrumentQuestion[] = PHQ9_QUESTIONS.map((q) => ({
  ...q,
  id: q.id + '-A',
}));

// ── SCARED (Screen for Child Anxiety Related Disorders) ──────────────
const SCARED_OPTIONS = [
  { value: '0', label: 'Not true or hardly ever true', score: 0 },
  { value: '1', label: 'Somewhat true or sometimes true', score: 1 },
  { value: '2', label: 'Very true or often true', score: 2 },
];

const SCARED_QUESTIONS: InstrumentQuestion[] = [
  { id: 'scared-1', text: 'When my child feels frightened, he/she has difficulty breathing', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-2', text: 'My child gets headaches when he/she is at school', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-3', text: 'My child worries about going to school', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-4', text: 'My child worries that something bad will happen to him/her', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-5', text: 'My child is scared to go to school', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-6', text: 'My child worries that others will not like him/her', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-7', text: 'My child is nervous', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-8', text: 'My child has stomach aches', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-9', text: 'My child worries about other people liking him/her', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-10', text: 'When my child gets frightened, he/she feels like passing out', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-11', text: 'My child has trouble catching his/her breath', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-12', text: 'My child feels shaky', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-13', text: 'My child has nightmares about something bad happening to him/her', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-14', text: 'My child worries about things working out for him/her', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-15', text: 'My child is suddenly very nervous', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-16', text: 'My child worries about how well he/she does things', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-17', text: 'My child is scared to sleep alone', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-18', text: 'My child has trouble going to school in the morning because he/she is nervous', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-19', text: 'My child gets shaky when he/she has to do something in front of people', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-20', text: 'My child worries that something bad will happen to his/her parents', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-21', text: 'My child feels shy', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-22', text: 'My child worries about what other people think of him/her', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-23', text: 'My child is afraid of being alone', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-24', text: 'My child has trouble sleeping', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-25', text: 'My child worries that he/she will do something bad', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-26', text: 'My child feels that others are judging him/her', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-27', text: 'My child has stomach aches when away from home', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-28', text: 'My child worries about things that happened in the past', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-29', text: 'My child feels uncomfortable being with people he/she doesn\'t know well', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-30', text: 'My child feels nervous before going to parties', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-31', text: 'My child worries about the future', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-32', text: 'My child feels fearful', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-33', text: 'My child feels afraid of being in crowds', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-34', text: 'My child avoids going places without family', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-35', text: 'My child worries that something bad will happen to him/her', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-36', text: 'My child feels like everything is bad', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-37', text: 'My child gets scared when his/her parents go away', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-38', text: 'My child feels tense or uptight', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-39', text: 'My child worries about other people laughing at him/her', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-40', text: 'My child feels strange when his/her stomach hurts', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
  { id: 'scared-41', text: 'My child worries about what is going to happen', type: QuestionType.CHOICE, options: SCARED_OPTIONS, required: true },
];

// ── PSC-17 (Pediatric Symptom Checklist-17) ──────────────────────────
const PSC17_OPTIONS = [
  { value: '0', label: 'Never', score: 0 },
  { value: '1', label: 'Sometimes', score: 1 },
  { value: '2', label: 'Often', score: 2 },
];

const PSC17_QUESTIONS: InstrumentQuestion[] = [
  { id: 'psc-1', text: 'Complains of aches or pains', type: QuestionType.CHOICE, options: PSC17_OPTIONS, required: true },
  { id: 'psc-2', text: 'Spends more time alone', type: QuestionType.CHOICE, options: PSC17_OPTIONS, required: true },
  { id: 'psc-3', text: 'Tires easily, has little energy', type: QuestionType.CHOICE, options: PSC17_OPTIONS, required: true },
  { id: 'psc-4', text: 'Fidgety, unable to sit still', type: QuestionType.CHOICE, options: PSC17_OPTIONS, required: true },
  { id: 'psc-5', text: 'Has trouble with teacher', type: QuestionType.CHOICE, options: PSC17_OPTIONS, required: true },
  { id: 'psc-6', text: 'Less interested in school', type: QuestionType.CHOICE, options: PSC17_OPTIONS, required: true },
  { id: 'psc-7', text: 'Acts as if driven by a motor', type: QuestionType.CHOICE, options: PSC17_OPTIONS, required: true },
  { id: 'psc-8', text: 'Daydreams too much', type: QuestionType.CHOICE, options: PSC17_OPTIONS, required: true },
  { id: 'psc-9', text: 'Distracted easily', type: QuestionType.CHOICE, options: PSC17_OPTIONS, required: true },
  { id: 'psc-10', text: 'Is afraid of new situations', type: QuestionType.CHOICE, options: PSC17_OPTIONS, required: true },
  { id: 'psc-11', text: 'Feels sad, unhappy', type: QuestionType.CHOICE, options: PSC17_OPTIONS, required: true },
  { id: 'psc-12', text: 'Irritable, angry', type: QuestionType.CHOICE, options: PSC17_OPTIONS, required: true },
  { id: 'psc-13', text: 'Feels hopeless', type: QuestionType.CHOICE, options: PSC17_OPTIONS, required: true },
  { id: 'psc-14', text: 'Has trouble concentrating', type: QuestionType.CHOICE, options: PSC17_OPTIONS, required: true },
  { id: 'psc-15', text: 'Less interested in friends', type: QuestionType.CHOICE, options: PSC17_OPTIONS, required: true },
  { id: 'psc-16', text: 'Fights with other children', type: QuestionType.CHOICE, options: PSC17_OPTIONS, required: true },
  { id: 'psc-17', text: 'Absents self from school', type: QuestionType.CHOICE, options: PSC17_OPTIONS, required: true },
];

// ── EPDS (Edinburgh Postnatal Depression Scale) ─────────────────────
const EPDS_OPTIONS = [
  { value: '0', label: 'Yes, all the time', score: 0 },
  { value: '1', label: 'Yes, most of the time', score: 1 },
  { value: '2', label: 'No, not very often', score: 2 },
  { value: '3', label: 'No, not at all', score: 3 },
];

const EPDS_QUESTIONS: InstrumentQuestion[] = [
  { id: 'epds-1', text: 'I have been able to laugh and see the funny side of things', type: QuestionType.CHOICE, options: EPDS_OPTIONS, required: true },
  { id: 'epds-2', text: 'I have looked forward with enjoyment to things', type: QuestionType.CHOICE, options: EPDS_OPTIONS, required: true },
  { id: 'epds-3', text: 'I have blamed myself unnecessarily when things went wrong', type: QuestionType.CHOICE, options: [{ value: '0', label: 'No, never', score: 0 }, { value: '1', label: 'Not very often', score: 1 }, { value: '2', label: 'Yes, sometimes', score: 2 }, { value: '3', label: 'Yes, most of the time', score: 3 }], required: true },
  { id: 'epds-4', text: 'I have been anxious or worried for no good reason', type: QuestionType.CHOICE, options: [{ value: '0', label: 'No, not at all', score: 0 }, { value: '1', label: 'Hardly ever', score: 1 }, { value: '2', label: 'Yes, sometimes', score: 2 }, { value: '3', label: 'Yes, very often', score: 3 }], required: true },
  { id: 'epds-5', text: 'I have felt scared or panicky for no very good reason', type: QuestionType.CHOICE, options: [{ value: '0', label: 'No, not at all', score: 0 }, { value: '1', label: 'No, not much', score: 1 }, { value: '2', label: 'Yes, sometimes', score: 2 }, { value: '3', label: 'Yes, quite a lot', score: 3 }], required: true },
  { id: 'epds-6', text: 'Things have been getting on top of me', type: QuestionType.CHOICE, options: [{ value: '0', label: 'No, I have been coping', score: 0 }, { value: '1', label: 'No, most of the time I have coped quite well', score: 1 }, { value: '2', label: 'Yes, sometimes I have not been coping as well as usual', score: 2 }, { value: '3', label: 'Yes, most of the time I have not been able to cope at all', score: 3 }], required: true },
  { id: 'epds-7', text: 'I have been so unhappy that I have had difficulty sleeping', type: QuestionType.CHOICE, options: [{ value: '0', label: 'No, not at all', score: 0 }, { value: '1', label: 'Not very often', score: 1 }, { value: '2', label: 'Yes, sometimes', score: 2 }, { value: '3', label: 'Yes, most of the time', score: 3 }], required: true },
  { id: 'epds-8', text: 'I have felt sad or miserable', type: QuestionType.CHOICE, options: [{ value: '0', label: 'No, not at all', score: 0 }, { value: '1', label: 'Not very often', score: 1 }, { value: '2', label: 'Yes, quite often', score: 2 }, { value: '3', label: 'Yes, most of the time', score: 3 }], required: true },
  { id: 'epds-9', text: 'I have been so unhappy that I have been crying', type: QuestionType.CHOICE, options: [{ value: '0', label: 'No, never', score: 0 }, { value: '1', label: 'Only occasionally', score: 1 }, { value: '2', label: 'Yes, quite often', score: 2 }, { value: '3', label: 'Yes, most of the time', score: 3 }], required: true },
  { id: 'epds-10', text: 'The thought of harming myself has occurred to me', type: QuestionType.CHOICE, options: [{ value: '0', label: 'Never', score: 0 }, { value: '1', label: 'Hardly ever', score: 1 }, { value: '2', label: 'Sometimes', score: 2 }, { value: '3', label: 'Yes, quite often', score: 3 }], required: true },
];

// ── ASRS-v1.1 (Adult ADHD Self-Report Scale) ─────────────────────────
const ASRS_OPTIONS = [
  { value: '0', label: 'Never', score: 0 },
  { value: '1', label: 'Rarely', score: 1 },
  { value: '2', label: 'Sometimes', score: 2 },
  { value: '3', label: 'Often', score: 3 },
  { value: '4', label: 'Very Often', score: 4 },
];

const ASRS_QUESTIONS: InstrumentQuestion[] = [
  { id: 'asrs-1', text: 'How often do you have trouble wrapping up the final details of a project, once the challenging parts have been done?', type: QuestionType.CHOICE, options: ASRS_OPTIONS, required: true },
  { id: 'asrs-2', text: 'How often do you have difficulty getting things in order when you have to do a task that requires organization?', type: QuestionType.CHOICE, options: ASRS_OPTIONS, required: true },
  { id: 'asrs-3', text: 'How often do you have problems remembering appointments or obligations?', type: QuestionType.CHOICE, options: ASRS_OPTIONS, required: true },
  { id: 'asrs-4', text: 'When you have a task that requires a lot of thought, how often do you avoid or delay getting started?', type: QuestionType.CHOICE, options: ASRS_OPTIONS, required: true },
  { id: 'asrs-5', text: 'How often do you fidget or squirm with your hands or feet when you have to sit down for a long time?', type: QuestionType.CHOICE, options: ASRS_OPTIONS, required: true },
  { id: 'asrs-6', text: 'How often do you feel overly active and compelled to do things, like you were driven by a motor?', type: QuestionType.CHOICE, options: ASRS_OPTIONS, required: true },
];

// ── DAS-21 (Depression Anxiety Stress Scale-21) ─────────────────────
const DAS21_OPTIONS = [
  { value: '0', label: 'Did not apply to me at all', score: 0 },
  { value: '1', label: 'Applied to me to some degree, or some of the time', score: 1 },
  { value: '2', label: 'Applied to me to a considerable degree, or a good part of the time', score: 2 },
  { value: '3', label: 'Applied to me very much, or most of the time', score: 3 },
];

const DAS21_QUESTIONS: InstrumentQuestion[] = [
  { id: 'das-1', text: 'I found it hard to wind down', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-2', text: 'I was aware of dryness of my mouth', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-3', text: 'I couldn\'t seem to experience any positive feeling at all', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-4', text: 'I experienced breathing difficulty', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-5', text: 'I found it difficult to work up the initiative to do things', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-6', text: 'I tended to over-react to situations', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-7', text: 'I experienced trembling (e.g., in the hands)', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-8', text: 'I felt that I was using a lot of nervous energy', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-9', text: 'I was worried about situations in which I might panic and make a fool of myself', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-10', text: 'I felt that I had nothing to look forward to', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-11', text: 'I found myself getting agitated', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-12', text: 'I found it difficult to relax', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-13', text: 'I felt down-hearted and blue', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-14', text: 'I was intolerant of anything that kept me from getting on with what I was doing', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-15', text: 'I felt I was close to panic', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-16', text: 'I was unable to become enthusiastic about anything', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-17', text: 'I felt I wasn\'t worth much as a person', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-18', text: 'I felt that I was rather touchy', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-19', text: 'I was aware of the action of my heart in the absence of physical exertion', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-20', text: 'I felt scared without any good reason', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
  { id: 'das-21', text: 'I felt that life was meaningless', type: QuestionType.CHOICE, options: DAS21_OPTIONS, required: true },
];

// ── TAPS-2 (Tobacco, Alcohol, Prescription meds, Substance use) ──────
const TAPS_OPTIONS = [
  { value: '0', label: 'Never', score: 0 },
  { value: '1', label: 'Monthly or less', score: 1 },
  { value: '2', label: 'Weekly', score: 2 },
  { value: '3', label: 'Daily or almost daily', score: 3 },
];

const TAPS_QUESTIONS: InstrumentQuestion[] = [
  { id: 'taps-tobacco', text: 'How often do you use tobacco products (cigarettes, chewing tobacco, cigars, etc.)?', type: QuestionType.CHOICE, options: TAPS_OPTIONS, required: true },
  { id: 'taps-alcohol', text: 'How often do you have 5 or more drinks (men) / 4 or more drinks (women) in a day?', type: QuestionType.CHOICE, options: TAPS_OPTIONS, required: true },
  { id: 'taps-prescription', text: 'How often do you use prescription medications (pain killers, stimulants, sedatives) in a way other than prescribed?', type: QuestionType.CHOICE, options: TAPS_OPTIONS, required: true },
  { id: 'taps-illicit', text: 'How often do you use illicit or recreational drugs (marijuana, cocaine, heroin, methamphetamine, etc.)?', type: QuestionType.CHOICE, options: TAPS_OPTIONS, required: true },
];

// ── ISI (Insomnia Severity Index) ────────────────────────────────────
const ISI_QUESTIONS: InstrumentQuestion[] = [
  { id: 'isi-1', text: 'Difficulty falling asleep', type: QuestionType.CHOICE, options: [{ value: '0', label: 'None', score: 0 }, { value: '1', label: 'Mild', score: 1 }, { value: '2', label: 'Moderate', score: 2 }, { value: '3', label: 'Severe', score: 3 }, { value: '4', label: 'Very severe', score: 4 }], required: true },
  { id: 'isi-2', text: 'Difficulty staying asleep', type: QuestionType.CHOICE, options: [{ value: '0', label: 'None', score: 0 }, { value: '1', label: 'Mild', score: 1 }, { value: '2', label: 'Moderate', score: 2 }, { value: '3', label: 'Severe', score: 3 }, { value: '4', label: 'Very severe', score: 4 }], required: true },
  { id: 'isi-3', text: 'Problem waking too early', type: QuestionType.CHOICE, options: [{ value: '0', label: 'None', score: 0 }, { value: '1', label: 'Mild', score: 1 }, { value: '2', label: 'Moderate', score: 2 }, { value: '3', label: 'Severe', score: 3 }, { value: '4', label: 'Very severe', score: 4 }], required: true },
  { id: 'isi-4', text: 'How satisfied/dissatisfied are you with your current sleep pattern?', type: QuestionType.CHOICE, options: [{ value: '0', label: 'Very satisfied', score: 0 }, { value: '1', label: 'Satisfied', score: 1 }, { value: '2', label: 'Moderately satisfied', score: 2 }, { value: '3', label: 'Dissatisfied', score: 3 }, { value: '4', label: 'Very dissatisfied', score: 4 }], required: true },
  { id: 'isi-5', text: 'How noticeable to others do you think your sleep problem is in terms of impairing the quality of your life?', type: QuestionType.CHOICE, options: [{ value: '0', label: 'Not at all', score: 0 }, { value: '1', label: 'A little', score: 1 }, { value: '2', label: 'Somewhat', score: 2 }, { value: '3', label: 'Much', score: 3 }, { value: '4', label: 'Very much', score: 4 }], required: true },
  { id: 'isi-6', text: 'How worried/distressed are you about your sleep problem?', type: QuestionType.CHOICE, options: [{ value: '0', label: 'Not at all', score: 0 }, { value: '1', label: 'A little', score: 1 }, { value: '2', label: 'Somewhat', score: 2 }, { value: '3', label: 'Much', score: 3 }, { value: '4', label: 'Very much', score: 4 }], required: true },
  { id: 'isi-7', text: 'To what extent do you consider your sleep problem to interfere with your daily functioning?', type: QuestionType.CHOICE, options: [{ value: '0', label: 'Not at all', score: 0 }, { value: '1', label: 'A little', score: 1 }, { value: '2', label: 'Somewhat', score: 2 }, { value: '3', label: 'Much', score: 3 }, { value: '4', label: 'Very much', score: 4 }], required: true },
];

// ── PEG (Pain, Enjoyment, General Activity) ──────────────────────────
const PEG_QUESTIONS: InstrumentQuestion[] = [
  { id: 'peg-1', text: 'What was your average pain level in the past week? (0 = no pain, 10 = worst imaginable)', type: QuestionType.NUMBER, required: true },
  { id: 'peg-2', text: 'What number best describes how much pain interfered with your enjoyment of life in the past week? (0 = not at all, 10 = completely)', type: QuestionType.NUMBER, required: true },
  { id: 'peg-3', text: 'What number best describes how much pain interfered with your general activity in the past week? (0 = not at all, 10 = completely)', type: QuestionType.NUMBER, required: true },
];

// ── Instrument Registry ──────────────────────────────────────────────
export const PREDEFINED_INSTRUMENTS: PredefinedInstrument[] = [
  // Tier 1
  {
    code: 'PHQ-9',
    title: 'Patient Health Questionnaire-9 (PHQ-9)',
    description: 'Standardized depression screening tool. The most widely used depression screening instrument in primary care. Required for MIPS CMS2 depression screening measure.',
    category: InstrumentCategory.DEPRESSION,
    loincCode: '44249-1',
    version: '1.0',
    estimatedMinutes: 3,
    questions: PHQ9_QUESTIONS,
    scoringRules: {
      type: 'sum',
      ranges: [
        { min: 0, max: 4, label: 'Minimal depression', severity: 'minimal', color: '#52c41a', recommendation: 'No treatment needed unless persistent' },
        { min: 5, max: 9, label: 'Mild depression', severity: 'mild', color: '#faad14', recommendation: 'Consider counseling, consider antidepressants if persistent' },
        { min: 10, max: 14, label: 'Moderate depression', severity: 'moderate', color: '#fa8c16', recommendation: 'Treatment recommended (antidepressants and/or psychotherapy)' },
        { min: 15, max: 19, label: 'Moderately severe depression', severity: 'moderately_severe', color: '#fa541c', recommendation: 'Active treatment with antidepressants and/or psychotherapy recommended' },
        { min: 20, max: 27, label: 'Severe depression', severity: 'severe', color: '#ff4d4f', recommendation: 'Immediate treatment recommended, consider referral to psychiatry' },
      ],
    },
    administrationRules: {
      mode: 'either',
      frequency: 'annual',
      minAge: 12,
      alertThresholds: [
        { condition: 'score >= 20', severity: 'critical', message: 'Severe depression — immediate intervention recommended' },
        { condition: 'question_9 == "yes" or question_9 >= 1', severity: 'critical', message: 'Suicidal ideation endorsed (Q9) — assess suicide risk immediately' },
        { condition: 'score >= 10', severity: 'warning', message: 'Moderate or greater depression — treatment recommended' },
      ],
    },
  },
  {
    code: 'GAD-7',
    title: 'Generalized Anxiety Disorder-7 (GAD-7)',
    description: 'Standardized anxiety screening tool. The most widely used anxiety screening instrument in primary care. USPSTF recommends anxiety screening for adults 19-64.',
    category: InstrumentCategory.ANXIETY,
    loincCode: '70274-6',
    version: '1.0',
    estimatedMinutes: 2,
    questions: GAD7_QUESTIONS,
    scoringRules: {
      type: 'sum',
      ranges: [
        { min: 0, max: 4, label: 'Minimal anxiety', severity: 'minimal', color: '#52c41a', recommendation: 'No treatment needed' },
        { min: 5, max: 9, label: 'Mild anxiety', severity: 'mild', color: '#faad14', recommendation: 'Monitor and consider counseling' },
        { min: 10, max: 14, label: 'Moderate anxiety', severity: 'moderate', color: '#fa8c16', recommendation: 'Treatment recommended (therapy and/or medication)' },
        { min: 15, max: 21, label: 'Severe anxiety', severity: 'severe', color: '#ff4d4f', recommendation: 'Active treatment recommended, consider psychiatry referral' },
      ],
    },
    administrationRules: {
      mode: 'either',
      frequency: 'annual',
      minAge: 13,
      alertThresholds: [
        { condition: 'score >= 15', severity: 'critical', message: 'Severe anxiety — immediate treatment recommended' },
        { condition: 'score >= 10', severity: 'warning', message: 'Moderate anxiety — treatment recommended' },
      ],
    },
  },
  {
    code: 'AUDIT-C',
    title: 'Alcohol Use Disorders Identification Test-Consumption (AUDIT-C)',
    description: '3-item alcohol screening tool. USPSTF recommends screening for unhealthy alcohol use in adults 18+. Score ≥4 for men or ≥3 for women indicates hazardous drinking.',
    category: InstrumentCategory.SUBSTANCE_USE,
    loincCode: '72109-2',
    version: '1.0',
    estimatedMinutes: 1,
    questions: AUDITC_QUESTIONS,
    scoringRules: {
      type: 'sum',
      ranges: [
        { min: 0, max: 3, label: 'Low risk (men)', severity: 'minimal', color: '#52c41a', recommendation: 'No intervention needed' },
        { min: 0, max: 2, label: 'Low risk (women)', severity: 'minimal', color: '#52c41a', recommendation: 'No intervention needed' },
        { min: 4, max: 12, label: 'Positive screen — hazardous drinking', severity: 'moderate', color: '#fa8c16', recommendation: 'Brief intervention recommended. Consider full AUDIT for further assessment.' },
      ],
    },
    administrationRules: {
      mode: 'either',
      frequency: 'annual',
      minAge: 18,
      alertThresholds: [
        { condition: 'score >= 4', severity: 'warning', message: 'Positive alcohol screen — brief intervention recommended' },
        { condition: 'score >= 7', severity: 'critical', message: 'High AUDIT-C score — consider full AUDIT and referral' },
      ],
    },
  },
  {
    code: 'C-SSRS',
    title: 'Columbia-Suicide Severity Rating Scale (C-SSRS) Screener',
    description: 'Standardized suicide risk screening tool. Clinically critical for patient safety. Should be administered when suicidality is suspected or as part of behavioral health screening.',
    category: InstrumentCategory.SUICIDE_RISK,
    loincCode: '89702-8',
    version: '1.0',
    estimatedMinutes: 2,
    questions: CSSRS_QUESTIONS,
    scoringRules: {
      type: 'categorical',
      categories: [
        { label: 'No suicidal ideation or behavior', condition: 'All questions answered "No"', severity: 'low', recommendation: 'No immediate action needed' },
        { label: 'Passive suicidal ideation', condition: 'Q1 = Yes, Q2 = No', severity: 'moderate', recommendation: 'Assess further, consider safety planning and outpatient follow-up' },
        { label: 'Active suicidal ideation without intent', condition: 'Q2 = Yes, Q4 = No', severity: 'moderate', recommendation: 'Conduct full risk assessment, safety planning, consider outpatient psychiatry' },
        { label: 'Active suicidal ideation with intent or plan', condition: 'Q4 = Yes or Q5 = Yes', severity: 'high', recommendation: 'IMMEDIATE ACTION: Do not leave patient alone, conduct emergency psychiatric evaluation, consider hospitalization' },
        { label: 'Suicidal behavior', condition: 'Q6 = Yes', severity: 'high', recommendation: 'IMMEDIATE ACTION: Emergency psychiatric evaluation required, consider hospitalization' },
      ],
    },
    administrationRules: {
      mode: 'either',
      frequency: 'on_trigger',
      triggers: ['depression_screening_positive', 'patient_report_suicidal_ideation', 'behavioral_health_visit'],
      alertThresholds: [
        { condition: 'q4 == "yes" or q5 == "yes"', severity: 'critical', message: 'CRITICAL: Patient endorses suicidal intent or plan — immediate safety measures required' },
        { condition: 'q6 == "yes"', severity: 'critical', message: 'CRITICAL: Patient reports suicidal behavior — emergency psychiatric evaluation required' },
        { condition: 'q1 == "yes" or q2 == "yes"', severity: 'warning', message: 'Patient endorses passive or active suicidal ideation — further assessment needed' },
      ],
    },
  },
  // Tier 2
  {
    code: 'DAST-10',
    title: 'Drug Abuse Screening Test-10 (DAST-10)',
    description: '10-item drug use screening tool. 75% usage rate in primary care behavioral health. Pairs with AUDIT-C for complete substance use screening.',
    category: InstrumentCategory.SUBSTANCE_USE,
    loincCode: '82109-3',
    version: '1.0',
    estimatedMinutes: 3,
    questions: DAST10_QUESTIONS,
    scoringRules: {
      type: 'sum',
      ranges: [
        { min: 0, max: 0, label: 'No problems reported', severity: 'minimal', color: '#52c41a', recommendation: 'No intervention needed' },
        { min: 1, max: 2, label: 'Low level of problems', severity: 'mild', color: '#faad14', recommendation: 'Monitor, brief education' },
        { min: 3, max: 5, label: 'Moderate level of problems', severity: 'moderate', color: '#fa8c16', recommendation: 'Further assessment recommended, consider counseling' },
        { min: 6, max: 10, label: 'Substantial level of problems', severity: 'severe', color: '#ff4d4f', recommendation: 'Treatment referral recommended' },
      ],
    },
    administrationRules: {
      mode: 'either',
      frequency: 'annual',
      minAge: 18,
      alertThresholds: [
        { condition: 'score >= 6', severity: 'critical', message: 'Substantial substance use problems — treatment referral recommended' },
        { condition: 'score >= 3', severity: 'warning', message: 'Moderate substance use problems — further assessment recommended' },
      ],
    },
  },
  {
    code: 'PHQ-2',
    title: 'Patient Health Questionnaire-2 (PHQ-2)',
    description: 'Ultra-short 2-item depression pre-screener. A positive result (score ≥3) should be followed by the full PHQ-9.',
    category: InstrumentCategory.DEPRESSION,
    loincCode: '55758-7',
    version: '1.0',
    estimatedMinutes: 1,
    questions: PHQ2_QUESTIONS,
    scoringRules: {
      type: 'sum',
      ranges: [
        { min: 0, max: 2, label: 'Negative screen', severity: 'minimal', color: '#52c41a', recommendation: 'No further action needed' },
        { min: 3, max: 6, label: 'Positive screen', severity: 'moderate', color: '#fa8c16', recommendation: 'Administer full PHQ-9 for further assessment' },
      ],
    },
    administrationRules: {
      mode: 'either',
      frequency: 'per_visit',
      minAge: 12,
      alertThresholds: [
        { condition: 'score >= 3', severity: 'warning', message: 'Positive depression screen — administer full PHQ-9' },
      ],
    },
  },
  {
    code: 'GAD-2',
    title: 'Generalized Anxiety Disorder-2 (GAD-2)',
    description: 'Ultra-short 2-item anxiety pre-screener. A positive result (score ≥3) should be followed by the full GAD-7.',
    category: InstrumentCategory.ANXIETY,
    loincCode: '70274-6',
    version: '1.0',
    estimatedMinutes: 1,
    questions: GAD2_QUESTIONS,
    scoringRules: {
      type: 'sum',
      ranges: [
        { min: 0, max: 2, label: 'Negative screen', severity: 'minimal', color: '#52c41a', recommendation: 'No further action needed' },
        { min: 3, max: 6, label: 'Positive screen', severity: 'moderate', color: '#fa8c16', recommendation: 'Administer full GAD-7 for further assessment' },
      ],
    },
    administrationRules: {
      mode: 'either',
      frequency: 'per_visit',
      minAge: 13,
      alertThresholds: [
        { condition: 'score >= 3', severity: 'warning', message: 'Positive anxiety screen — administer full GAD-7' },
      ],
    },
  },
  {
    code: 'PRAPARE',
    title: 'Protocol for Responding to and Assessing Patients\' Risks and Experiences (PRAPARE)',
    description: 'Social Determinants of Health (SDOH) screening tool. Required for MIPS measure 487. Screens for food insecurity, housing instability, transportation, utilities, and interpersonal safety.',
    category: InstrumentCategory.SDOH,
    loincCode: '93023-0',
    version: '1.0',
    estimatedMinutes: 5,
    questions: PRAPARE_QUESTIONS,
    scoringRules: {
      type: 'categorical',
      categories: [
        { label: 'No SDOH needs identified', condition: 'All core questions answered "No"', severity: 'low', recommendation: 'No intervention needed' },
        { label: 'SDOH needs identified', condition: 'Any core question answered "Yes"', severity: 'moderate', recommendation: 'Refer to social work, community resources, or care coordination' },
        { label: 'Critical SDOH need', condition: 'Housing instability or interpersonal safety = "Yes"', severity: 'high', recommendation: 'Immediate referral to social work and community resources' },
      ],
    },
    administrationRules: {
      mode: 'either',
      frequency: 'annual',
      minAge: 18,
      alertThresholds: [
        { condition: 'housing == "temporary"', severity: 'critical', message: 'Housing instability identified — immediate social work referral' },
        { condition: 'safety == "yes"', severity: 'critical', message: 'Interpersonal safety concern — assess for intimate partner violence, provide resources' },
        { condition: 'food == "yes"', severity: 'warning', message: 'Food insecurity identified — refer to food assistance programs' },
      ],
    },
  },
  {
    code: 'MDQ',
    title: 'Mood Disorder Questionnaire (MDQ)',
    description: '15-item bipolar disorder screening tool. 46% usage in primary care behavioral health. Important differential diagnosis when screening for depression.',
    category: InstrumentCategory.BIPOLAR,
    loincCode: '82015-9',
    version: '1.0',
    estimatedMinutes: 5,
    questions: MDQ_QUESTIONS,
    scoringRules: {
      type: 'custom',
      // MDQ is positive if: 7+ of Q1-Q13 = Yes AND co-occurrence = Yes AND problem = Moderate or Serious
      ranges: [
        { min: 0, max: 0, label: 'Negative screen', severity: 'minimal', color: '#52c41a', recommendation: 'No bipolar disorder indication' },
        { min: 1, max: 1, label: 'Positive screen', severity: 'moderate', color: '#fa8c16', recommendation: 'Positive bipolar screen — refer for psychiatric evaluation for definitive diagnosis' },
      ],
    },
    administrationRules: {
      mode: 'either',
      frequency: 'on_trigger',
      triggers: ['depression_screening_positive', 'treatment_resistant_depression'],
      minAge: 18,
      alertThresholds: [
        { condition: 'positive_screen', severity: 'warning', message: 'Positive bipolar screen — psychiatric referral recommended' },
      ],
    },
  },
  // Tier 3 - Pediatric
  {
    code: 'PHQ-A',
    title: 'Patient Health Questionnaire for Adolescents (PHQ-A)',
    description: 'PHQ-9 modified for adolescents (ages 11-17). Used for depression screening in pediatric and adolescent populations.',
    category: InstrumentCategory.PEDIATRIC,
    loincCode: '89204-2',
    version: '1.0',
    estimatedMinutes: 3,
    questions: PHQA_QUESTIONS,
    scoringRules: {
      type: 'sum',
      ranges: [
        { min: 0, max: 4, label: 'Minimal depression', severity: 'minimal', color: '#52c41a', recommendation: 'No treatment needed unless persistent' },
        { min: 5, max: 9, label: 'Mild depression', severity: 'mild', color: '#faad14', recommendation: 'Consider counseling, involve parents/guardians' },
        { min: 10, max: 14, label: 'Moderate depression', severity: 'moderate', color: '#fa8c16', recommendation: 'Treatment recommended, consider therapy and/or medication' },
        { min: 15, max: 19, label: 'Moderately severe depression', severity: 'moderately_severe', color: '#fa541c', recommendation: 'Active treatment recommended, consider psychiatry referral' },
        { min: 20, max: 27, label: 'Severe depression', severity: 'severe', color: '#ff4d4f', recommendation: 'Immediate treatment, psychiatry referral recommended' },
      ],
    },
    administrationRules: {
      mode: 'either',
      frequency: 'annual',
      minAge: 11,
      maxAge: 17,
      alertThresholds: [
        { condition: 'score >= 20', severity: 'critical', message: 'Severe depression in adolescent — immediate intervention, involve parents/guardians' },
        { condition: 'question_9 >= 1', severity: 'critical', message: 'Suicidal ideation endorsed — assess suicide risk immediately, involve parents/guardians' },
        { condition: 'score >= 10', severity: 'warning', message: 'Moderate or greater depression — treatment recommended' },
      ],
    },
  },
  {
    code: 'SCARED',
    title: 'Screen for Child Anxiety Related Disorders (SCARED)',
    description: '41-item pediatric anxiety screening tool for children ages 8-18. Screens for generalized anxiety, separation anxiety, social anxiety, school phobia, and panic.',
    category: InstrumentCategory.PEDIATRIC,
    loincCode: '62727-9',
    version: '1.0',
    estimatedMinutes: 8,
    questions: SCARED_QUESTIONS,
    scoringRules: {
      type: 'sum',
      ranges: [
        { min: 0, max: 24, label: 'Negative screen', severity: 'minimal', color: '#52c41a', recommendation: 'No anxiety disorder indicated' },
        { min: 25, max: 82, label: 'Positive screen', severity: 'moderate', color: '#fa8c16', recommendation: 'Positive anxiety screen — further evaluation recommended, consider therapy referral' },
      ],
    },
    administrationRules: {
      mode: 'either',
      frequency: 'annual',
      minAge: 8,
      maxAge: 18,
      alertThresholds: [
        { condition: 'score >= 25', severity: 'warning', message: 'Positive pediatric anxiety screen — further evaluation recommended' },
      ],
    },
  },
  {
    code: 'PSC-17',
    title: 'Pediatric Symptom Checklist-17 (PSC-17)',
    description: '17-item psychosocial screening tool for children ages 4-16. Screens for emotional and behavioral problems. Score ≥15 indicates psychosocial dysfunction.',
    category: InstrumentCategory.PEDIATRIC,
    loincCode: '',
    version: '1.0',
    estimatedMinutes: 3,
    questions: PSC17_QUESTIONS,
    scoringRules: {
      type: 'sum',
      ranges: [
        { min: 0, max: 14, label: 'Negative screen', severity: 'minimal', color: '#52c41a', recommendation: 'No psychosocial dysfunction indicated' },
        { min: 15, max: 34, label: 'Positive screen', severity: 'moderate', color: '#fa8c16', recommendation: 'Positive psychosocial screen — further evaluation recommended' },
      ],
    },
    administrationRules: {
      mode: 'either',
      frequency: 'annual',
      minAge: 4,
      maxAge: 16,
      alertThresholds: [
        { condition: 'score >= 15', severity: 'warning', message: 'Positive psychosocial screen — further evaluation recommended' },
      ],
    },
  },
  // Tier 4 - Specialty
  {
    code: 'EPDS',
    title: 'Edinburgh Postnatal Depression Scale (EPDS)',
    description: '10-item postpartum depression screening tool. Recommended by ACOG for all postpartum patients. Score ≥13 indicates probable depression.',
    category: InstrumentCategory.PERINATAL,
    loincCode: '89204-2',
    version: '1.0',
    estimatedMinutes: 3,
    questions: EPDS_QUESTIONS,
    scoringRules: {
      type: 'sum',
      ranges: [
        { min: 0, max: 9, label: 'Negative screen', severity: 'minimal', color: '#52c41a', recommendation: 'No postpartum depression indicated' },
        { min: 10, max: 12, label: 'Borderline — monitor closely', severity: 'mild', color: '#faad14', recommendation: 'Monitor closely, repeat screening, consider support' },
        { min: 13, max: 30, label: 'Positive screen — probable depression', severity: 'moderate', color: '#fa8c16', recommendation: 'Treatment recommended, consider therapy and/or antidepressants compatible with breastfeeding' },
      ],
    },
    administrationRules: {
      mode: 'either',
      frequency: 'on_trigger',
      triggers: ['postpartum_visit', 'prenatal_visit'],
      sex: 'F',
      minAge: 15,
      alertThresholds: [
        { condition: 'question_10 >= 1', severity: 'critical', message: 'Self-harm ideation endorsed (Q10) — assess suicide risk immediately' },
        { condition: 'score >= 13', severity: 'warning', message: 'Positive postpartum depression screen — treatment recommended' },
      ],
    },
  },
  {
    code: 'ASRS-v1.1',
    title: 'Adult ADHD Self-Report Scale (ASRS-v1.1)',
    description: '6-item adult ADHD screening tool. Screens for ADHD symptoms in adults. 4+ positive responses indicate likely ADHD.',
    category: InstrumentCategory.ADHD,
    loincCode: '89204-2',
    version: '1.1',
    estimatedMinutes: 2,
    questions: ASRS_QUESTIONS,
    scoringRules: {
      type: 'sum',
      ranges: [
        { min: 0, max: 13, label: 'Negative screen', severity: 'minimal', color: '#52c41a', recommendation: 'No ADHD indication' },
        { min: 14, max: 24, label: 'Positive screen — likely ADHD', severity: 'moderate', color: '#fa8c16', recommendation: 'Positive ADHD screen — consider referral for diagnostic evaluation' },
      ],
    },
    administrationRules: {
      mode: 'either',
      frequency: 'on_trigger',
      triggers: ['attention_concerns', 'work_performance_issues'],
      minAge: 18,
      alertThresholds: [
        { condition: 'score >= 14', severity: 'warning', message: 'Positive ADHD screen — diagnostic evaluation recommended' },
      ],
    },
  },
  {
    code: 'DAS-21',
    title: 'Depression Anxiety Stress Scale-21 (DAS-21)',
    description: '21-item scale measuring depression, anxiety, and stress. Provides subscale scores for each domain. Alternative to PHQ-9 + GAD-7 when a combined measure is preferred.',
    category: InstrumentCategory.DEPRESSION,
    loincCode: '',
    version: '1.0',
    estimatedMinutes: 5,
    questions: DAS21_QUESTIONS,
    scoringRules: {
      type: 'sum',
      ranges: [
        { min: 0, max: 20, label: 'Normal', severity: 'minimal', color: '#52c41a', recommendation: 'No significant distress' },
        { min: 21, max: 34, label: 'Mild distress', severity: 'mild', color: '#faad14', recommendation: 'Monitor, consider counseling' },
        { min: 35, max: 48, label: 'Moderate distress', severity: 'moderate', color: '#fa8c16', recommendation: 'Treatment recommended' },
        { min: 49, max: 63, label: 'Severe distress', severity: 'severe', color: '#ff4d4f', recommendation: 'Active treatment recommended, consider psychiatry referral' },
      ],
    },
    administrationRules: {
      mode: 'either',
      frequency: 'annual',
      minAge: 18,
      alertThresholds: [
        { condition: 'score >= 49', severity: 'critical', message: 'Severe distress — immediate treatment recommended' },
        { condition: 'score >= 35', severity: 'warning', message: 'Moderate distress — treatment recommended' },
      ],
    },
  },
  {
    code: 'TAPS-2',
    title: 'Tobacco, Alcohol, Prescription medication, and Substance use (TAPS-2)',
    description: '4-item substance use screening tool covering tobacco, alcohol, prescription drug misuse, and illicit drug use. Any score ≥1 indicates potential problem use.',
    category: InstrumentCategory.SUBSTANCE_USE,
    loincCode: '',
    version: '2.0',
    estimatedMinutes: 2,
    questions: TAPS_QUESTIONS,
    scoringRules: {
      type: 'sum',
      ranges: [
        { min: 0, max: 0, label: 'No problem use', severity: 'minimal', color: '#52c41a', recommendation: 'No intervention needed' },
        { min: 1, max: 3, label: 'Problem use indicated', severity: 'moderate', color: '#fa8c16', recommendation: 'Brief intervention recommended, consider full assessment' },
        { min: 4, max: 12, label: 'High-risk use', severity: 'severe', color: '#ff4d4f', recommendation: 'Treatment referral recommended' },
      ],
    },
    administrationRules: {
      mode: 'either',
      frequency: 'annual',
      minAge: 18,
      alertThresholds: [
        { condition: 'score >= 4', severity: 'critical', message: 'High-risk substance use — treatment referral recommended' },
        { condition: 'score >= 1', severity: 'warning', message: 'Problem substance use indicated — brief intervention' },
      ],
    },
  },
  {
    code: 'ISI',
    title: 'Insomnia Severity Index (ISI)',
    description: '7-item insomnia screening tool. Assesses difficulty falling asleep, staying asleep, early waking, satisfaction with sleep, and daytime impact. Score ≥15 indicates moderate to severe insomnia.',
    category: InstrumentCategory.SLEEP,
    loincCode: '',
    version: '1.0',
    estimatedMinutes: 3,
    questions: ISI_QUESTIONS,
    scoringRules: {
      type: 'sum',
      ranges: [
        { min: 0, max: 7, label: 'No insomnia', severity: 'minimal', color: '#52c41a', recommendation: 'No intervention needed' },
        { min: 8, max: 14, label: 'Subthreshold insomnia', severity: 'mild', color: '#faad14', recommendation: 'Sleep hygiene education, monitor' },
        { min: 15, max: 21, label: 'Moderate insomnia', severity: 'moderate', color: '#fa8c16', recommendation: 'Treatment recommended (CBT-I, consider medication)' },
        { min: 22, max: 28, label: 'Severe insomnia', severity: 'severe', color: '#ff4d4f', recommendation: 'Active treatment recommended, consider sleep medicine referral' },
      ],
    },
    administrationRules: {
      mode: 'either',
      frequency: 'on_trigger',
      triggers: ['sleep_complaint', 'insomnia_diagnosis'],
      minAge: 18,
      alertThresholds: [
        { condition: 'score >= 22', severity: 'warning', message: 'Severe insomnia — sleep medicine referral recommended' },
        { condition: 'score >= 15', severity: 'warning', message: 'Moderate insomnia — treatment recommended' },
      ],
    },
  },
  {
    code: 'PEG',
    title: 'PEG (Pain, Enjoyment, General Activity)',
    description: '3-item chronic pain assessment tool. Assesses average pain, interference with enjoyment of life, and interference with general activity. Each item scored 0-10.',
    category: InstrumentCategory.PAIN,
    loincCode: '',
    version: '1.0',
    estimatedMinutes: 1,
    questions: PEG_QUESTIONS,
    scoringRules: {
      type: 'sum',
      ranges: [
        { min: 0, max: 3, label: 'Low pain impact', severity: 'minimal', color: '#52c41a', recommendation: 'Continue current management' },
        { min: 4, max: 6, label: 'Moderate pain impact', severity: 'moderate', color: '#fa8c16', recommendation: 'Consider pain management adjustment' },
        { min: 7, max: 10, label: 'High pain impact', severity: 'severe', color: '#ff4d4f', recommendation: 'Pain management referral recommended' },
      ],
    },
    administrationRules: {
      mode: 'either',
      frequency: 'per_visit',
      triggers: ['chronic_pain_diagnosis', 'pain_complaint'],
      minAge: 18,
      alertThresholds: [
        { condition: 'score >= 7', severity: 'warning', message: 'High pain impact — pain management referral recommended' },
      ],
    },
  },
];
