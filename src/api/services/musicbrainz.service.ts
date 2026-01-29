import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { TracklistItem } from '../schemas/record.schema';

@Injectable()
export class MusicBrainzService {
  private readonly logger = new Logger(MusicBrainzService.name);
  private readonly baseUrl = 'https://musicbrainz.org/ws/2';
  private readonly userAgent = 'BrokenRecordStore/1.0 (contact@example.com)';

  async fetchTracklist(mbid: string): Promise<TracklistItem[]> {
    if (!mbid) {
      return [];
    }

    try {
      const url = `${this.baseUrl}/release/${mbid}?inc=recordings&fmt=json`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
        timeout: 10000,
      });

      const media = response.data?.media;
      if (!media || !Array.isArray(media)) {
        return [];
      }

      const tracklist: TracklistItem[] = [];

      for (const medium of media) {
        const tracks = medium.tracks;
        if (!tracks || !Array.isArray(tracks)) {
          continue;
        }

        for (const track of tracks) {
          tracklist.push({
            title: track.title || track.recording?.title || 'Unknown',
            position: track.position || tracklist.length + 1,
            length: track.length ? Math.round(track.length / 1000) : undefined,
          });
        }
      }

      return tracklist;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          this.logger.warn(`MusicBrainz release not found: ${mbid}`);
        } else if (error.code === 'ECONNABORTED') {
          this.logger.error(`MusicBrainz request timeout for MBID: ${mbid}`);
        } else {
          this.logger.error(
            `MusicBrainz API error: ${error.message}`,
            error.stack,
          );
        }
      } else {
        this.logger.error(`Error fetching tracklist: ${error}`);
      }

      return [];
    }
  }
}
