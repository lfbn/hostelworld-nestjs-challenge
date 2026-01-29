import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { RecordFormat, RecordCategory } from '../src/api/schemas/record.enum';

describe('OrderController (e2e)', () => {
  let app: INestApplication;
  let recordModel;
  let orderModel;
  let createdRecordIds: string[] = [];
  let createdOrderIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    recordModel = app.get('RecordModel');
    orderModel = app.get('OrderModel');
    await app.init();
  });

  afterEach(async () => {
    // Clean up orders
    for (const orderId of createdOrderIds) {
      await orderModel.findByIdAndDelete(orderId);
    }
    createdOrderIds = [];

    // Clean up records
    for (const recordId of createdRecordIds) {
      await recordModel.findByIdAndDelete(recordId);
    }
    createdRecordIds = [];
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /orders', () => {
    it('should create an order successfully', async () => {
      // Create a record first
      const createRecordDto = {
        artist: 'Order Test Artist',
        album: 'Order Test Album',
        price: 25,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      const recordResponse = await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(201);

      createdRecordIds.push(recordResponse.body._id);

      // Create an order
      const createOrderDto = {
        items: [{ recordId: recordResponse.body._id, quantity: 2 }],
      };

      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(201);

      createdOrderIds.push(orderResponse.body._id);

      expect(orderResponse.body).toHaveProperty('_id');
      expect(orderResponse.body).toHaveProperty('items');
      expect(orderResponse.body.items).toHaveLength(1);
      expect(orderResponse.body).toHaveProperty('totalAmount', 50); // 25 * 2
      expect(orderResponse.body).toHaveProperty('status', 'pending');

      // Verify stock was decremented
      const updatedRecord = await request(app.getHttpServer())
        .get(`/records/${recordResponse.body._id}`)
        .expect(200);

      expect(updatedRecord.body.qty).toBe(8); // 10 - 2
    });

    it('should return 404 for non-existent record', async () => {
      const createOrderDto = {
        items: [{ recordId: '507f1f77bcf86cd799439011', quantity: 1 }],
      };

      await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(404);
    });

    it('should return 400 for invalid record ID', async () => {
      const createOrderDto = {
        items: [{ recordId: 'invalid-id', quantity: 1 }],
      };

      await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(400);
    });

    it('should return 400 for insufficient stock', async () => {
      // Create a record with low stock
      const createRecordDto = {
        artist: 'Low Stock Artist',
        album: 'Low Stock Album',
        price: 20,
        qty: 2,
        format: RecordFormat.CD,
        category: RecordCategory.JAZZ,
      };

      const recordResponse = await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(201);

      createdRecordIds.push(recordResponse.body._id);

      // Try to order more than available
      const createOrderDto = {
        items: [{ recordId: recordResponse.body._id, quantity: 5 }],
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(400);

      expect(response.body.message).toContain('Insufficient stock');
    });

    it('should create order with multiple items', async () => {
      // Create two records
      const record1 = await request(app.getHttpServer())
        .post('/records')
        .send({
          artist: 'Multi Order Artist 1',
          album: 'Multi Order Album 1',
          price: 20,
          qty: 10,
          format: RecordFormat.VINYL,
          category: RecordCategory.ROCK,
        })
        .expect(201);

      const record2 = await request(app.getHttpServer())
        .post('/records')
        .send({
          artist: 'Multi Order Artist 2',
          album: 'Multi Order Album 2',
          price: 30,
          qty: 10,
          format: RecordFormat.CD,
          category: RecordCategory.JAZZ,
        })
        .expect(201);

      createdRecordIds.push(record1.body._id, record2.body._id);

      const createOrderDto = {
        items: [
          { recordId: record1.body._id, quantity: 2 },
          { recordId: record2.body._id, quantity: 1 },
        ],
      };

      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(201);

      createdOrderIds.push(orderResponse.body._id);

      expect(orderResponse.body.items).toHaveLength(2);
      expect(orderResponse.body.totalAmount).toBe(70); // (20*2) + (30*1)
    });

    it('should return 400 for empty items array', async () => {
      const createOrderDto = {
        items: [],
      };

      await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(400);
    });
  });

  describe('GET /orders', () => {
    it('should return paginated orders', async () => {
      // Create a record and order
      const recordResponse = await request(app.getHttpServer())
        .post('/records')
        .send({
          artist: 'List Orders Artist',
          album: 'List Orders Album',
          price: 25,
          qty: 10,
          format: RecordFormat.VINYL,
          category: RecordCategory.ROCK,
        })
        .expect(201);

      createdRecordIds.push(recordResponse.body._id);

      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .send({
          items: [{ recordId: recordResponse.body._id, quantity: 1 }],
        })
        .expect(201);

      createdOrderIds.push(orderResponse.body._id);

      const response = await request(app.getHttpServer())
        .get('/orders?page=1&limit=10')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('page', 1);
      expect(response.body.meta).toHaveProperty('limit', 10);
      expect(response.body.meta).toHaveProperty('totalPages');
    });
  });

  describe('GET /orders/:id', () => {
    it('should return an order by ID', async () => {
      // Create a record and order
      const recordResponse = await request(app.getHttpServer())
        .post('/records')
        .send({
          artist: 'Get Order Artist',
          album: 'Get Order Album',
          price: 25,
          qty: 10,
          format: RecordFormat.VINYL,
          category: RecordCategory.ROCK,
        })
        .expect(201);

      createdRecordIds.push(recordResponse.body._id);

      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .send({
          items: [{ recordId: recordResponse.body._id, quantity: 1 }],
        })
        .expect(201);

      createdOrderIds.push(orderResponse.body._id);

      const response = await request(app.getHttpServer())
        .get(`/orders/${orderResponse.body._id}`)
        .expect(200);

      expect(response.body).toHaveProperty('_id', orderResponse.body._id);
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('totalAmount');
    });

    it('should return 404 for non-existent order', async () => {
      await request(app.getHttpServer())
        .get('/orders/507f1f77bcf86cd799439011')
        .expect(404);
    });

    it('should return 400 for invalid order ID', async () => {
      await request(app.getHttpServer())
        .get('/orders/invalid-id')
        .expect(400);
    });
  });
});
