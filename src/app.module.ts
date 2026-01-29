import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { RecordModule } from './api/record.module';
import { OrderModule } from './api/order.module';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfig } from './app.config';

@Module({
  imports: [
    CacheModule.register({
      ttl: 60000, // 60 seconds
      max: 100, // maximum 100 items in cache
      isGlobal: true,
    }),
    MongooseModule.forRoot(AppConfig.mongoUrl),
    RecordModule,
    OrderModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
