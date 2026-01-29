import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { RecordService } from './record.service';
import { MusicBrainzService } from './musicbrainz.service';
import { RecordFormat, RecordCategory } from '../schemas/record.enum';

describe('RecordService', () => {
  let service: RecordService;
  let mockRecordModel: any;
  let mockCacheManager: any;
  let mockMusicBrainzService: any;

  const mockRecord = {
    _id: '507f1f77bcf86cd799439011',
    artist: 'The Beatles',
    album: 'Abbey Road',
    price: 25,
    qty: 10,
    format: RecordFormat.VINYL,
    category: RecordCategory.ROCK,
    tracklist: [],
    save: jest.fn(),
  };

  beforeEach(async () => {
    mockRecordModel = {
      create: jest.fn(),
      find: jest.fn().mockReturnThis(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      countDocuments: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      store: {
        keys: jest.fn().mockResolvedValue([]),
      },
    };

    mockMusicBrainzService = {
      fetchTracklist: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordService,
        {
          provide: getModelToken('Record'),
          useValue: mockRecordModel,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: MusicBrainzService,
          useValue: mockMusicBrainzService,
        },
      ],
    }).compile();

    service = module.get<RecordService>(RecordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a record without MBID', async () => {
      const createDto = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: 25,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      mockRecordModel.create.mockResolvedValue(mockRecord);

      const result = await service.create(createDto);

      expect(mockRecordModel.create).toHaveBeenCalledWith({
        ...createDto,
        mbid: undefined,
        tracklist: [],
      });
      expect(result).toEqual(mockRecord);
    });

    it('should create a record with MBID and fetch tracklist', async () => {
      const createDto = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: 25,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
        mbid: 'test-mbid',
      };

      const mockTracklist = [{ title: 'Come Together', position: 1 }];
      mockMusicBrainzService.fetchTracklist.mockResolvedValue(mockTracklist);
      mockRecordModel.create.mockResolvedValue({ ...mockRecord, tracklist: mockTracklist });

      const result = await service.create(createDto);

      expect(mockMusicBrainzService.fetchTracklist).toHaveBeenCalledWith('test-mbid');
      expect(mockRecordModel.create).toHaveBeenCalledWith({
        ...createDto,
        tracklist: mockTracklist,
      });
    });
  });

  describe('findById', () => {
    it('should return a record when found', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockRecordModel.findById.mockResolvedValue(mockRecord);

      const result = await service.findById('507f1f77bcf86cd799439011');

      expect(result).toEqual(mockRecord);
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should return cached record when available', async () => {
      mockCacheManager.get.mockResolvedValue(mockRecord);

      const result = await service.findById('507f1f77bcf86cd799439011');

      expect(result).toEqual(mockRecord);
      expect(mockRecordModel.findById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when record not found', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockRecordModel.findById.mockResolvedValue(null);

      await expect(service.findById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a record', async () => {
      const updateDto = { price: 30 };
      const updatedRecord = { ...mockRecord, price: 30 };

      mockRecordModel.findById.mockResolvedValue(mockRecord);
      mockRecordModel.findByIdAndUpdate.mockResolvedValue(updatedRecord);

      const result = await service.update('507f1f77bcf86cd799439011', updateDto);

      expect(result.price).toBe(30);
    });

    it('should throw NotFoundException when record not found', async () => {
      mockRecordModel.findById.mockResolvedValue(null);

      await expect(
        service.update('invalid-id', { price: 30 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should fetch new tracklist when MBID changes', async () => {
      const updateDto = { mbid: 'new-mbid' };
      const mockTracklist = [{ title: 'New Track', position: 1 }];

      mockRecordModel.findById.mockResolvedValue({ ...mockRecord, mbid: 'old-mbid' });
      mockMusicBrainzService.fetchTracklist.mockResolvedValue(mockTracklist);
      mockRecordModel.findByIdAndUpdate.mockResolvedValue({
        ...mockRecord,
        mbid: 'new-mbid',
        tracklist: mockTracklist,
      });

      await service.update('507f1f77bcf86cd799439011', updateDto);

      expect(mockMusicBrainzService.fetchTracklist).toHaveBeenCalledWith('new-mbid');
    });
  });

  describe('delete', () => {
    it('should delete a record', async () => {
      mockRecordModel.findByIdAndDelete.mockResolvedValue(mockRecord);

      await service.delete('507f1f77bcf86cd799439011');

      expect(mockRecordModel.findByIdAndDelete).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
      );
    });

    it('should throw NotFoundException when record not found', async () => {
      mockRecordModel.findByIdAndDelete.mockResolvedValue(null);

      await expect(service.delete('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated records', async () => {
      const records = [mockRecord];
      mockCacheManager.get.mockResolvedValue(null);
      mockRecordModel.find.mockReturnThis();
      mockRecordModel.sort.mockReturnThis();
      mockRecordModel.skip.mockReturnThis();
      mockRecordModel.limit.mockReturnThis();
      mockRecordModel.exec.mockResolvedValue(records);
      mockRecordModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.findAll({}, { page: 1, limit: 10 });

      expect(result.data).toEqual(records);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });

    it('should filter by artist', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockRecordModel.find.mockReturnThis();
      mockRecordModel.sort.mockReturnThis();
      mockRecordModel.skip.mockReturnThis();
      mockRecordModel.limit.mockReturnThis();
      mockRecordModel.exec.mockResolvedValue([]);
      mockRecordModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.findAll({ artist: 'Beatles' }, {});

      expect(mockRecordModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          artist: { $regex: 'Beatles', $options: 'i' },
        }),
      );
    });
  });
});
