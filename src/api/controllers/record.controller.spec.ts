import { Test, TestingModule } from '@nestjs/testing';
import { RecordController } from './record.controller';
import { RecordService } from '../services/record.service';
import { CreateRecordRequestDTO } from '../dtos/create-record.request.dto';
import { RecordCategory, RecordFormat } from '../schemas/record.enum';

describe('RecordController', () => {
  let recordController: RecordController;
  let recordService: RecordService;

  const mockRecordService = {
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecordController],
      providers: [
        {
          provide: RecordService,
          useValue: mockRecordService,
        },
      ],
    }).compile();

    recordController = module.get<RecordController>(RecordController);
    recordService = module.get<RecordService>(RecordService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new record', async () => {
    const createRecordDto: CreateRecordRequestDTO = {
      artist: 'Test',
      album: 'Test Record',
      price: 100,
      qty: 10,
      format: RecordFormat.VINYL,
      category: RecordCategory.ALTERNATIVE,
    };

    const savedRecord = {
      _id: '1',
      ...createRecordDto,
      tracklist: [],
    };

    mockRecordService.create.mockResolvedValue(savedRecord);

    const result = await recordController.create(createRecordDto);
    expect(result).toEqual(savedRecord);
    expect(mockRecordService.create).toHaveBeenCalledWith(createRecordDto);
  });

  it('should return paginated records', async () => {
    const paginatedResponse = {
      data: [
        { _id: '1', artist: 'Artist 1', album: 'Album 1', price: 100, qty: 10 },
        { _id: '2', artist: 'Artist 2', album: 'Album 2', price: 200, qty: 20 },
      ],
      meta: {
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    };

    mockRecordService.findAll.mockResolvedValue(paginatedResponse);

    const result = await recordController.findAll();
    expect(result).toEqual(paginatedResponse);
    expect(mockRecordService.findAll).toHaveBeenCalled();
  });

  it('should return a record by ID', async () => {
    const record = {
      _id: '1',
      artist: 'Test Artist',
      album: 'Test Album',
      price: 100,
      qty: 10,
    };

    mockRecordService.findById.mockResolvedValue(record);

    const result = await recordController.findById('1');
    expect(result).toEqual(record);
    expect(mockRecordService.findById).toHaveBeenCalledWith('1');
  });

  it('should update a record', async () => {
    const updateDto = { price: 150 };
    const updatedRecord = {
      _id: '1',
      artist: 'Test Artist',
      album: 'Test Album',
      price: 150,
      qty: 10,
    };

    mockRecordService.update.mockResolvedValue(updatedRecord);

    const result = await recordController.update('1', updateDto);
    expect(result).toEqual(updatedRecord);
    expect(mockRecordService.update).toHaveBeenCalledWith('1', updateDto);
  });

  it('should delete a record', async () => {
    mockRecordService.delete.mockResolvedValue(undefined);

    await recordController.delete('1');
    expect(mockRecordService.delete).toHaveBeenCalledWith('1');
  });
});
