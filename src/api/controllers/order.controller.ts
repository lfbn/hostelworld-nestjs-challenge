import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Order } from '../schemas/order.schema';
import { CreateOrderRequestDTO } from '../dtos/create-order.request.dto';
import { OrderService } from '../services/order.service';
import { PaginatedResponse } from '../dtos/pagination.dto';

@ApiTags('orders')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'Order successfully created' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid data or insufficient stock' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async create(@Body() request: CreateOrderRequestDTO): Promise<Order> {
    return await this.orderService.create(request);
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of orders',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 20, max: 100)',
    type: Number,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Sort field (default: created)',
    enum: ['created', 'totalAmount', 'status'],
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: 'Sort order (default: desc)',
    enum: ['asc', 'desc'],
  })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ): Promise<PaginatedResponse<Order>> {
    return await this.orderService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sortBy,
      sortOrder,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an order by ID' })
  @ApiResponse({ status: 200, description: 'Order found' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findById(@Param('id') id: string): Promise<Order> {
    return await this.orderService.findById(id);
  }
}
