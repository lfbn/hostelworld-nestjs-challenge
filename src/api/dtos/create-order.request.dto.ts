import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsInt,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDTO {
  @ApiProperty({
    description: 'Record ID',
    type: String,
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsNotEmpty()
  recordId: string;

  @ApiProperty({
    description: 'Quantity to order',
    type: Number,
    example: 1,
  })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderRequestDTO {
  @ApiProperty({
    description: 'Order items',
    type: [OrderItemDTO],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDTO)
  items: OrderItemDTO[];
}
