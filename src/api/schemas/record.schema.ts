import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { RecordFormat, RecordCategory } from './record.enum';

export interface TracklistItem {
  title: string;
  position: number;
  length?: number;
}

@Schema({ timestamps: true })
export class Record extends Document {
  @Prop({ required: true })
  artist: string;

  @Prop({ required: true })
  album: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  qty: number;

  @Prop({ enum: RecordFormat, required: true })
  format: RecordFormat;

  @Prop({ enum: RecordCategory, required: true })
  category: RecordCategory;

  @Prop({ default: Date.now })
  created: Date;

  @Prop({ default: Date.now })
  lastModified: Date;

  @Prop({ required: false })
  mbid?: string;

  @Prop({
    type: [{ title: String, position: Number, length: Number }],
    default: [],
  })
  tracklist: TracklistItem[];
}

export const RecordSchema = SchemaFactory.createForClass(Record);

// Indexes for performance optimization
RecordSchema.index({ artist: 1, album: 1, format: 1 }, { unique: true });
RecordSchema.index({ artist: 'text', album: 'text' });
RecordSchema.index({ category: 1 });
RecordSchema.index({ format: 1 });
RecordSchema.index({ created: -1 });
