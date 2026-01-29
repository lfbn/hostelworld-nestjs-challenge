import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { OrderService } from './order.service';
import { RecordFormat, RecordCategory } from '../schemas/record.enum';
import { OrderStatus } from '../schemas/order.schema';

describe('OrderService', () => {
  let service: OrderService;
  let mockOrderModel: any;
  let mockRecordModel: any;

  const validRecordId = new Types.ObjectId().toString();

  const mockRecord = {
    _id: validRecordId,
    artist: 'The Beatles',
    album: 'Abbey Road',
    price: 25,
    qty: 10,
    format: RecordFormat.VINYL,
    category: RecordCategory.ROCK,
  };

  const mockOrder = {
    _id: new Types.ObjectId().toString(),
    items: [
      {
        recordId: new Types.ObjectId(validRecordId),
        quantity: 2,
        priceAtTime: 25,
      },
    ],
    totalAmount: 50,
    status: OrderStatus.PENDING,
    created: new Date(),
  };

  beforeEach(async () => {
    mockOrderModel = {
      create: jest.fn(),
      find: jest.fn().mockReturnThis(),
      findById: jest.fn(),
      countDocuments: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    mockRecordModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getModelToken('Order'),
          useValue: mockOrderModel,
        },
        {
          provide: getModelToken('Record'),
          useValue: mockRecordModel,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an order successfully', async () => {
      mockRecordModel.findById.mockResolvedValue(mockRecord);
      mockRecordModel.findByIdAndUpdate.mockResolvedValue(mockRecord);
      mockOrderModel.create.mockResolvedValue(mockOrder);

      const createDto = {
        items: [{ recordId: validRecordId, quantity: 2 }],
      };

      const result = await service.create(createDto);

      expect(result).toEqual(mockOrder);
      expect(mockRecordModel.findByIdAndUpdate).toHaveBeenCalledWith(
        validRecordId,
        { $inc: { qty: -2 } },
      );
    });

    it('should throw BadRequestException for invalid record ID', async () => {
      const createDto = {
        items: [{ recordId: 'invalid-id', quantity: 1 }],
      };

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when record not found', async () => {
      mockRecordModel.findById.mockResolvedValue(null);

      const createDto = {
        items: [{ recordId: validRecordId, quantity: 1 }],
      };

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for insufficient stock', async () => {
      mockRecordModel.findById.mockResolvedValue({ ...mockRecord, qty: 1 });

      const createDto = {
        items: [{ recordId: validRecordId, quantity: 5 }],
      };

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should calculate total amount correctly for multiple items', async () => {
      const record1Id = new Types.ObjectId().toString();
      const record2Id = new Types.ObjectId().toString();

      mockRecordModel.findById
        .mockResolvedValueOnce({ ...mockRecord, _id: record1Id, price: 20 })
        .mockResolvedValueOnce({ ...mockRecord, _id: record2Id, price: 30 });

      mockRecordModel.findByIdAndUpdate.mockResolvedValue(mockRecord);

      const expectedOrder = {
        ...mockOrder,
        items: [
          { recordId: new Types.ObjectId(record1Id), quantity: 2, priceAtTime: 20 },
          { recordId: new Types.ObjectId(record2Id), quantity: 1, priceAtTime: 30 },
        ],
        totalAmount: 70, // (2 * 20) + (1 * 30)
      };

      mockOrderModel.create.mockResolvedValue(expectedOrder);

      const createDto = {
        items: [
          { recordId: record1Id, quantity: 2 },
          { recordId: record2Id, quantity: 1 },
        ],
      };

      const result = await service.create(createDto);

      expect(result.totalAmount).toBe(70);
    });
  });

  describe('findById', () => {
    it('should return an order when found', async () => {
      mockOrderModel.findById.mockResolvedValue(mockOrder);

      const result = await service.findById(mockOrder._id);

      expect(result).toEqual(mockOrder);
    });

    it('should throw BadRequestException for invalid order ID', async () => {
      await expect(service.findById('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when order not found', async () => {
      const validId = new Types.ObjectId().toString();
      mockOrderModel.findById.mockResolvedValue(null);

      await expect(service.findById(validId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated orders', async () => {
      const orders = [mockOrder];
      mockOrderModel.find.mockReturnThis();
      mockOrderModel.sort.mockReturnThis();
      mockOrderModel.skip.mockReturnThis();
      mockOrderModel.limit.mockReturnThis();
      mockOrderModel.exec.mockResolvedValue(orders);
      mockOrderModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(orders);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });

    it('should use default pagination values', async () => {
      mockOrderModel.find.mockReturnThis();
      mockOrderModel.sort.mockReturnThis();
      mockOrderModel.skip.mockReturnThis();
      mockOrderModel.limit.mockReturnThis();
      mockOrderModel.exec.mockResolvedValue([]);
      mockOrderModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      const result = await service.findAll();

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });
  });
});
