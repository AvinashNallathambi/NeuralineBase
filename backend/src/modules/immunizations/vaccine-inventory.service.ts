import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThan } from 'typeorm';
import { VaccineInventory } from './entities/vaccine-inventory.entity';
import { CreateVaccineInventoryDto, AdjustQuantityDto } from './dto/create-vaccine-inventory.dto';

@Injectable()
export class VaccineInventoryService {
  private readonly logger = new Logger(VaccineInventoryService.name);

  constructor(
    @InjectRepository(VaccineInventory)
    private readonly repository: Repository<VaccineInventory>,
  ) {}

  async findAll(tenantId: string): Promise<VaccineInventory[]> {
    return this.repository.find({
      where: { tenantId },
      order: { expirationDate: 'ASC' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<VaccineInventory> {
    const item = await this.repository.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundException(`Vaccine inventory item "${id}" not found`);
    return item;
  }

  async create(tenantId: string, dto: CreateVaccineInventoryDto): Promise<VaccineInventory> {
    const item = new VaccineInventory();
    item.tenantId = tenantId;
    item.vaccineName = dto.vaccineName;
    item.cvxCode = dto.cvxCode || null;
    item.ndcCode = dto.ndcCode || null;
    item.manufacturer = dto.manufacturer || null;
    item.lotNumber = dto.lotNumber;
    item.expirationDate = new Date(dto.expirationDate);
    item.quantityReceived = dto.quantityReceived || 0;
    item.quantityOnHand = dto.quantityReceived || 0;
    item.quantityAdministered = 0;
    item.fundingSource = dto.fundingSource || 'private';
    item.vfcEligibility = null;
    item.storageLocation = dto.storageLocation || null;
    item.storageTempMin = dto.storageTempMin || null;
    item.storageTempMax = dto.storageTempMax || null;
    item.receivedDate = dto.receivedDate ? new Date(dto.receivedDate) : null;
    item.notes = dto.notes || null;
    item.status = 'available';
    return this.repository.save(item);
  }

  async adjustQuantity(tenantId: string, id: string, dto: AdjustQuantityDto): Promise<VaccineInventory> {
    const item = await this.findOne(tenantId, id);
    const newQty = item.quantityOnHand + dto.adjustment;
    if (newQty < 0) {
      throw new BadRequestException(`Cannot reduce below 0 (current: ${item.quantityOnHand}, adjustment: ${dto.adjustment})`);
    }
    item.quantityOnHand = newQty;
    if (dto.adjustment < 0) {
      item.quantityAdministered += Math.abs(dto.adjustment);
    }
    if (newQty === 0) {
      item.status = 'depleted';
    } else if (item.status === 'depleted' && newQty > 0) {
      item.status = 'available';
    }
    return this.repository.save(item);
  }

  async update(tenantId: string, id: string, updates: Partial<CreateVaccineInventoryDto>): Promise<VaccineInventory> {
    const item = await this.findOne(tenantId, id);
    Object.assign(item, {
      ...(updates.vaccineName && { vaccineName: updates.vaccineName }),
      ...(updates.cvxCode !== undefined && { cvxCode: updates.cvxCode }),
      ...(updates.ndcCode !== undefined && { ndcCode: updates.ndcCode }),
      ...(updates.manufacturer !== undefined && { manufacturer: updates.manufacturer }),
      ...(updates.lotNumber && { lotNumber: updates.lotNumber }),
      ...(updates.expirationDate && { expirationDate: new Date(updates.expirationDate) }),
      ...(updates.fundingSource && { fundingSource: updates.fundingSource }),
      ...(updates.storageLocation !== undefined && { storageLocation: updates.storageLocation }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
    });
    return this.repository.save(item);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const item = await this.findOne(tenantId, id);
    await this.repository.softRemove(item);
  }

  async getExpiringSoon(tenantId: string, daysAhead = 60): Promise<VaccineInventory[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);
    return this.repository.find({
      where: { tenantId, status: 'available', expirationDate: LessThanOrEqual(cutoff) },
      order: { expirationDate: 'ASC' },
    });
  }

  async getLowStock(tenantId: string, threshold = 10): Promise<VaccineInventory[]> {
    return this.repository.find({
      where: { tenantId, status: 'available' },
      order: { quantityOnHand: 'ASC' },
    }).then(items => items.filter(i => i.quantityOnHand <= threshold));
  }

  async markExpired(tenantId: string): Promise<number> {
    const today = new Date();
    const expired = await this.repository.find({
      where: { tenantId, status: 'available', expirationDate: LessThanOrEqual(today) },
    });
    for (const item of expired) {
      item.status = 'expired';
    }
    if (expired.length > 0) {
      await this.repository.save(expired);
    }
    return expired.length;
  }
}
