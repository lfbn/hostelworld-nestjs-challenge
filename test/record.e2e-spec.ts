import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { RecordFormat, RecordCategory } from '../src/api/schemas/record.enum';

describe('RecordController (e2e)', () => {
  let app: INestApplication;
  let recordId: string;
  let recordModel;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    recordModel = app.get('RecordModel');
    await app.init();
  });

  describe('POST /records', () => {
    it('should create a new record', async () => {
      const createRecordDto = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: 25,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      const response = await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(201);

      recordId = response.body._id;
      expect(response.body).toHaveProperty('artist', 'The Beatles');
      expect(response.body).toHaveProperty('album', 'Abbey Road');
      expect(response.body).toHaveProperty('tracklist');
      expect(Array.isArray(response.body.tracklist)).toBe(true);
    });

    it('should return 400 for invalid data', async () => {
      const invalidDto = {
        artist: 'Test',
        // missing required fields
      };

      await request(app.getHttpServer())
        .post('/records')
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('GET /records', () => {
    it('should return paginated records', async () => {
      const createRecordDto = {
        artist: 'Test Artist Pagination',
        album: 'Test Album',
        price: 20,
        qty: 5,
        format: RecordFormat.CD,
        category: RecordCategory.JAZZ,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(201);

      recordId = createResponse.body._id;

      const response = await request(app.getHttpServer())
        .get('/records?page=1&limit=10')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('page', 1);
      expect(response.body.meta).toHaveProperty('limit', 10);
      expect(response.body.meta).toHaveProperty('totalPages');
    });

    it('should filter by artist', async () => {
      const createRecordDto = {
        artist: 'Unique Artist Filter Test',
        album: 'Test Album',
        price: 25,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(201);

      recordId = createResponse.body._id;

      const response = await request(app.getHttpServer())
        .get('/records?artist=Unique Artist Filter Test')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0]).toHaveProperty('artist', 'Unique Artist Filter Test');
    });

    it('should filter by category', async () => {
      const createRecordDto = {
        artist: 'Category Test Artist',
        album: 'Category Album',
        price: 30,
        qty: 5,
        format: RecordFormat.VINYL,
        category: RecordCategory.CLASSICAL,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(201);

      recordId = createResponse.body._id;

      const response = await request(app.getHttpServer())
        .get(`/records?category=${RecordCategory.CLASSICAL}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      response.body.data.forEach((record: any) => {
        expect(record.category).toBe(RecordCategory.CLASSICAL);
      });
    });

    it('should support sorting', async () => {
      const response = await request(app.getHttpServer())
        .get('/records?sortBy=price&sortOrder=asc')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
    });
  });

  describe('GET /records/:id', () => {
    it('should return a record by ID', async () => {
      const createRecordDto = {
        artist: 'Get By Id Artist',
        album: 'Get By Id Album',
        price: 35,
        qty: 3,
        format: RecordFormat.CASSETTE,
        category: RecordCategory.POP,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(201);

      recordId = createResponse.body._id;

      const response = await request(app.getHttpServer())
        .get(`/records/${recordId}`)
        .expect(200);

      expect(response.body).toHaveProperty('_id', recordId);
      expect(response.body).toHaveProperty('artist', 'Get By Id Artist');
    });

    it('should return 404 for non-existent record', async () => {
      await request(app.getHttpServer())
        .get('/records/507f1f77bcf86cd799439011')
        .expect(404);
    });
  });

  describe('PUT /records/:id', () => {
    it('should update a record', async () => {
      const createRecordDto = {
        artist: 'Update Test Artist',
        album: 'Update Test Album',
        price: 25,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(201);

      recordId = createResponse.body._id;

      const updateDto = { price: 30 };

      const response = await request(app.getHttpServer())
        .put(`/records/${recordId}`)
        .send(updateDto)
        .expect(200);

      expect(response.body).toHaveProperty('price', 30);
    });

    it('should return 404 for non-existent record', async () => {
      await request(app.getHttpServer())
        .put('/records/507f1f77bcf86cd799439011')
        .send({ price: 30 })
        .expect(404);
    });
  });

  describe('DELETE /records/:id', () => {
    it('should delete a record', async () => {
      const createRecordDto = {
        artist: 'Delete Test Artist',
        album: 'Delete Test Album',
        price: 25,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(201);

      const deleteId = createResponse.body._id;

      await request(app.getHttpServer())
        .delete(`/records/${deleteId}`)
        .expect(204);

      // Verify it's deleted
      await request(app.getHttpServer())
        .get(`/records/${deleteId}`)
        .expect(404);

      // Don't try to delete again in afterEach
      recordId = null;
    });

    it('should return 404 for non-existent record', async () => {
      await request(app.getHttpServer())
        .delete('/records/507f1f77bcf86cd799439011')
        .expect(404);
    });
  });

  afterEach(async () => {
    if (recordId) {
      await recordModel.findByIdAndDelete(recordId);
    }
  });

  afterAll(async () => {
    await app.close();
  });
});
