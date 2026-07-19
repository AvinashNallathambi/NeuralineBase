import { BadRequestException } from '@nestjs/common';
import { DocumentationService } from './documentation.service';
import {
  DocumentationConsentStatus,
  DocumentationSessionStatus,
} from './entities/documentation-session.entity';

const actor = { id: 'provider-1', email: 'provider@example.test', role: 'doctor' };

function buildService(session: Record<string, any>) {
  const sessionRepository = {
    findOne: jest.fn().mockResolvedValue(session),
    save: jest.fn().mockImplementation(async (value) => value),
    create: jest.fn().mockImplementation((value) => value),
  };
  const versionRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((value) => value),
    save: jest.fn().mockResolvedValue(undefined),
    find: jest.fn().mockResolvedValue([]),
  };
  const transcriptionService = {
    transcribeAudioBuffer: jest.fn(),
  };
  const aiService = {
    generateStructured: jest.fn().mockResolvedValue({
      subjective: 'Reports cough.',
      objective: '',
      assessment: 'Cough.',
      plan: 'Supportive care.',
    }),
  };
  const encounterService = {
    findOne: jest.fn().mockResolvedValue({ id: 'encounter-1', patientId: 'patient-1', status: 'in_progress' }),
    create: jest.fn(),
    update: jest.fn(),
    transitionStatus: jest.fn(),
    sign: jest.fn(),
  };
  const hipaaAuditService = { log: jest.fn().mockResolvedValue(undefined) };

  return {
    service: new DocumentationService(
      sessionRepository as any,
      versionRepository as any,
      transcriptionService as any,
      aiService as any,
      encounterService as any,
      hipaaAuditService as any,
    ),
    sessionRepository,
    versionRepository,
    transcriptionService,
    aiService,
  };
}

describe('DocumentationService', () => {
  it('rejects audio transcription until consent is documented', async () => {
    const { service, transcriptionService } = buildService({
      id: 'session-1',
      tenantId: 'tenant-1',
      status: DocumentationSessionStatus.DRAFT,
      consentStatus: DocumentationConsentStatus.PENDING,
    });

    await expect(
      service.transcribeAudio('tenant-1', actor, 'session-1', { buffer: Buffer.from('audio'), mimetype: 'audio/webm' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transcriptionService.transcribeAudioBuffer).not.toHaveBeenCalled();
  });

  it('stores a versioned AI draft without retaining source audio', async () => {
    const session = {
      id: 'session-1',
      tenantId: 'tenant-1',
      status: DocumentationSessionStatus.TRANSCRIBED,
      consentStatus: DocumentationConsentStatus.GRANTED,
      transcript: 'The patient reports a cough.',
      soapNote: {},
      aiModel: null,
    };
    const { service, sessionRepository, versionRepository } = buildService(session);

    const result = await service.generateNote('tenant-1', actor, 'session-1');

    expect(result.status).toBe(DocumentationSessionStatus.NOTE_GENERATED);
    expect(result.soapNote.assessment).toBe('Cough.');
    expect(sessionRepository.save).toHaveBeenCalledWith(session);
    expect(versionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ versionNumber: 1, source: 'ai_generated', sessionId: 'session-1' }),
    );
  });
});
