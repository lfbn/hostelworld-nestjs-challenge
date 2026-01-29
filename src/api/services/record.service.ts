import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Model, FilterQuery, SortOrder } from 'mongoose';
import { Record } from '../schemas/record.schema';
import { CreateRecordRequestDTO } from '../dtos/create-record.request.dto';
import { UpdateRecordRequestDTO } from '../dtos/update-record.request.dto';
import { RecordCategory, RecordFormat } from '../schemas/record.enum';
import {
  PaginationQueryDTO,
  PaginatedResponse,
} from '../dtos/pagination.dto';
import { MusicBrainzService } from './musicbrainz.service';

export interface RecordFilters {
  q?: string;
  artist?: string;
  album?: string;
  format?: RecordFormat;
  category?: RecordCategory;
}

const CACHE_KEY_PREFIX = 'records';
const CACHE_TTL = 60000; // 60 seconds

@Injectable()
export class RecordService {
  constructor(
    @InjectModel('Record') private readonly recordModel: Model<Record>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly musicBrainzService: MusicBrainzService,
  ) {}

  private generateCacheKey(
    filters: RecordFilters,
    pagination?: PaginationQueryDTO,
  ): string {
    return `${CACHE_KEY_PREFIX}:${JSON.stringify({ filters, pagination })}`;
  }

  private async invalidateCache(): Promise<void> {
    // Reset cache by deleting known keys
    // For simple in-memory cache, we use reset() if available
    const store = this.cacheManager as any;
    if (store.reset) {
      await store.reset();
    }
  }

  async create(createRecordDto: CreateRecordRequestDTO): Promise<Record> {
    let tracklist = [];

    if (createRecordDto.mbid) {
      tracklist = await this.musicBrainzService.fetchTracklist(
        createRecordDto.mbid,
      );
    }

    const record = await this.recordModel.create({
      artist: createRecordDto.artist,
      album: createRecordDto.album,
      price: createRecordDto.price,
      qty: createRecordDto.qty,
      format: createRecordDto.format,
      category: createRecordDto.category,
      mbid: createRecordDto.mbid,
      tracklist,
    });

    await this.invalidateCache();
    return record;
  }

  async update(
    id: string,
    updateRecordDto: UpdateRecordRequestDTO,
  ): Promise<Record> {
    const record = await this.recordModel.findById(id);
    if (!record) {
      throw new NotFoundException('Record not found');
    }

    const updateData: Partial<Record> & { lastModified: Date } = {
      ...updateRecordDto,
      lastModified: new Date(),
    };

    // If MBID changed, fetch new tracklist
    if (updateRecordDto.mbid && updateRecordDto.mbid !== record.mbid) {
      const tracklist = await this.musicBrainzService.fetchTracklist(
        updateRecordDto.mbid,
      );
      (updateData as any).tracklist = tracklist;
    }

    const updated = await this.recordModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updated) {
      throw new NotFoundException('Record not found');
    }

    await this.invalidateCache();
    return updated;
  }

  private buildFilterQuery(filters: RecordFilters): FilterQuery<Record> {
    const query: FilterQuery<Record> = {};

    if (filters.q) {
      query.$or = [
        { artist: { $regex: filters.q, $options: 'i' } },
        { album: { $regex: filters.q, $options: 'i' } },
        { category: { $regex: filters.q, $options: 'i' } },
      ];
    }

    if (filters.artist) {
      query.artist = { $regex: filters.artist, $options: 'i' };
    }

    if (filters.album) {
      query.album = { $regex: filters.album, $options: 'i' };
    }

    if (filters.format) {
      query.format = filters.format;
    }

    if (filters.category) {
      query.category = filters.category;
    }

    return query;
  }

  async findAll(
    filters: RecordFilters,
    pagination?: PaginationQueryDTO,
  ): Promise<PaginatedResponse<Record>> {
    const cacheKey = this.generateCacheKey(filters, pagination);

    // Try to get from cache
    const cached = await this.cacheManager.get<PaginatedResponse<Record>>(cacheKey);
    if (cached) {
      return cached;
    }

    const query = this.buildFilterQuery(filters);

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const sortBy = pagination?.sortBy ?? 'created';
    const sortOrder: SortOrder = pagination?.sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.recordModel
        .find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.recordModel.countDocuments(query).exec(),
    ]);

    const result: PaginatedResponse<Record> = {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Store in cache
    await this.cacheManager.set(cacheKey, result, CACHE_TTL);

    return result;
  }

  async findById(id: string): Promise<Record> {
    const cacheKey = `${CACHE_KEY_PREFIX}:id:${id}`;

    // Try to get from cache
    const cached = await this.cacheManager.get<Record>(cacheKey);
    if (cached) {
      return cached;
    }

    const record = await this.recordModel.findById(id);
    if (!record) {
      throw new NotFoundException('Record not found');
    }

    // Store in cache
    await this.cacheManager.set(cacheKey, record, CACHE_TTL);

    return record;
  }

  async delete(id: string): Promise<void> {
    const result = await this.recordModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Record not found');
    }

    await this.invalidateCache();
  }
}
