import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, SortOrder } from 'mongoose';
import { Order, OrderItem } from '../schemas/order.schema';
import { Record } from '../schemas/record.schema';
import { CreateOrderRequestDTO } from '../dtos/create-order.request.dto';
import { PaginationQueryDTO, PaginatedResponse } from '../dtos/pagination.dto';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel('Order') private readonly orderModel: Model<Order>,
    @InjectModel('Record') private readonly recordModel: Model<Record>,
  ) {}

  async create(createOrderDto: CreateOrderRequestDTO): Promise<Order> {
    const orderItems: OrderItem[] = [];
    let totalAmount = 0;

    // Validate all records exist and have sufficient stock
    for (const item of createOrderDto.items) {
      if (!Types.ObjectId.isValid(item.recordId)) {
        throw new BadRequestException(`Invalid record ID: ${item.recordId}`);
      }

      const record = await this.recordModel.findById(item.recordId);
      if (!record) {
        throw new NotFoundException(`Record not found: ${item.recordId}`);
      }

      if (record.qty < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for record "${record.album}" by ${record.artist}. Available: ${record.qty}, Requested: ${item.quantity}`,
        );
      }

      orderItems.push({
        recordId: new Types.ObjectId(item.recordId),
        quantity: item.quantity,
        priceAtTime: record.price,
      });

      totalAmount += record.price * item.quantity;
    }

    // Decrement stock for all records
    for (const item of createOrderDto.items) {
      await this.recordModel.findByIdAndUpdate(item.recordId, {
        $inc: { qty: -item.quantity },
      });
    }

    return await this.orderModel.create({
      items: orderItems,
      totalAmount,
    });
  }

  async findAll(
    pagination?: PaginationQueryDTO,
  ): Promise<PaginatedResponse<Order>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const sortBy = pagination?.sortBy ?? 'created';
    const sortOrder: SortOrder = pagination?.sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.orderModel
        .find()
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments().exec(),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<Order> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid order ID');
    }

    const order = await this.orderModel.findById(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }
}
