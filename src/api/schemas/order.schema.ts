import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

export interface OrderItem {
  recordId: Types.ObjectId;
  quantity: number;
  priceAtTime: number;
}

@Schema({ timestamps: true })
export class Order extends Document {
  @Prop({
    type: [
      {
        recordId: { type: Types.ObjectId, ref: 'Record', required: true },
        quantity: { type: Number, required: true },
        priceAtTime: { type: Number, required: true },
      },
    ],
    required: true,
  })
  items: OrderItem[];

  @Prop({ required: true })
  totalAmount: number;

  @Prop({ enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Prop({ default: Date.now })
  created: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ status: 1 });
OrderSchema.index({ created: -1 });
