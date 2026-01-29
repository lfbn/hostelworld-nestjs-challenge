import { Test, TestingModule } from '@nestjs/testing';
import { MusicBrainzService } from './musicbrainz.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MusicBrainzService', () => {
  let service: MusicBrainzService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MusicBrainzService],
    }).compile();

    service = module.get<MusicBrainzService>(MusicBrainzService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchTracklist', () => {
    it('should return empty array when mbid is empty', async () => {
      const result = await service.fetchTracklist('');
      expect(result).toEqual([]);
    });

    it('should return empty array when mbid is null', async () => {
      const result = await service.fetchTracklist(null as any);
      expect(result).toEqual([]);
    });

    it('should fetch and parse tracklist correctly', async () => {
      const mockResponse = {
        data: {
          media: [
            {
              tracks: [
                { title: 'Come Together', position: 1, length: 259000 },
                { title: 'Something', position: 2, length: 182000 },
              ],
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await service.fetchTracklist('test-mbid');

      expect(result).toEqual([
        { title: 'Come Together', position: 1, length: 259 },
        { title: 'Something', position: 2, length: 182 },
      ]);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://musicbrainz.org/ws/2/release/test-mbid?inc=recordings&fmt=json',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
            Accept: 'application/json',
          }),
          timeout: 10000,
        }),
      );
    });

    it('should handle multiple media (discs)', async () => {
      const mockResponse = {
        data: {
          media: [
            {
              tracks: [
                { title: 'Track 1', position: 1 },
              ],
            },
            {
              tracks: [
                { title: 'Track 2', position: 1 },
              ],
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await service.fetchTracklist('test-mbid');

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Track 1');
      expect(result[1].title).toBe('Track 2');
    });

    it('should return empty array when media is missing', async () => {
      mockedAxios.get.mockResolvedValue({ data: {} });

      const result = await service.fetchTracklist('test-mbid');

      expect(result).toEqual([]);
    });

    it('should return empty array on 404 error', async () => {
      const error = {
        response: { status: 404 },
        isAxiosError: true,
      };
      mockedAxios.get.mockRejectedValue(error);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const result = await service.fetchTracklist('invalid-mbid');

      expect(result).toEqual([]);
    });

    it('should return empty array on timeout', async () => {
      const error = {
        code: 'ECONNABORTED',
        isAxiosError: true,
      };
      mockedAxios.get.mockRejectedValue(error);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const result = await service.fetchTracklist('test-mbid');

      expect(result).toEqual([]);
    });

    it('should handle track with recording title fallback', async () => {
      const mockResponse = {
        data: {
          media: [
            {
              tracks: [
                { position: 1, recording: { title: 'Recording Title' } },
              ],
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await service.fetchTracklist('test-mbid');

      expect(result[0].title).toBe('Recording Title');
    });

    it('should use Unknown when no title available', async () => {
      const mockResponse = {
        data: {
          media: [
            {
              tracks: [
                { position: 1 },
              ],
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await service.fetchTracklist('test-mbid');

      expect(result[0].title).toBe('Unknown');
    });
  });
});
