import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Provider } from './provider.entity';

const DEFAULT_PROVIDERS: Omit<Provider, 'createdAt' | 'updatedAt' | 'deletedAt'>[] = [
  {
    id: 'usr-001',
    tenantId: '00000000-0000-0000-0000-000000000000',
    firstName: 'Sarah',
    lastName: 'Chen',
    npi: '1234567890',
    role: 'doctor',
    specialization: 'Internal Medicine',
    department: 'Primary Care',
    email: 'dr.sarah.chen@neuraline.health',
    phone: '(415) 555-0142',
    status: 'active',
  },
  {
    id: 'usr-002',
    tenantId: '00000000-0000-0000-0000-000000000000',
    firstName: 'James',
    lastName: 'Wilson',
    npi: '1234567891',
    role: 'doctor',
    specialization: 'Cardiology',
    department: 'Cardiology',
    email: 'dr.james.wilson@neuraline.health',
    phone: '(415) 555-0143',
    status: 'active',
  },
  {
    id: 'usr-003',
    tenantId: '00000000-0000-0000-0000-000000000000',
    firstName: 'Maria',
    lastName: 'Garcia',
    npi: '1234567892',
    role: 'doctor',
    specialization: 'Pediatrics',
    department: 'Pediatrics',
    email: 'dr.maria.garcia@neuraline.health',
    phone: '(415) 555-0144',
    status: 'active',
  },
  {
    id: 'usr-004',
    tenantId: '00000000-0000-0000-0000-000000000000',
    firstName: 'Robert',
    lastName: 'Kim',
    npi: '1234567893',
    role: 'doctor',
    specialization: 'Neurology',
    department: 'Neurology',
    email: 'dr.robert.kim@neuraline.health',
    phone: '(415) 555-0145',
    status: 'active',
  },
];

@Injectable()
export class ProvidersService implements OnModuleInit {
  constructor(
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedProviders();
  }

  private async seedProviders(): Promise<void> {
    for (const data of DEFAULT_PROVIDERS) {
      const existing = await this.providerRepository.findOne({
        where: { id: data.id, tenantId: data.tenantId },
      });
      if (!existing) {
        const provider = this.providerRepository.create(data);
        await this.providerRepository.save(provider);
      }
    }
  }

  async findAll(tenantId: string): Promise<Provider[]> {
    return this.providerRepository.find({
      where: { tenantId, status: 'active' },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<Provider> {
    const provider = await this.providerRepository.findOne({
      where: { tenantId, id },
    });
    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }
    return provider;
  }
}
